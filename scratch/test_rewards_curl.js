import mongoose from "mongoose";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import axios from "axios";
import Registration from "../model/registration.model.js";
import WalletTransaction from "../model/walletTransaction.model.js";
import LabNotification from "../model/labNotification.model.js";
import TestBooking from "../model/testBooking.model.js";
import Booking from "../model/booking.model.js";
import Patient from "../model/patient/patient.model.js";

dotenv.config();

const API_BASE = "http://localhost:3000";
const JWT_SECRET = process.env.JWT_SECRET || "3GH@$%^&GGHHTGHN@456%^65435$%^7%^$%767VGHFVG^%$^&8GHJH@#$%^FGHJH";

async function runRewardVerificationTest() {
  console.log("=================================================");
  console.log("🚀 STARTING E2E REWARDS VERIFICATION TEST");
  console.log("=================================================\n");

  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅ Connected to MongoDB");

  const cleanupIds = {
    registrations: [],
    patients: [],
    testBookings: [],
    walletTransactions: [],
    labNotifications: []
  };

  try {
    // -------------------------------------------------------------
    // GENERATE TEST TOKENS
    // -------------------------------------------------------------
    const adminToken = jwt.sign({ id: "admin_test_id", role: "admin" }, JWT_SECRET, { expiresIn: "1h" });

    // -------------------------------------------------------------
    // TEST 1: LAB REGISTRATION APPROVAL (WELCOME BONUS - 100 PTS)
    // -------------------------------------------------------------
    console.log("\n--- TEST 1: LAB REGISTRATION APPROVAL (WELCOME BONUS) ---");
    
    // Create a pending test lab
    const testLab = await Registration.create({
      labName: "E2E Test Lab Pathology",
      ownerName: "Test Owner",
      email: `testlab_${Date.now()}@example.com`,
      phone: `99${Math.floor(10000000 + Math.random() * 90000000)}`,
      password: "testpassword",
      approvalStatus: "pending",
      status: false,
      walletBalance: 0
    });
    cleanupIds.registrations.push(testLab._id);
    console.log(`Created test lab: ${testLab._id} with initial walletBalance: ${testLab.walletBalance}`);

    // Call PATCH /registrations/approval/:id using axios (equivalent to curl)
    const approveUrl = `${API_BASE}/registrations/approval/${testLab._id}`;
    console.log(`Calling cURL/HTTP PATCH: ${approveUrl}`);
    
    const approveResponse = await axios.patch(
      approveUrl,
      { approvalStatus: "approved" },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );

    console.log(`HTTP Status: ${approveResponse.status}, Success: ${approveResponse.data.success}`);

    // Verify Lab wallet in DB
    const approvedLab = await Registration.findById(testLab._id);
    console.log(`Lab wallet balance after approval: ${approvedLab.walletBalance} (Expected: 100)`);
    if (approvedLab.walletBalance !== 100) {
      throw new Error(`Test 1 Failed: Expected walletBalance 100, got ${approvedLab.walletBalance}`);
    }

    // Verify WalletTransaction in DB
    const welcomeTx = await WalletTransaction.findOne({
      labId: testLab._id,
      description: { $regex: /Welcome Bonus/i }
    });
    if (!welcomeTx) {
      throw new Error("Test 1 Failed: Welcome bonus WalletTransaction not found!");
    }
    cleanupIds.walletTransactions.push(welcomeTx._id);
    console.log(`✅ Verified WalletTransaction: "${welcomeTx.description}", Amount: ${welcomeTx.amount}`);

    // Verify LabNotification in DB
    const welcomeNotif = await LabNotification.findOne({
      labId: testLab._id,
      type: "WALLET"
    });
    if (!welcomeNotif) {
      throw new Error("Test 1 Failed: Welcome bonus LabNotification not found!");
    }
    cleanupIds.labNotifications.push(welcomeNotif._id);
    console.log(`✅ Verified LabNotification: Title: "${welcomeNotif.title}", Body: "${welcomeNotif.body.split('\n')[0]}"`);
    console.log("🎉 TEST 1 PASSED: Welcome Bonus 100 Points successfully credited on Lab Approval!");

    // -------------------------------------------------------------
    // TEST 2: PATIENT FIRST BOOKING COMPLETION REWARD (100 PTS)
    // -------------------------------------------------------------
    console.log("\n--- TEST 2: PATIENT FIRST BOOKING COMPLETION REWARD ---");

    // Create a new test patient
    const testPatient = await Patient.create({
      name: "E2E Test Patient",
      mobile: `88${Math.floor(10000000 + Math.random() * 90000000)}`,
      walletBalance: 0
    });
    cleanupIds.patients.push(testPatient._id);
    console.log(`Created test patient: ${testPatient._id}`);

    // Create a pending booking for this patient and lab
    const testBooking = await TestBooking.create({
      patientId: testPatient._id,
      labId: testLab._id,
      labTestPricingId: new mongoose.Types.ObjectId(),
      slotId: new mongoose.Types.ObjectId(),
      bookingDate: "2026-10-21",
      amount: 500,
      paymentMode: "Cash on Collection",
      bookingId: "TEST-BK-" + Date.now(),
      bookingStatus: "Pending"
    });
    cleanupIds.testBookings.push(testBooking._id);
    console.log(`Created test booking: ${testBooking._id} in status: ${testBooking.bookingStatus}`);

    // Verify Lab wallet is still 100 (NOT yet credited during pending state)
    const labBeforeCompletion = await Registration.findById(testLab._id);
    console.log(`Lab wallet balance before completion: ${labBeforeCompletion.walletBalance} (Expected: 100)`);
    if (labBeforeCompletion.walletBalance !== 100) {
      throw new Error(`Test 2 Failed: Lab should still have 100 points, got ${labBeforeCompletion.walletBalance}`);
    }

    // Generate Lab Auth Token for the test lab
    const labToken = jwt.sign({ id: testLab._id.toString(), role: "pathology" }, JWT_SECRET, { expiresIn: "1h" });

    // Call PATCH /pathology/update-booking-status/:bookingId with status "Completed"
    const completeUrl = `${API_BASE}/pathology/update-booking-status/${testBooking._id}`;
    console.log(`Calling cURL/HTTP PATCH: ${completeUrl} with status: "Completed"`);

    const completeResponse = await axios.patch(
      completeUrl,
      { status: "Completed" },
      { headers: { Authorization: `Bearer ${labToken}` } }
    );

    console.log(`HTTP Status: ${completeResponse.status}, Success: ${completeResponse.data.success}, Message: "${completeResponse.data.message}"`);

    // Give asynchronous push/notification handler a short moment
    await new Promise(r => setTimeout(r, 1000));

    // Verify Lab wallet updated to 200 (100 welcome + 100 first booking reward)
    const labAfterCompletion = await Registration.findById(testLab._id);
    console.log(`Lab wallet balance after completion: ${labAfterCompletion.walletBalance} (Expected: 200)`);
    if (labAfterCompletion.walletBalance !== 200) {
      throw new Error(`Test 2 Failed: Expected walletBalance 200, got ${labAfterCompletion.walletBalance}`);
    }

    // Verify First Booking Reward WalletTransaction
    const firstBookingTx = await WalletTransaction.findOne({
      relatedBookingId: testBooking._id,
      description: "Patient First Booking Reward - 100 Points"
    });
    if (!firstBookingTx) {
      throw new Error("Test 2 Failed: First booking reward WalletTransaction not found!");
    }
    cleanupIds.walletTransactions.push(firstBookingTx._id);
    console.log(`✅ Verified WalletTransaction: "${firstBookingTx.description}", Amount: ${firstBookingTx.amount}`);

    // Verify First Booking LabNotification
    const bookingNotif = await LabNotification.findOne({
      labId: testLab._id,
      title: "First Booking Reward! 🎉"
    });
    if (!bookingNotif) {
      throw new Error("Test 2 Failed: First booking reward LabNotification not found!");
    }
    cleanupIds.labNotifications.push(bookingNotif._id);
    console.log(`✅ Verified LabNotification: Title: "${bookingNotif.title}", Body: "${bookingNotif.body.split('\n')[0]}"`);
    console.log("🎉 TEST 2 PASSED: 100 Points & Notification successfully credited on Booking Completion!");

    // -------------------------------------------------------------
    // TEST 3: IDEMPOTENCY / NO DUPLICATE REWARD
    // -------------------------------------------------------------
    console.log("\n--- TEST 3: IDEMPOTENCY (NO DUPLICATE REWARD) ---");
    console.log(`Calling cURL/HTTP PATCH again for already completed booking...`);
    
    await axios.patch(
      completeUrl,
      { status: "Completed" },
      { headers: { Authorization: `Bearer ${labToken}` } }
    );
    await new Promise(r => setTimeout(r, 500));

    const labAfterDuplicate = await Registration.findById(testLab._id);
    console.log(`Lab wallet balance after duplicate call: ${labAfterDuplicate.walletBalance} (Expected: 200)`);
    if (labAfterDuplicate.walletBalance !== 200) {
      throw new Error(`Test 3 Failed: Wallet balance changed to ${labAfterDuplicate.walletBalance} on duplicate call!`);
    }

    const txCount = await WalletTransaction.countDocuments({
      relatedBookingId: testBooking._id,
      description: "Patient First Booking Reward - 100 Points"
    });
    console.log(`Reward transactions for this booking: ${txCount} (Expected: 1)`);
    if (txCount !== 1) {
      throw new Error(`Test 3 Failed: Found ${txCount} transactions for same booking!`);
    }
    console.log("🎉 TEST 3 PASSED: System is completely idempotent, no double crediting!");

    console.log("\n=================================================");
    console.log("🏆 ALL REWARD SYSTEM TESTS PASSED SUCCESSFULLY! 🏆");
    console.log("=================================================\n");

  } catch (err) {
    console.error("❌ TEST FAILED:", err.response ? err.response.data : err.message);
  } finally {
    // Cleanup test data
    console.log("Cleaning up test documents...");
    await Registration.deleteMany({ _id: { $in: cleanupIds.registrations } });
    await Patient.deleteMany({ _id: { $in: cleanupIds.patients } });
    await TestBooking.deleteMany({ _id: { $in: cleanupIds.testBookings } });
    await WalletTransaction.deleteMany({ _id: { $in: cleanupIds.walletTransactions } });
    await LabNotification.deleteMany({ _id: { $in: cleanupIds.labNotifications } });
    await mongoose.disconnect();
    console.log("Cleanup done. Disconnected DB.");
  }
}

runRewardVerificationTest();
