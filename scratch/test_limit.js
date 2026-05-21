import dotenv from 'dotenv';
dotenv.config({ path: 'd:/Desktop/Pathology/PATHOLOGY_BACKEND/.env' });
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import axios from 'axios';

// Define schemas dynamically for the test script
const registrationSchema = new mongoose.Schema({}, { strict: false });
const Registration = mongoose.model('Registration_Test', registrationSchema, 'registrations');

const patientSchema = new mongoose.Schema({}, { strict: false });
const Patient = mongoose.model('Patient_Test', patientSchema, 'patients');

const testServiceSchema = new mongoose.Schema({}, { strict: false });
const TestService = mongoose.model('TestService_Test', testServiceSchema, 'testservices');

const subscriptionSchema = new mongoose.Schema({}, { strict: false });
const LabSubscription = mongoose.model('LabSubscription_Test', subscriptionSchema, 'labsubscriptions');

const settingSchema = new mongoose.Schema({}, { strict: false });
const Setting = mongoose.model('Setting_Test', settingSchema, 'settings');

const bookingSchema = new mongoose.Schema({}, { strict: false });
const Booking = mongoose.model('Booking_Test', bookingSchema, 'bookings');

async function test() {
  const uri = process.env.MONGODB_URI;
  console.log('Connecting to MongoDB...');
  await mongoose.connect(uri);
  console.log('Connected!');

  // 1. Fetch or create a test lab
  let lab = await Registration.findOne({ phone: "8888888888" });
  if (!lab) {
    console.log('Creating a test lab...');
    lab = await Registration.create({
      labName: "Test Pathology Lab",
      ownerName: "Lab Owner",
      phone: "8888888888",
      email: "testlab@gmail.com",
      password: "password123", // Plain text password
      status: true,
      city: "Lucknow"
    });
  } else {
    lab.status = true;
    lab.password = "password123";
    await lab.save();
  }
  console.log(`Lab: ${lab.labName} (ID: ${lab._id})`);

  // 2. Fetch or create a test patient
  let patient = await Patient.findOne({ mobile: "9999999999" });
  if (!patient) {
    console.log('Creating a test patient...');
    patient = await Patient.create({
      name: "John Doe",
      mobile: "9999999999",
      email: "johndoe@gmail.com",
      password: "password123",
      status: true
    });
  }
  console.log(`Patient: ${patient.name} (ID: ${patient._id})`);

  // 3. Fetch or create a test service
  let testService = await TestService.findOne({});
  if (!testService) {
    console.log('Creating a test service...');
    testService = await TestService.create({
      title: "CBC Test",
      test_code: "CBC101",
      mrp: 500,
      price: 400,
      status: true
    });
  }
  console.log(`Test Service: ${testService.title} (ID: ${testService._id})`);

  // 4. Set the global dynamic limit defaultFreeBookings to 1 in settings
  await Setting.findOneAndUpdate(
    { key: "defaultFreeBookings" },
    { value: 1 },
    { upsert: true, new: true }
  );
  console.log('Global Setting defaultFreeBookings set to 1!');

  // 5. Reset Lab Subscription
  await LabSubscription.deleteOne({ labId: lab._id });
  const sub = await LabSubscription.create({
    labId: lab._id,
    packageId: null,
    subscriptionStatus: "free",
    freeBookingsLimit: 0, // 0 triggers the global fallback setting!
    freeBookingsUsed: 0,
    weeklyBookingLimit: 0,
    monthlyBookingLimit: 0,
    yearlyBookingLimit: 0,
    bookingsThisWeek: 0,
    bookingsThisMonth: 0,
    bookingsThisYear: 0,
    totalBookingsAccepted: 0
  });
  console.log('Lab Subscription created/reset (subscriptionStatus: "free", freeBookingsLimit: 0)!');

  // 6. Delete any existing bookings for this lab
  await Booking.deleteMany({ registration: lab._id });
  console.log('Cleaned up previous bookings for this lab!');

  // 7. Generate JWT Tokens
  const jwtSecret = process.env.JWT_SECRET;
  const patientToken = jwt.sign({ id: patient._id.toString() }, jwtSecret, { expiresIn: '1d' });
  const labToken = jwt.sign({ id: lab._id.toString(), role: "pathology" }, jwtSecret, { expiresIn: '1d' });

  const apiBase = "http://localhost:3000";

  console.log('\n--- STARTING API TEST ---');

  // Step A: Create Booking 1
  console.log('\nStep 1: Creating first booking...');
  let bookingId1;
  try {
    const res = await axios.post(`${apiBase}/booking/create`, {
      registration: lab._id.toString(),
      tests: [testService._id.toString()],
      scheduledDate: "2026-05-25T10:00:00.000Z",
      sampleCollectionType: "Home",
      address: "Flat 101, Gomti Nagar, Lucknow",
      paymentMethod: "COD",
      notes: "First booking test"
    }, {
      headers: { Authorization: `Bearer ${patientToken}` }
    });
    bookingId1 = res.data.data._id;
    console.log(`✅ First Booking Created successfully! ID: ${bookingId1}`);
  } catch (err) {
    console.error(`❌ First Booking Creation Failed:`, err.response?.data || err.message);
    await mongoose.disconnect();
    return;
  }

  // Step B: Create Booking 2
  console.log('\nStep 2: Creating second booking...');
  let bookingId2;
  try {
    const res = await axios.post(`${apiBase}/booking/create`, {
      registration: lab._id.toString(),
      tests: [testService._id.toString()],
      scheduledDate: "2026-05-26T10:00:00.000Z",
      sampleCollectionType: "Home",
      address: "Flat 101, Gomti Nagar, Lucknow",
      paymentMethod: "COD",
      notes: "Second booking test"
    }, {
      headers: { Authorization: `Bearer ${patientToken}` }
    });
    bookingId2 = res.data.data._id;
    console.log(`✅ Second Booking Created successfully! ID: ${bookingId2}`);
  } catch (err) {
    console.error(`❌ Second Booking Creation Failed:`, err.response?.data || err.message);
    await mongoose.disconnect();
    return;
  }

  // Step C: Accept Booking 1
  console.log('\nStep 3: Accepting first booking (should succeed, since free limit is 1 and used is 0)...');
  try {
    const res = await axios.post(`${apiBase}/manage-package/booking/accept`, {
      bookingId: bookingId1,
      bookingType: "Booking"
    }, {
      headers: { Authorization: `Bearer ${labToken}` }
    });
    console.log(`✅ First Booking Accepted successfully! Response message: "${res.data.message}"`);
    console.log(`Subscription Info:`, res.data.subscriptionInfo);
  } catch (err) {
    console.error(`❌ First Booking Acceptance Failed unexpectedly:`, err.response?.data || err.message);
  }

  // Step D: Verify that the DB freeBookingsUsed incremented
  const updatedSub = await LabSubscription.findOne({ labId: lab._id });
  console.log(`\nLab subscription database stats after first accept:`);
  console.log(`- freeBookingsLimit (sub): ${updatedSub.freeBookingsLimit}`);
  console.log(`- freeBookingsUsed: ${updatedSub.freeBookingsUsed}`);

  // Step E: Accept Booking 2
  console.log('\nStep 4: Accepting second booking (should FAIL with 403 Forbidden because limit is 1)...');
  try {
    const res = await axios.post(`${apiBase}/manage-package/booking/accept`, {
      bookingId: bookingId2,
      bookingType: "Booking"
    }, {
      headers: { Authorization: `Bearer ${labToken}` }
    });
    console.error(`❌ Error: Second booking accepted successfully, but it should have failed! Response:`, res.data);
  } catch (err) {
    console.log(`✅ Successfully BLOCKED! Received expected rejection error:`);
    console.log(`- Status Code: ${err.response?.status}`);
    console.log(`- Response Message:`, err.response?.data?.message);
  }

  // 8. Clean up test data
  console.log('\n--- CLEANING UP TEST DATA ---');
  await Booking.deleteMany({ registration: lab._id });
  await LabSubscription.deleteOne({ labId: lab._id });
  await Registration.deleteOne({ _id: lab._id });
  await Patient.deleteOne({ _id: patient._id });
  console.log('Cleanup completed successfully!');

  await mongoose.disconnect();
}

test().catch(console.error);
