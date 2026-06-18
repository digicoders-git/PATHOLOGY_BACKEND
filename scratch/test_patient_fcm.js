import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import axios from 'axios';
import mongoose from 'mongoose';
import Patient from '../model/patient/patient.model.js';

dotenv.config();

async function testFCM() {
  let dbConnected = false;
  try {
    // Connect to DB directly
    await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/laboIndia");
    dbConnected = true;

    // Create a mock patient if not exists
    let patient = await Patient.findOne({ mobile: "8888888888" });
    if (!patient) {
      patient = new Patient({ mobile: "8888888888", name: "FCM Test Patient" });
      await patient.save();
    }
    const mockPatientId = patient._id;

    // 1. Generate token
    const jwtToken = jwt.sign({ id: mockPatientId, role: 'patient' }, process.env.JWT_SECRET);
    console.log("Generated JWT Token for testing.");

    const dummyFCMToken = "test_fcm_token_123456789";

    // 2. Call save API
    console.log(`\nCalling POST /patient/fcm/save with token: ${dummyFCMToken}...`);
    const saveResponse = await axios.post('http://localhost:3000/patient/fcm/save', { token: dummyFCMToken }, {
      headers: { Authorization: `Bearer ${jwtToken}` }
    });
    console.log("Save Response:", saveResponse.data);

    // Verify DB
    let checkPatient = await Patient.findById(mockPatientId);
    console.log("Tokens in DB after save:", checkPatient.fcmTokens);

    // 3. Call remove API
    console.log(`\nCalling POST /patient/fcm/remove with token: ${dummyFCMToken}...`);
    const removeResponse = await axios.post('http://localhost:3000/patient/fcm/remove', { token: dummyFCMToken }, {
      headers: { Authorization: `Bearer ${jwtToken}` }
    });
    console.log("Remove Response:", removeResponse.data);

    // Verify DB
    checkPatient = await Patient.findById(mockPatientId);
    console.log("Tokens in DB after remove:", checkPatient.fcmTokens);

  } catch (error) {
    console.error("\nAPI Request Failed:");
    if (error.response) {
      console.error(error.response.data);
    } else {
      console.error(error.message);
    }
  } finally {
    if (dbConnected) {
       await mongoose.disconnect();
    }
  }
}

testFCM();
