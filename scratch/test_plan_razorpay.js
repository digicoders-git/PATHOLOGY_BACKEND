import mongoose from 'mongoose';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import fetch from 'node-fetch'; // or axios if available

dotenv.config();

const testRazorpayFlow = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to DB");

    // Get a Lab
    const Registration = (await import('../model/registration.model.js')).default;
    const lab = await Registration.findOne({ role: 'pathology' });
    if (!lab) throw new Error("No lab found");

    // Get a Plan
    const Plan = (await import('../model/plan.model.js')).default;
    let plan = await Plan.findOne();
    if (!plan) {
        plan = await Plan.create({
            name: "Test Plan",
            price: 999,
            duration: 30,
            freeBookings: 100,
            features: ["feature 1"],
            status: true,
            displayOrder: 1
        });
        console.log("Created dummy plan");
    }

    // Generate Token
    const token = jwt.sign({ id: lab._id, role: lab.role }, process.env.JWT_SECRET, { expiresIn: "1d" });
    
    console.log(`Lab: ${lab.email}, Plan: ${plan.name} (${plan.price} INR)`);

    // 1. Create Order
    const orderRes = await fetch('http://localhost:3000/plans/purchase/order', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ planId: plan._id })
    });
    const orderData = await orderRes.json();
    console.log("Order Data:", orderData);

    if (!orderData.success) {
        throw new Error("Order creation failed");
    }

    // 2. Generate Signature using the test helper
    const sigRes = await fetch('http://localhost:3000/manage-package/test/generate-signature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            razorpay_order_id: orderData.data.orderId,
            razorpay_payment_id: "pay_test_" + Date.now()
        })
    });
    const sigData = await sigRes.json();
    console.log("Signature Data:", sigData);

    // 3. Verify Payment
    const verifyRes = await fetch('http://localhost:3000/plans/purchase/verify', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            planId: plan._id,
            razorpay_order_id: sigData.data.razorpay_order_id,
            razorpay_payment_id: sigData.data.razorpay_payment_id,
            razorpay_signature: sigData.data.razorpay_signature
        })
    });
    const verifyData = await verifyRes.json();
    console.log("Verify Data:", verifyData);

  } catch (error) {
    console.error("Test Error:", error);
  } finally {
    mongoose.disconnect();
  }
};

testRazorpayFlow();
