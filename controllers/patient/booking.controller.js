import LabSlot from "../../model/labSlot.model.js";
import TestBooking from "../../model/testBooking.model.js";
import LabTestPricing from "../../model/labTestPricing.model.js";
import mongoose from "mongoose";

/**
 * Get available slots for a lab on a specific date
 */
export const getAvailableSlots = async (req, res) => {
  try {
    const { labId, date } = req.query;

    if (!labId || !date) {
      return res.status(400).json({
        success: false,
        message: "labId and date are required"
      });
    }

    const slots = await LabSlot.find({ labId, date }).sort({ startTime: 1 });

    res.json({
      success: true,
      data: slots,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Book a test direct flow
 */
export const bookTest = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { labTestPricingId, slotId, paymentMode } = req.body;
    const patientId = req.user.id;

    if (!labTestPricingId || !slotId) {
      return res.status(400).json({
        success: false,
        message: "labTestPricingId and slotId are required"
      });
    }

    // 1. Fetch Slot and check availability
    const slot = await LabSlot.findById(slotId).session(session);
    if (!slot) {
      throw new Error("Slot not found");
    }
    if (slot.isBooked) {
      throw new Error("Slot already booked. Please choose another slot.");
    }

    // 2. Fetch Lab Test Pricing
    const pricing = await LabTestPricing.findById(labTestPricingId).session(session);
    if (!pricing) {
      throw new Error("Lab Test Pricing not found");
    }

    // 3. Create Booking
    const finalAmount = pricing.discountPrice ? parseFloat(pricing.discountPrice) : parseFloat(pricing.price);

    const bookingData = {
      patientId,
      labTestPricingId,
      labId: pricing.registration,
      bookingDate: slot.date,
      slotId,
      amount: finalAmount,
      paymentMode: paymentMode || "Cash on Collection",
      paymentStatus: paymentMode === "Online" ? "Paid" : "Pending",
      bookingStatus: "Confirmed",
    };

    const booking = new TestBooking(bookingData);
    await booking.save({ session });

    // 4. Update Slot status
    slot.isBooked = true;
    await slot.save({ session });

    await session.commitTransaction();
    session.endSession();

    // Populate details for confirmation screen
    const confirmedBooking = await TestBooking.findById(booking._id)
      .populate("labId", "labName fullAddress phone areaName city")
      .populate({
        path: "labTestPricingId",
        populate: { path: "test", select: "title" }
      })
      .populate("slotId");

    res.status(201).json({
      success: true,
      message: "Booking confirmed successfully",
      data: confirmedBooking,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * Get patient's bookings
 */
export const getMyBookings = async (req, res) => {
  try {
    const patientId = req.user.id;
    const bookings = await TestBooking.find({ patientId })
      .populate("labId", "labName labLogo fullAddress areaName city")
      .populate({
        path: "labTestPricingId",
        populate: { path: "test", select: "title" }
      })
      .populate("slotId")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: bookings.length,
      data: bookings,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
