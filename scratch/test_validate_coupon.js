import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const testApi = async () => {
  try {
    // 1. Connect to DB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to DB");

    // 2. Generate a Dummy Patient Token
    const payload = {
      id: new mongoose.Types.ObjectId().toString(),
      name: "Test Patient",
      role: "patient"
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
    console.log("Generated Token:", token);

    // 3. Create a Dummy Coupon in DB
    const Offer = (await import('../model/offer.model.js')).default;
    const testCouponCode = "TEST50";
    
    await Offer.deleteMany({ couponCode: testCouponCode }); // clean up old
    
    const offer = await Offer.create({
      title: "Test Coupon",
      couponCode: testCouponCode,
      discountPercent: 50,
      status: true,
      offerType: "banner",
      validFrom: new Date(Date.now() - 100000), // Valid from past
      validTo: new Date(Date.now() + 86400000)  // Valid till tomorrow
    });
    console.log("Created Dummy Offer in DB:", offer.couponCode);

    // 4. Test the API
    console.log("\n--- Calling API ---");
    const response = await fetch('http://localhost:3000/patient/validate-coupon', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        couponCode: testCouponCode
      })
    });

    const result = await response.json();
    console.log("Status Code:", response.status);
    console.log("Response Body:", JSON.stringify(result, null, 2));

    // 5. Clean up
    await Offer.findByIdAndDelete(offer._id);
    console.log("Cleaned up Dummy Offer");
    process.exit(0);
  } catch (error) {
    console.error("Test failed:", error);
    process.exit(1);
  }
};

testApi();
