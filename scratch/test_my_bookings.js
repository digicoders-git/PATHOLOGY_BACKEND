import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import axios from 'axios';
import mongoose from 'mongoose';
import Booking from '../model/booking.model.js';
import TestBooking from '../model/testBooking.model.js';
import Patient from '../model/patient/patient.model.js';

dotenv.config();

async function testMyBookings() {
  let dbConnected = false;
  try {
    // Connect to DB directly
    await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/laboIndia");
    dbConnected = true;

    // Create a mock patient if not exists
    let patient = await Patient.findOne({ mobile: "9999999999" });
    if (!patient) {
      patient = new Patient({ mobile: "9999999999", name: "Test Patient" });
      await patient.save();
    }
    const mockPatientId = patient._id;

    // 1. Generate token
    const token = jwt.sign({ id: mockPatientId, role: 'patient' }, process.env.JWT_SECRET);
    console.log("Generated Token for My-Bookings test.");

    // 2. Create a mock OLD booking (Booking model)
    const oldBooking = new Booking({
      patient: mockPatientId,
      registration: new mongoose.Types.ObjectId(), // Fake lab ID
      tests: [{ test: new mongoose.Types.ObjectId(), price: 500 }],
      totalMrp: 500,
      finalAmount: 400,
      paymentMethod: "COD",
      status: "Pending"
    });
    await oldBooking.save();

    // 3. Create a mock NEW booking (TestBooking model)
    const newBooking = new TestBooking({
      patientId: mockPatientId,
      labTestPricingId: new mongoose.Types.ObjectId(),
      labId: new mongoose.Types.ObjectId(),
      bookingDate: "2026-06-20",
      slotId: new mongoose.Types.ObjectId(),
      amount: 600,
      paymentMode: "Online",
      bookingStatus: "Confirmed"
    });
    await newBooking.save();

    console.log("Mock bookings created in both tables.");

    // 4. Hit the GET API
    console.log("\nCalling API: GET http://localhost:3000/patient/my-bookings...");
    
    const getResponse = await axios.get('http://localhost:3000/patient/my-bookings', {
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log("\n--- API Response ---");
    console.log(`Success: ${getResponse.data.success}`);
    console.log(`Count: ${getResponse.data.count}`);
    
    // Print summary of data returned
    getResponse.data.data.forEach((b, index) => {
      console.log(`\nBooking ${index + 1}:`);
      console.log(`- Source: ${b.source}`);
      console.log(`- Booking ID: ${b.bookingId}`);
      console.log(`- Amount: ${b.amount}`);
      console.log(`- Status: ${b.bookingStatus}`);
    });

  } catch (error) {
    console.error("\nAPI Request Failed:");
    if (error.response) {
      console.error(error.response.data);
    } else {
      console.error(error.message);
    }
  } finally {
    if (dbConnected) {
       // Cleanup mock data
       await Booking.deleteMany({ patient: mongoose.Types.ObjectId.isValid('9999999999') ? null : null }); // Be careful not to delete real data, just let it be or delete specific ones.
       await mongoose.disconnect();
    }
  }
}

testMyBookings();
