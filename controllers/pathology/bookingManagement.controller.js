import TestBooking from "../../model/testBooking.model.js";
import Booking from "../../model/booking.model.js";
import Patient from "../../model/patient/patient.model.js";
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
 * Get Full Details of a Single Booking
 */
export const getSingleBookingDetails = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const labId = req.user.id;

    // 1. Check in Website Booking model
    let booking = await Booking.findOne({ _id: bookingId, registration: labId })
      .populate("patient", "name mobile email age gender address")
      .populate("tests.test");

    if (booking) {
      return res.json({
        success: true,
        source: "Website",
        data: booking
      });
    }

    // 2. Check in App TestBooking model
    let appBooking = await TestBooking.findOne({ _id: bookingId, labId })
      .populate("patientId", "name mobile email age gender")
      .populate({
        path: "labTestPricingId",
        populate: { path: "test" }
      })
      .populate("slotId");

    if (appBooking) {
      return res.json({
        success: true,
        source: "App",
        data: appBooking
      });
    }

    return res.status(404).json({ success: false, message: "Booking not found or unauthorized" });

  } catch (error) {
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
 * Get all uploaded reports for the lab (Past & Present)
 */
export const getLabReports = async (req, res) => {
  try {
    const labId = req.user.id;
    const labObjectId = new mongoose.Types.ObjectId(labId);

    // Fetch bookings from both systems where reportFile is present
    const [directBookings, appBookings] = await Promise.all([
      Booking.find({
        registration: labObjectId,
        reportFile: { $exists: true, $ne: "", $ne: null }
      })
      .populate("patient", "name mobile email age gender")
      .sort({ reportUploadedAt: -1 }),
      
      TestBooking.find({
        labId: labObjectId,
        reportFile: { $exists: true, $ne: "", $ne: null }
      })
      .populate("patientId", "name mobile email age gender")
      .populate({
        path: "labTestPricingId",
        populate: { path: "test", select: "title" }
      })
      .sort({ updatedAt: -1 })
    ]);

    // Normalize direct bookings
    const normalizedDirect = directBookings.map(b => ({
      _id: b._id,
      source: "Website",
      bookingId: b._id.toString().slice(-8).toUpperCase(),
      patient: b.patient ? {
        name: b.patient.name || "N/A",
        mobile: b.patient.mobile || "N/A",
        email: b.patient.email || "N/A",
        age: b.patient.age || 0,
        gender: b.patient.gender || "N/A"
      } : { name: "Patient Not Found", mobile: "N/A" },
      tests: b.tests.map(t => ({ title: t.test?.title || "Test" })),
      reportFile: b.reportFile,
      uploadedAt: b.reportUploadedAt || b.updatedAt,
      status: b.status
    }));

    // Normalize app bookings
    const normalizedApp = appBookings.map(b => ({
      _id: b._id,
      source: "App",
      bookingId: b.bookingId,
      patient: b.patientId ? {
        name: b.patientId.name || "N/A",
        mobile: b.patientId.mobile || "N/A",
        email: b.patientId.email || "N/A",
        age: b.patientId.age || 0,
        gender: b.patientId.gender || "N/A"
      } : { name: "Patient Not Found", mobile: "N/A" },
      tests: [{ title: b.labTestPricingId?.test?.title || "Test" }],
      reportFile: b.reportFile,
      uploadedAt: b.updatedAt,
      status: b.bookingStatus
    }));

    // Merge and sort by upload date
    const mergedReports = [...normalizedDirect, ...normalizedApp].sort(
      (a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt)
    );

    res.status(200).json({
      success: true,
      count: mergedReports.length,
      data: mergedReports
    });
  } catch (error) {
    console.error("GET_LAB_REPORTS_ERROR:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const uploadTestReport = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const labId = req.user.id;

    if (!req.file) {
      return res.status(400).json({ success: false, message: "Please upload a report file" });
    }

    const reportPath = `uploads/reports/${req.file.filename}`;

    // 1. Try to find and update in direct Booking model
    let booking = await Booking.findOne({ _id: bookingId, registration: labId });
    if (booking) {
      if (booking.status !== "Completed") {
        return res.status(400).json({ success: false, message: "Please mark the booking as Completed before uploading the report" });
      }
      booking.reportFile = reportPath;
      booking.reportUploadedAt = new Date();
      booking.reportStatus = "Uploaded";
      booking.status = "Completed";
      await booking.save();
      return res.json({
        success: true,
        message: "Report uploaded and direct booking completed",
        data: booking
      });
    }

    // 2. Try to find and update in app TestBooking model
    let appBooking = await TestBooking.findOne({ _id: bookingId, labId });
    if (appBooking) {
      if (appBooking.bookingStatus !== "Completed") {
        return res.status(400).json({ success: false, message: "Please mark the booking as Completed before uploading the report" });
      }
      appBooking.reportFile = reportPath;
      appBooking.reportStatus = "Uploaded";
      appBooking.bookingStatus = "Completed";
      await appBooking.save();
      return res.json({
        success: true,
        message: "Report uploaded and app booking completed",
        data: appBooking
      });
    }

    return res.status(404).json({ success: false, message: "Booking not found or unauthorized" });
  } catch (error) {
    console.error("UPLOAD_TEST_REPORT_ERROR:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
