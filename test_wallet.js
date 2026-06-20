import mongoose from "mongoose";
import Registration from "./model/registration.model.js";
import TestBooking from "./model/testBooking.model.js";
import WalletTransaction from "./model/walletTransaction.model.js";
import LabSlot from "./model/labSlot.model.js";

async function testWalletSettlement() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect("mongodb://localhost:27017/laboIndia");
    console.log("Connected.");

    // 1. Create a dummy lab
    const lab = new Registration({
      labName: "Test Lab",
      phone: Date.now().toString(),
      email: Date.now().toString() + "@example.com",
      ownerName: "Owner",
      walletBalance: 0
    });
    await lab.save();
    console.log("Created Lab ID:", lab._id);

    // 2. Create a dummy TestBooking with adminDiscountAmount
    const booking = new TestBooking({
      labId: lab._id,
      patientId: new mongoose.Types.ObjectId(), // Dummy patient
      labTestPricingId: new mongoose.Types.ObjectId(), // Dummy pricing
      slotId: new mongoose.Types.ObjectId(), // Dummy slot
      amount: 800,
      adminDiscountAmount: 200,
      couponCode: "SAVE20",
      bookingStatus: "Pending",
      paymentMode: "Cash on Collection",
      bookingDate: new Date().toISOString()
    });
    await booking.save();
    console.log("Created Booking ID:", booking._id);

    // 3. Simulate the updateBookingStatus logic from bookingManagement.controller.js
    console.log("\nSimulating status update to 'Completed'...");
    const status = "Completed";
    
    // Original Code logic
    let appBooking = await TestBooking.findOne({ _id: booking._id, labId: lab._id });
    if (appBooking) {
      const oldStatus = appBooking.bookingStatus;
      appBooking.bookingStatus = status;

      // If cancelled, free up the slot
      if (status === "Cancelled" && appBooking.slotId) {
        await LabSlot.findByIdAndUpdate(appBooking.slotId, { isBooked: false });
      }

      // Wallet Logic
      if (status === "Completed" && oldStatus !== "Completed" && appBooking.adminDiscountAmount > 0) {
         const foundLab = await Registration.findById(lab._id);
         if (foundLab) {
            foundLab.walletBalance = (foundLab.walletBalance || 0) + appBooking.adminDiscountAmount;
            await foundLab.save();

            await WalletTransaction.create({
               labId: lab._id,
               amount: appBooking.adminDiscountAmount,
               type: "credit",
               description: `Admin Coupon Refund for Booking`,
               relatedBookingId: booking._id
            });
         }
      }
      await appBooking.save();
    }

    // 4. Verify the results
    const finalLab = await Registration.findById(lab._id);
    const transactions = await WalletTransaction.find({ labId: lab._id });

    console.log("\n--- TEST RESULTS ---");
    console.log(`Lab Wallet Balance (Expected: 200): ${finalLab.walletBalance}`);
    console.log(`Wallet Transactions Count (Expected: 1): ${transactions.length}`);
    if (transactions.length > 0) {
      console.log(`Transaction Amount: ${transactions[0].amount}`);
      console.log(`Transaction Type: ${transactions[0].type}`);
      console.log(`Transaction Description: ${transactions[0].description}`);
    }

    if (finalLab.walletBalance === 200 && transactions.length === 1) {
      console.log("\n✅ SUCCESS: Wallet Settlement logic works perfectly!");
    } else {
      console.log("\n❌ FAILED: Logic did not produce expected results.");
    }

    // Cleanup
    await Registration.findByIdAndDelete(lab._id);
    await TestBooking.findByIdAndDelete(booking._id);
    await WalletTransaction.deleteMany({ labId: lab._id });

  } catch (err) {
    console.error("Test Error:", err);
  } finally {
    mongoose.disconnect();
  }
}

testWalletSettlement();
