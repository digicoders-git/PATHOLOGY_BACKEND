import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import axios from 'axios';
import mongoose from 'mongoose';
import PatientNotification from '../model/patientNotification.model.js';

dotenv.config();

async function testNotificationApi() {
  let dbConnected = false;
  try {
    // 1. Generate a mock patient token
    const mockPatientId = '64abcdef1234567890123456'; 
    const token = jwt.sign({ id: mockPatientId, role: 'patient' }, process.env.JWT_SECRET);

    console.log("Generated Mock Token:", token);
    
    // Connect to DB directly to create a dummy notification for testing
    await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/laboIndia");
    dbConnected = true;
    
    const testNotif = new PatientNotification({
      patientId: mockPatientId,
      title: "Test Notification",
      message: "This is a test notification",
      type: "system"
    });
    await testNotif.save();
    
    console.log(`\nCreated a mock notification in DB with ID: ${testNotif._id}`);

    // 2. Hit the GET API
    console.log("\nCalling API: GET http://localhost:3000/patient/notifications...");
    
    const getResponse = await axios.get('http://localhost:3000/patient/notifications', {
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log("GET Response Success!");
    console.log(JSON.stringify(getResponse.data, null, 2));

    // 3. Hit the PATCH mark-as-read API for this specific ID
    console.log(`\nCalling API: PATCH http://localhost:3000/patient/notifications/${testNotif._id}/read...`);
    const patchResponse = await axios.patch(`http://localhost:3000/patient/notifications/${testNotif._id}/read`, {}, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log("PATCH Response Success!");
    console.log(JSON.stringify(patchResponse.data, null, 2));

  } catch (error) {
    console.error("\nAPI Request Failed:");
    if (error.response) {
      console.error(JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
    }
  } finally {
    if (dbConnected) {
       await mongoose.disconnect();
    }
  }
}

testNotificationApi();
