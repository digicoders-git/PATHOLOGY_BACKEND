import TestBooking from "../../model/testBooking.model.js";
import Booking from "../../model/booking.model.js";
import LabSlot from "../../model/labSlot.model.js";
import mongoose from "mongoose";

/**
 * Get all bookings for the logged-in Pathology Lab (Merged from both systems)
 */
export const getMyLabBookings = async (req, res) => {
  try {
    const labId = req.user.id;
    const { status, search } = req.query;

    // Explicitly cast to ObjectId for safer querying
    const labObjectId = new mongoose.Types.ObjectId(labId);

    // 1. Query from direct Booking model
    let directQuery = { registration: labObjectId };
    if (status) directQuery.status = status;

    // 2. Query from app TestBooking model
    let appQuery = { labId: labObjectId };
    if (status) appQuery.bookingStatus = status;

    const [directBookings, appBookings] = await Promise.all([
      Booking.find(directQuery)
        .populate("patient", "name mobile email")
        .populate("tests.test", "title")
        .sort({ createdAt: -1 }),
      TestBooking.find(appQuery)
        .populate("patientId", "name mobile email")
        .populate({
          path: "labTestPricingId",
          populate: { path: "test", select: "title" }
        })
        .populate("slotId")
        .sort({ createdAt: -1 })
    ]);

    // Normalize direct bookings
    const normalizedDirect = directBookings.map(b => ({
      _id: b._id,
      source: "Website",
      bookingId: b._id.toString().slice(-8).toUpperCase(),
      patient: b.patient,
      tests: b.tests.map(t => ({ title: t.test?.title || "Test" })),
      date: b.scheduledDate || b.createdAt,
      status: b.status,
      amount: b.finalAmount,
      paymentMethod: b.paymentMethod,
      createdAt: b.createdAt
    }));

    // Normalize app bookings
    const normalizedApp = appBookings.map(b => ({
      _id: b._id,
      source: "App",
      bookingId: b.bookingId,
      patient: b.patientId,
      tests: [{ title: b.labTestPricingId?.test?.title || "Test" }],
      date: b.bookingDate,
      status: b.bookingStatus,
      amount: b.amount,
      paymentMethod: b.paymentMode,
      createdAt: b.createdAt
    }));

    let merged = [...normalizedDirect, ...normalizedApp].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Optional Search filter
    if (search) {
        const q = search.toLowerCase();
        merged = merged.filter(b => 
            b.patient?.name?.toLowerCase().includes(q) || 
            b.bookingId?.toLowerCase().includes(q)
        );
    }

    res.json({
      success: true,
      count: merged.length,
      data: merged,
    });
  } catch (error) {
    console.error("GET_MY_LAB_BOOKINGS_ERROR:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Update Booking Status (e.g. Confirm or Cancel)
 */
export const updateBookingStatus = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { bookingStatus } = req.body;
    const labId = req.user.id;

    const booking = await TestBooking.findOne({ _id: bookingId, labId });

    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found or unauthorized" });
    }

    booking.bookingStatus = bookingStatus;

    // If cancelled, free up the slot
    if (bookingStatus === "Cancelled") {
      await LabSlot.findByIdAndUpdate(booking.slotId, { isBooked: false });
    }

    await booking.save();

    res.json({
      success: true,
      message: `Booking status updated to ${bookingStatus}`,
      data: booking
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Upload Report and Complete Booking
 */
export const uploadTestReport = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const labId = req.user.id;

    if (!req.file) {
      return res.status(400).json({ success: false, message: "Please upload a report file" });
    }

    const reportPath = `uploads/reports/${req.file.filename}`;

    const booking = await TestBooking.findOne({ _id: bookingId, labId });

    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    booking.reportStatus = "Uploaded";
    booking.bookingStatus = "Completed";
    // Assuming you might want to store the report link in the booking or a separate field
    // For now, let's assume we add a 'reportFile' field to the schema or just use this logic
    booking.reportFile = reportPath;

    await booking.save();

    res.json({
      success: true,
      message: "Report uploaded and booking completed",
      data: booking
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
