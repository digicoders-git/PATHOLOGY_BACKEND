import Booking from "../model/booking.model.js";
import TestBooking from "../model/testBooking.model.js";
import LabTestPricing from "../model/labTestPricing.model.js";
import TestService from "../model/testService.model.js";
import { createNotification } from "./notification.controller.js";
import { sendNotificationToUser, sendNotificationToAdmins } from "../services/notificationService.js";
import path from "path";
import fs from "fs";

// 1. Create a New Booking
export const createBooking = async (req, res) => {
  try {
    const { registration, tests, scheduledDate, sampleCollectionType, address, paymentMethod, notes, couponCode } = req.body;
    const patientId = req.user.id; // From Token

    if (!patientId || !registration || !tests || tests.length === 0) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    // Calculate total pricing based on lab-specific pricings
    let totalMrp = 0;
    let finalAmount = 0;
    const testItems = [];

    for (const testId of tests) {
      // First try to get lab-specific pricing
      let pricing = await LabTestPricing.findOne({ registration, test: testId });
      
      let basePrice = 0;
      let offPrice = 0;

      if (pricing) {
        basePrice = Number(pricing.price || 0);
        offPrice = Number(pricing.discountPrice || basePrice);
      } else {
        // Fallback: Get global test price if lab hasn't set custom price
        const globalTest = await TestService.findById(testId);
        if (globalTest) {
          basePrice = Number(globalTest.mrp || 0);
          offPrice = Number(globalTest.price || basePrice);
        }
      }

      if (basePrice > 0 || offPrice > 0) {
        totalMrp += basePrice;
        finalAmount += offPrice;
        testItems.push({
          test: testId,
          mrp: basePrice,
          price: offPrice,
        });
      }
    }

    let appliedCouponCode = "";
    let validAdminDiscount = 0;

    if (couponCode) {
      const Offer = (await import("../model/offer.model.js")).default;
      const offer = await Offer.findOne({
        couponCode: { $regex: new RegExp("^" + couponCode + "$", "i") },
        status: true
      });

      if (!offer) {
        return res.status(400).json({ success: false, message: "Invalid or inactive coupon code" });
      }

      // Expiry check
      const now = new Date();
      if (offer.validFrom && now < new Date(offer.validFrom)) {
        return res.status(400).json({ success: false, message: "This coupon is not valid yet" });
      }
      if (offer.validTo && now > new Date(offer.validTo)) {
        return res.status(400).json({ success: false, message: "This coupon has expired" });
      }

      // Lab specificity
      if (offer.labId && offer.labId.toString() !== registration.toString()) {
        return res.status(400).json({ success: false, message: "This coupon is not valid for the selected lab" });
      }

      // One-Time Use check
      const previousBooking = await Booking.findOne({
        patient: patientId,
        couponCode: { $regex: new RegExp("^" + couponCode + "$", "i") },
        status: { $ne: "Cancelled" }
      });

      if (previousBooking) {
        return res.status(400).json({ success: false, message: "You have already used this coupon" });
      }

      // Calculate discount
      let discountValue = 0;
      if (offer.discountPercent && offer.discountPercent > 0) {
        discountValue = (finalAmount * offer.discountPercent) / 100;
      } else if (offer.discountAmount && offer.discountAmount > 0) {
        discountValue = offer.discountAmount;
      }

      finalAmount = Math.max(0, finalAmount - discountValue);
      appliedCouponCode = offer.couponCode;

      // Track if it's admin sponsored
      if (!offer.labId) {
        validAdminDiscount = discountValue;
      }
    }

    const newBooking = new Booking({
      patient: patientId,
      registration,
      tests: testItems,
      totalMrp,
      totalDiscount: totalMrp - finalAmount,
      finalAmount,
      scheduledDate,
      sampleCollectionType,
      address,
      paymentMethod,
      notes,
      couponCode: appliedCouponCode,
      adminDiscountAmount: validAdminDiscount,
    });

    await newBooking.save();

    // Get lab details for notification
    const Registration = (await import("../model/registration.model.js")).default;
    const lab = await Registration.findById(registration);
    const Patient = (await import("../model/patient/patient.model.js")).default;
    const patient = await Patient.findById(patientId);

    // Get test names
    const testNames = testItems.map(t => {
      const found = testItems.find(i => i.test.toString() === t.test.toString());
      return found?.title || '';
    });
    const populatedTests = await (await import('../model/testService.model.js')).default
      .find({ _id: { $in: tests } }).select('title');
    const testTitles = populatedTests.map(t => t.title).join(', ');

    // Prepare notification data
    const notificationData = {
      type: 'new_booking',
      bookingId: newBooking._id.toString(),
      patientName: patient?.name || 'Unknown Patient',
      patientPhone: patient?.mobile || patient?.phone || 'N/A',
      labName: lab?.labName || 'Unknown Lab',
      testNames: testTitles,
      testCount: String(tests.length),
      amount: String(newBooking.finalAmount),
      scheduledDate: scheduledDate || '',
      sampleCollectionType: sampleCollectionType || '',
      paymentMethod: paymentMethod || '',
      timestamp: new Date().toISOString()
    };

    // Send notification to Lab
    if (lab && lab._id) {
      await sendNotificationToUser(
        lab._id.toString(),
        '🔔 New Booking Received!',
        `Patient: ${patient?.name || 'Patient'} | Tests: ${testTitles} | Amount: ₹${newBooking.finalAmount} | Date: ${scheduledDate}`,
        notificationData,
        'pathology'
      ).catch(err => console.error('Error sending lab notification:', err));
    }

    // Send notification to all Admins
    await sendNotificationToAdmins(
      '🔔 New Booking Created',
      `Lab: ${lab?.labName || 'Lab'} | Patient: ${patient?.name || 'Unknown'} | Tests: ${testTitles} | Amount: ₹${newBooking.finalAmount}`,
      notificationData
    ).catch(err => console.error('Error sending admin notification:', err));

    // Auto notification — fire and forget
    createNotification(
      "New Direct Booking",
      `A new test booking has been placed.`,
      "booking",
      "/dashboard/bookings",
      newBooking._id
    ).catch(() => {});

    res.status(201).json({
      success: true,
      message: "Booking created successfully",
      data: newBooking,
    });
  } catch (error) {
    console.error("CREATE_BOOKING_ERROR:", error);
    res.status(500).json({ success: false, message: "Booking creation failed: " + error.message });
  }
};

