import LabSlot from "../../model/labSlot.model.js";
import TestBooking from "../../model/testBooking.model.js";
import LabTestPricing from "../../model/labTestPricing.model.js";
import mongoose from "mongoose";
import { createNotification } from "../notification.controller.js";
import { sendNotificationToUser, sendNotificationToAdmins } from "../../services/notificationService.js";

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
      bookingStatus: "Pending",  // ✅ Fixed - Initially Pending, lab will accept/decline
    };

    const booking = new TestBooking(bookingData);
    await booking.save({ session });

    // 4. Create Transaction Record
    const Transaction = (await import("../../model/transaction.model.js")).default;
    const transactionData = {
      userId: patientId,
      userType: 'Patient',
      relatedBooking: booking._id,
      amount: finalAmount,
      type: 'debit',
      paymentMode: paymentMode || "Cash on Collection",
      status: paymentMode === "Online" ? "success" : "pending",
      description: `Payment for Test Booking (Slot: ${slot.startTime}-${slot.endTime})`
    };
    const transaction = new Transaction(transactionData);
    await transaction.save({ session });

    // 5. Update Slot status
    slot.isBooked = true;
    await slot.save({ session });

    await session.commitTransaction();
    session.endSession();

    // Get patient and lab details for notification
    const Patient = (await import("../../model/patient/patient.model.js")).default;
    const patient = await Patient.findById(patientId);
    const labPopulated = await booking.populate('labId');

    // Get test name from pricing
    const pricingWithTest = await LabTestPricing.findById(labTestPricingId).populate('test', 'title');
    const testTitle = pricingWithTest?.test?.title || 'Test';
    const labName = labPopulated?.labId?.labName || 'Unknown Lab';

    // Prepare notification data
    const notificationData = {
      type: 'new_booking',
      bookingId: booking._id.toString(),
      patientName: patient?.name || 'Unknown Patient',
      patientPhone: patient?.mobile || patient?.phone || 'N/A',
      labName: labName,
      testName: testTitle,
      amount: String(finalAmount),
      bookingDate: slot.date || '',
      slotTime: `${slot.startTime} - ${slot.endTime}`,
      paymentMode: paymentMode || 'Cash on Collection',
      timestamp: new Date().toISOString()
    };

    // Send notification to Lab
    if (pricing.registration) {
      await sendNotificationToUser(
        pricing.registration.toString(),
        'New Test Booking Received!',
        `Patient: ${patient?.name || 'Patient'} | Test: ${testTitle} | Slot: ${slot.startTime}-${slot.endTime} | Amount: ₹${finalAmount}`,
        notificationData,
        'pathology'
      ).catch(err => console.error('Error sending lab notification:', err));
    }

    // Send notification to all Admins
    await sendNotificationToAdmins(
      'New Test Booking',
      `Lab: ${labName} | Patient: ${patient?.name || 'Unknown'} | Test: ${testTitle} | Amount: ₹${finalAmount}`,
      notificationData
    ).catch(err => console.error('Error sending admin notification:', err));

    // Auto notification — fire and forget
    createNotification(
      "New App Booking",
      `A patient has booked a test via the app.`,
      "booking",
      "/dashboard/bookings",
      booking._id
    ).catch(() => {});

    // Save notification for Patient App History
    const PatientNotification = (await import("../../model/patientNotification.model.js")).default;
    const patNotif = new PatientNotification({
      patientId,
      title: "Booking Confirmed! ✅",
      message: `Your test booking for ${testTitle} at ${labName} has been confirmed.`,
      type: "booking_status",
      relatedBookingId: booking._id
    });
    patNotif.save().catch(() => {});

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
      message: "Booking created successfully. Waiting for lab confirmation.",
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
    
    // Fetch from new app flow (TestBooking)
    const newBookingsPromise = (await import("../../model/testBooking.model.js")).default.find({ patientId })
      .populate("labId", "labName labLogo fullAddress areaName city")
      .populate({
        path: "labTestPricingId",
        populate: { path: "test", select: "title" }
      })
      .populate("slotId")
      .sort({ createdAt: -1 });

    // Fetch from old direct flow (Booking)
    const oldBookingsPromise = (await import("../../model/booking.model.js")).default.find({ patient: patientId })
      .populate("registration", "labName labLogo fullAddress areaName city")
      .populate("tests.test", "title")
      .sort({ createdAt: -1 });

    const [newBookings, oldBookings] = await Promise.all([newBookingsPromise, oldBookingsPromise]);

    // Normalize new bookings
    const normalizedNew = newBookings.map((b) => ({
      _id: b._id,
      bookingId: b.bookingId || b._id.toString().slice(-8).toUpperCase(),
      patientId: b.patientId,
      labId: b.labId,
      labTestPricingId: b.labTestPricingId,
      bookingDate: b.bookingDate,
      slotId: b.slotId,
      amount: b.amount,
      paymentMode: b.paymentMode,
      paymentStatus: b.paymentStatus,
      bookingStatus: b.bookingStatus,
      reportFile: b.reportFile,
      reportStatus: b.reportStatus,
      createdAt: b.createdAt,
      source: "app"
    }));

    // Normalize old bookings
    const normalizedOld = oldBookings.map((b) => ({
      _id: b._id,
      bookingId: b._id.toString().slice(-8).toUpperCase(),
      patientId: b.patient,
      labId: b.registration, // Mapped to labId for UI consistency
      labTestPricingId: { 
        test: { title: b.tests?.map(t => t.test?.title).filter(Boolean).join(", ") || "Multiple Tests" } 
      }, // Mapped to match UI structure
      bookingDate: b.scheduledDate || b.createdAt,
      slotId: { startTime: "N/A", endTime: "N/A", date: "N/A" }, // Mocked slot
      amount: b.finalAmount,
      paymentMode: b.paymentMethod,
      paymentStatus: b.paymentStatus,
      bookingStatus: b.status,
      reportFile: b.reportFile,
      reportStatus: b.reportFile ? "Uploaded" : "Pending",
      createdAt: b.createdAt,
      source: "direct"
    }));

    // Merge and sort
    const mergedBookings = [...normalizedNew, ...normalizedOld].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({
      success: true,
      count: mergedBookings.length,
      data: mergedBookings,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
