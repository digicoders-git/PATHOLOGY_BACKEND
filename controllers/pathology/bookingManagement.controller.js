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
    const { status, search, today, date, created_today } = req.query;

    // Explicitly cast to ObjectId for safer querying
    const labObjectId = new mongoose.Types.ObjectId(labId);

    // ── Build Filter Queries ─────────────────────────────────────
    let directQuery = { registration: labObjectId };
    let appQuery = { labId: labObjectId };

    if (status) {
      directQuery.status = status;
      appQuery.bookingStatus = status;
    }

    // Get Today's Date in YYYY-MM-DD format (Local Server Time)
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    // 1. Filter by Appointment/Scheduled Date
    let filterDate = date;
    if (today === "true") {
      filterDate = todayStr;
    }

    if (filterDate) {
      const startOfDay = new Date(filterDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(filterDate);
      endOfDay.setHours(23, 59, 59, 999);
      
      directQuery.scheduledDate = { $gte: startOfDay, $lte: endOfDay };
      appQuery.bookingDate = filterDate;
    }

    // 2. Filter by Creation Date (New Filter)
    if (created_today === "true") {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const endOfToday = new Date();
      endOfToday.setHours(23, 59, 59, 999);

      directQuery.createdAt = { $gte: startOfToday, $lte: endOfToday };
      appQuery.createdAt = { $gte: startOfToday, $lte: endOfToday };
    }

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
 * Update Booking Status (e.g. Confirm or Cancel) - Supports both systems
 */
export const updateBookingStatus = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { status } = req.body; // Using 'status' in body for consistency
    const labId = req.user.id;

    if (!status) return res.status(400).json({ success: false, message: "status is required" });

    // 1. Try to find and update in direct Booking model
    let booking = await Booking.findOne({ _id: bookingId, registration: labId });
    if (booking) {
      booking.status = status;
      await booking.save();
      return res.json({
        success: true,
        message: `Website booking status updated to ${status}`,
        data: booking
      });
    }

    // 2. Try to find and update in app TestBooking model
    let appBooking = await TestBooking.findOne({ _id: bookingId, labId });
    if (appBooking) {
      appBooking.bookingStatus = status;

      // If cancelled, free up the slot
      if (status === "Cancelled" && appBooking.slotId) {
        await LabSlot.findByIdAndUpdate(appBooking.slotId, { isBooked: false });
      }

      await appBooking.save();
      return res.json({
        success: true,
        message: `App booking status updated to ${status}`,
        data: appBooking
      });
    }

    return res.status(404).json({ success: false, message: "Booking not found or unauthorized" });

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
