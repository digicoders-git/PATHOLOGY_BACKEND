import TestBooking from "../../model/testBooking.model.js";
import LabSlot from "../../model/labSlot.model.js";

/**
 * Get all bookings for the logged-in Pathology Lab
 */
export const getMyLabBookings = async (req, res) => {
  try {
    const labId = req.user.id; // From pathologyAuth middleware
    const { status, bookingId, date } = req.query;

    let query = { labId };

    if (status) query.bookingStatus = status;
    if (bookingId) query.bookingId = { $regex: bookingId, $options: "i" };
    if (date) query.bookingDate = date;

    const bookings = await TestBooking.find(query)
      .populate("patientId", "name mobile email age gender")
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
