import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

async function testTransactionApi() {
  try {
    // 1. Generate a mock patient token
    // Using a dummy object ID for the patient
    const mockPatientId = '64abcdef1234567890123456'; 
    const token = jwt.sign({ id: mockPatientId, role: 'patient' }, process.env.JWT_SECRET);

    console.log("Generated Mock Token:", token);
    
    // 2. Hit the GET /patient/transactions API using Axios (acts like cURL)
    console.log("\nCalling API: GET http://localhost:3000/patient/transactions...");
    
    const response = await axios.get('http://localhost:3000/patient/transactions', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    console.log("\nAPI Response Success!");
    console.log(JSON.stringify(response.data, null, 2));

  } catch (error) {
    console.error("\nAPI Request Failed:");
    if (error.response) {
      console.error(JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
    }
  }
}

testTransactionApi();
