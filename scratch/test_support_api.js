import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

async function testSupportApi() {
  try {
    // 1. Generate a mock patient token
    const mockPatientId = '64abcdef1234567890123456'; 
    const token = jwt.sign({ id: mockPatientId, role: 'patient' }, process.env.JWT_SECRET);

    console.log("Generated Mock Token:", token);
    
    // 2. Hit the POST /patient/support API
    console.log("\nCalling API: POST http://localhost:3000/patient/support...");
    
    const postResponse = await axios.post('http://localhost:3000/patient/support', {
        subject: "Test Issue",
        message: "This is a test message to check if the support API is working properly."
    }, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    console.log("\nPOST API Response Success!");
    console.log(JSON.stringify(postResponse.data, null, 2));

    // 3. Hit the GET /patient/support API
    console.log("\nCalling API: GET http://localhost:3000/patient/support...");
    
    const getResponse = await axios.get('http://localhost:3000/patient/support', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    console.log("\nGET API Response Success!");
    console.log(JSON.stringify(getResponse.data, null, 2));

  } catch (error) {
    console.error("\nAPI Request Failed:");
    if (error.response) {
      console.error(JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
    }
  }
}

testSupportApi();
