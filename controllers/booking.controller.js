import Booking from "../model/booking.model.js";
import LabTestPricing from "../model/labTestPricing.model.js";
import TestService from "../model/testService.model.js";

// 1. Create a New Booking
export const createBooking = async (req, res) => {
  try {
    const { registration, tests, scheduledDate, sampleCollectionType, address, paymentMethod, notes } = req.body;
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
    });

    await newBooking.save();

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

// 2. Get All Bookings (with optional filters)
export const getAllBookings = async (req, res) => {
  try {
    const { status, patientId, registrationId } = req.query;
    const filter = {};
    
    // Role-based filtering
    if (req.admin) {
        // Super Admin: sees everything
        if (patientId) filter.patient = patientId;
        if (registrationId) filter.registration = registrationId;
    } else if (req.user && req.user.id) {
        // Either Patient or Lab Owner (both set req.user.id)
        // Check if its a Lab by checking registrationId vs user ID or context
        // We'll assume if it's not Admin, we check the token payload or model type later
        // But for now, if patient query exists, its likely a Patient or Admin
        
        // Better: Lab Owner usually has different set of requirements
        // We can check if req.user has labName (set in pathologyAuth)
        if (req.user.labName) {
            filter.registration = req.user.id; // Lab sees only their bookings
            if (patientId) filter.patient = patientId; // Lab can filter by patient
        } else {
            filter.patient = req.user.id; // Patient sees only their bookings
            if (registrationId) filter.registration = registrationId;
        }
    }

    if (status) filter.status = status;
    if (registrationId) filter.registration = registrationId;

    const bookings = await Booking.find(filter)
      .populate("patient", "name phone email")
      .populate("registration", "labName fullAddress labLogo")
      .populate("tests.test", "title test_code image")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: bookings.length,
      data: bookings,
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

    // Permission Check: If Patient, they can ONLY see their own booking
    if (req.user && req.user.id && booking.patient._id.toString() !== req.user.id) {
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

    res.status(200).json({ success: true, message: "Booking updated", data: booking });
  } catch (error) {
    console.error("UPDATE_BOOKING_ERROR:", error);
    res.status(500).json({ success: false, message: "Update failed: " + error.message });
  }
};

// 6. Upload Test Report (Lab Owner / Admin)
export const uploadReport = async (req, res) => {
    try {
        const { id } = req.params;
        const labId = req.user.id; // From pathologyAuth

        // Find booking first to check ownership
        const bookingCheck = await Booking.findById(id);
        if (!bookingCheck) {
            return res.status(404).json({ success: false, message: "Booking not found" });
        }

        // Security Check: Is this lab authorised to upload for this booking?
        if (bookingCheck.registration.toString() !== labId.toString()) {
            return res.status(403).json({ success: false, message: "Unauthorized: You can only upload reports for your own lab bookings." });
        }

        if (!req.file) {
            return res.status(400).json({ success: false, message: "No report file provided" });
        }

        const reportPath = req.file.path.replace(/\\/g, "/"); // Standardize path

        const booking = await Booking.findByIdAndUpdate(
            id,
            { 
                $set: { 
                    reportFile: reportPath,
                    reportUploadedAt: new Date(),
                    status: "Completed", // Auto set to completed on report upload
                } 
            },
            { new: true }
        );

        if (!booking) {
            return res.status(404).json({ success: false, message: "Booking not found" });
        }

        res.status(200).json({ 
            success: true, 
            message: "Report uploaded and booking marked as Completed", 
            data: booking 
        });
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