// 2. Get All Bookings (Booking + TestBooking merged)
export const getAllBookings = async (req, res) => {
  try {
    const { status, search, page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // ── Build filters ──────────────────────────────────────────
    const oldFilter = {};
    const newFilter = {};

    if (status) {
      oldFilter.status = status;
      newFilter.bookingStatus = status;
    }

    const { today, date, created_today } = req.query;

    // Get Today's Date in YYYY-MM-DD format (Local Server Time)
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate()
    ).padStart(2, "0")}`;

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

      oldFilter.scheduledDate = { $gte: startOfDay, $lte: endOfDay };
      newFilter.bookingDate = filterDate;
    }

    // 2. Filter by Creation Date
    if (created_today === "true") {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const endOfToday = new Date();
      endOfToday.setHours(23, 59, 59, 999);

      oldFilter.createdAt = { $gte: startOfToday, $lte: endOfToday };
      newFilter.createdAt = { $gte: startOfToday, $lte: endOfToday };
    }

    // ── Fetch both collections in parallel ─────────────────────
    const [oldBookings, newBookings] = await Promise.all([
      Booking.find(oldFilter)
        .populate("patient", "name mobile email")
        .populate("registration", "labName city phone")
        .populate("tests.test", "title test_code")
        .sort({ createdAt: -1 }),

      TestBooking.find(newFilter)
        .populate("patientId", "name mobile email")
        .populate("labId", "labName city phone")
        .populate({
          path: "labTestPricingId",
          populate: { path: "test", select: "title test_code" },
        })
        .populate("slotId", "date startTime endTime")
        .sort({ createdAt: -1 }),
    ]);

    // ── Normalize old Booking records ──────────────────────────
    const normalizedOld = oldBookings.map((b) => ({
      _id: b._id,
      source: "direct",
      bookingId: b._id.toString().slice(-8).toUpperCase(),
      patient: {
        name: b.patient?.name || "N/A",
        mobile: b.patient?.phone || b.patient?.mobile || "—",
        email: b.patient?.email || "—",
      },
      lab: {
        name: b.registration?.labName || "N/A",
        city: b.registration?.city || "—",
      },
      testName: b.tests?.map((t) => t.test?.title).filter(Boolean).join(", ") || "—",
      testCount: b.tests?.length || 0,
      bookingDate: b.scheduledDate || b.bookingDate,
      slotTime: null,
      amount: b.finalAmount || 0,
      totalMrp: b.totalMrp || 0,
      totalDiscount: b.totalDiscount || 0,
      couponCode: b.couponCode || "",
      adminDiscountAmount: b.adminDiscountAmount || 0,
      paymentStatus: b.paymentStatus,
      paymentMode: b.paymentMethod,
      status: b.status,
      reportFile: b.reportFile || "",
      reportStatus: b.reportFile ? "Uploaded" : "Pending",
      createdAt: b.createdAt,
    }));

    // ── Normalize new TestBooking records ──────────────────────
    const normalizedNew = newBookings.map((b) => ({
      _id: b._id,
      source: "app",
      bookingId: b.bookingId || b._id.toString().slice(-8).toUpperCase(),
      patient: {
        name: b.patientId?.name || "N/A",
        mobile: b.patientId?.mobile || "—",
        email: b.patientId?.email || "—",
      },
      lab: {
        name: b.labId?.labName || "N/A",
        city: b.labId?.city || "—",
      },
      testName: b.labTestPricingId?.test?.title || "—",
      testCount: 1,
      bookingDate: b.bookingDate,
      slotTime: b.slotId ? `${b.slotId.startTime} - ${b.slotId.endTime}` : null,
      amount: b.amount || 0,
      totalMrp: b.baseAmount || b.amount || 0,
      totalDiscount: b.totalDiscount || 0,
      couponCode: b.couponCode || "",
      adminDiscountAmount: b.adminDiscountAmount || 0,
      paymentStatus: b.paymentStatus,
      paymentMode: b.paymentMode,
      status: b.bookingStatus,
      reportFile: b.reportFile || "",
      reportStatus: b.reportStatus,
      createdAt: b.createdAt,
    }));

    // ── Merge & sort by createdAt desc ─────────────────────────
    let merged = [...normalizedOld, ...normalizedNew].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    // ── Search filter (client-friendly, on merged data) ────────
    if (search) {
      const q = search.toLowerCase();
      merged = merged.filter(
        (b) =>
          b.patient.name.toLowerCase().includes(q) ||
          b.patient.mobile.includes(q) ||
          b.lab.name.toLowerCase().includes(q) ||
          b.bookingId.toLowerCase().includes(q) ||
          b.testName.toLowerCase().includes(q)
      );
    }

    const total = merged.length;
    const paginated = merged.slice(skip, skip + parseInt(limit));

    res.status(200).json({
      success: true,
      count: total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      data: paginated,
    });
  } catch (error) {
    console.error("GET_ALL_BOOKINGS_ERROR:", error);
    res.status(500).json({ success: false, message: "Failed to fetch bookings: " + error.message });
  }
};

// 3. Get Single Booking Detail
export const getBookingById = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate("patient")
      .populate("registration")
      .populate("tests.test");

    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    // Permission Check: only if patient is populated and req.user exists
    if (req.user && req.user.id && booking.patient && booking.patient._id.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: "Unauthorized: You can only view your own bookings." });
    }

    res.status(200).json({ success: true, data: booking });
  } catch (error) {
    console.error("GET_BOOKING_ERROR:", error);
    res.status(500).json({ success: false, message: "Failed to fetch booking detail: " + error.message });
  }
};

// 4. Update Booking (Status, Payment, Schedule, etc.)
export const updateBookingStatus = async (req, res) => {
  try {
    const { status, paymentStatus, scheduledDate, notes } = req.body;
    const updateData = {};

    if (status !== undefined) updateData.status = status;
    if (paymentStatus !== undefined) updateData.paymentStatus = paymentStatus;
    if (scheduledDate !== undefined) updateData.scheduledDate = scheduledDate;
    if (notes !== undefined) updateData.notes = notes;

    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true }
    );

    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    if (booking.patient) {
      const patientId = booking.patient.toString();
      const title = 'Booking Status Updated';
      const message = `Your booking status has been updated to ${booking.status}.`;
      
      import("../model/patientNotification.model.js").then(({ default: PatientNotification }) => {
        PatientNotification.create({
          patientId: patientId,
          title: title,
          message: message,
          type: 'booking_status',
          relatedBookingId: booking._id
        }).catch(err => console.error('Error saving DB notification:', err));
      }).catch(err => {});

      sendNotificationToUser(
        patientId,
        title,
        message,
        { type: 'status_update', bookingId: booking._id.toString() },
        'patient'
      ).catch(err => console.error('Error sending patient notification:', err));
    }

    res.status(200).json({ success: true, message: "Booking updated", data: booking });
  } catch (error) {
    console.error("UPDATE_BOOKING_ERROR:", error);
    res.status(500).json({ success: false, message: "Update failed: " + error.message });
  }
};

// 6. Upload Test Report (Admin / Lab Owner)
export const uploadReport = async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({ success: false, message: "No report file provided" });
    }

    const reportPath = req.file.path.replace(/\\/g, "/");

    // Try Booking (direct) first
    let booking = await Booking.findById(id);
    if (booking) {
      if (booking.status !== "Completed") {
        return res.status(400).json({ success: false, message: "Please mark the booking as Completed before uploading the report" });
      }
      booking.reportFile = reportPath;
      booking.reportUploadedAt = new Date();
      booking.reportStatus = "Uploaded";
      booking.status = "Completed";
      await booking.save();

      // Notify Patient
      if (booking.patient) {
        const patientId = booking.patient.toString();
        const title = 'Report Uploaded';
        const message = 'Your test report is now available to download.';
        
        import("../model/patientNotification.model.js").then(({ default: PatientNotification }) => {
          PatientNotification.create({
            patientId: patientId,
            title: title,
            message: message,
            type: 'report_ready',
            relatedBookingId: booking._id
          }).catch(err => console.error('Error saving DB notification:', err));
        }).catch(err => {});

        await sendNotificationToUser(
          patientId, 
          title, 
          message, 
          { type: 'report_uploaded', bookingId: id }, 
          'patient'
        ).catch(err => console.error('Error sending patient notification:', err));
      }

      return res.status(200).json({ success: true, message: "Report uploaded successfully", data: booking });
    }

    // Try TestBooking (app)
    let testBooking = await TestBooking.findById(id);
    if (testBooking) {
      if (testBooking.bookingStatus !== "Completed") {
        return res.status(400).json({ success: false, message: "Please mark the booking as Completed before uploading the report" });
      }
      testBooking.reportFile = reportPath;
      testBooking.reportStatus = "Uploaded";
      testBooking.bookingStatus = "Completed";
      await testBooking.save();

      // Notify Patient
      if (testBooking.patientId) {
        const patientId = testBooking.patientId.toString();
        const title = 'Report Uploaded';
        const message = 'Your test report is now available to download.';

        import("../model/patientNotification.model.js").then(({ default: PatientNotification }) => {
          PatientNotification.create({
            patientId: patientId,
            title: title,
            message: message,
            type: 'report_ready',
            relatedBookingId: testBooking._id
          }).catch(err => console.error('Error saving DB notification:', err));
        }).catch(err => {});

        await sendNotificationToUser(
          patientId, 
          title, 
          message, 
          { type: 'report_uploaded', bookingId: id }, 
          'patient'
        ).catch(err => console.error('Error sending patient notification:', err));
      }

      return res.status(200).json({ success: true, message: "Report uploaded successfully", data: testBooking });
    }

    return res.status(404).json({ success: false, message: "Booking not found" });
  } catch (error) {
    console.error("UPLOAD_REPORT_ERROR:", error);
    res.status(500).json({ success: false, message: "Upload failed: " + error.message });
  }
};

// 5. Delete Booking
export const deleteBooking = async (req, res) => {
  try {
    const booking = await Booking.findByIdAndDelete(req.params.id);
    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }
    res.status(200).json({ success: true, message: "Booking deleted successfully" });
  } catch (error) {
    console.error("DELETE_BOOKING_ERROR:", error);
    res.status(500).json({ success: false, message: "Deletion failed: " + error.message });
  }
};

// 7. Download Report — Patient only (verifies ownership)
export const downloadReport = async (req, res) => {
  try {
    const { id } = req.params;
    const patientId = req.user.id;

    // Check in Booking (direct)
    let booking = await Booking.findOne({ _id: id, patient: patientId });
    let reportFile = booking?.reportFile;

    // Check in TestBooking (app) if not found above
    if (!booking) {
      const testBooking = await TestBooking.findOne({ _id: id, patientId });
      reportFile = testBooking?.reportFile;
      if (!testBooking) {
        return res.status(403).json({ success: false, message: "Unauthorized: This report does not belong to you" });
      }
    }

    if (!reportFile) {
      return res.status(404).json({ success: false, message: "Report not uploaded yet" });
    }

    const filePath = path.join(process.cwd(), reportFile);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: "Report file not found on server" });
    }

    res.download(filePath);
  } catch (error) {
    console.error("DOWNLOAD_REPORT_ERROR:", error);
    res.status(500).json({ success: false, message: "Download failed: " + error.message });
  }
};
