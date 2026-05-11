import Registration from "../../model/registration.model.js";
import LabTestPricing from "../../model/labTestPricing.model.js";
import Booking from "../../model/booking.model.js";
import TestBooking from "../../model/testBooking.model.js";
import generateToken from "../../config/token.js";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";

// Helper to get local URL path
const getLocalUrl = (req, file) => {
  if (!file) return null;
  const relativePath = file.path.replace(/\\/g, "/");
  return `${req.protocol}://${req.get("host")}/${relativePath}`;
};

export const loginPathology = async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({
        success: false,
        message: "Phone and password are required",
      });
    }

    const pathology = await Registration.findOne({ phone });

    if (!pathology) {
      return res.status(404).json({
        success: false,
        message: "Pathology not found with this phone number",
      });
    }

    // Secure password check
    let isMatch = false;

    // Check if it's a bcrypt hash
    const isHash = pathology.password && pathology.password.startsWith('$2');

    if (isHash) {
      isMatch = await bcrypt.compare(password, pathology.password);
    } else {
      // Direct comparison for plain text (old data)
      isMatch = pathology.password === password;
    }

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid phone number or password",
      });
    }

    // Check if account is active
    if (!pathology.status) {
      return res.status(403).json({
        success: false,
        message: "Your account is currently inactive. Please contact administrator.",
      });
    }

    const token = generateToken(pathology._id);

    const pathologyData = pathology.toObject();
    delete pathologyData.password;

    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      data: pathologyData,
    });
  } catch (error) {
    console.error("PATHOLOGY_LOGIN_ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Server error during login",
      error: error.message,
    });
  }
};

export const getPathologyProfile = async (req, res) => {
  try {
    const pathology = await Registration.findById(req.user.id)
      .populate("parent")
      .populate("selectedTests");

    if (!pathology) {
      return res.status(404).json({ success: false, message: "Pathology not found" });
    }

    const testPricing = await LabTestPricing.find({
      registration: req.user.id,
      isDeleted: false
    }).populate("test");

    res.status(200).json({
      success: true,
      data: {
        ...pathology.toObject(),
        testPricing: testPricing,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updatePathologyProfile = async (req, res) => {
  try {
    const id = req.user.id;
    const formData = { ...req.body };

    // Check if phone or email already exists for another pathology
    if (formData.phone || formData.email) {
      const existingPathology = await Registration.findOne({
        _id: { $ne: id },
        $or: [
          ...(formData.phone ? [{ phone: formData.phone }] : []),
          ...(formData.email ? [{ email: formData.email }] : [])
        ]
      });

      if (existingPathology) {
        return res.status(400).json({
          success: false,
          message: "Phone or email already registered with another lab"
        });
      }
    }

    // Handle numbers
    if (formData.establishmentYear === "") formData.establishmentYear = null;
    if (formData.latitude) formData.latitude = Number(formData.latitude);
    if (formData.longitude) formData.longitude = Number(formData.longitude);

    if (formData.latitude && formData.longitude) {
      formData.location = {
        type: "Point",
        coordinates: [Number(formData.longitude), Number(formData.latitude)]
      };
    }

    // Handle files
    if (req.files) {
      if (req.files.labLogo) {
        formData.labLogo = getLocalUrl(req, req.files.labLogo[0]);
      }
      if (req.files.labBanner) {
        formData.labBanner = getLocalUrl(req, req.files.labBanner[0]);
      }
    }

    // Parse JSON fields
    try {
      if (typeof formData.selectedTests === "string") {
        formData.selectedTests = JSON.parse(formData.selectedTests);
      }
      if (typeof formData.Certification === "string") {
        formData.Certification = JSON.parse(formData.Certification);
      }
    } catch (e) {
      console.error("Parse error in pathology update:", e);
    }

    // Hash password if updating
    if (formData.password) {
      formData.password = await bcrypt.hash(formData.password, 10);
    }

    // Convert booleans
    ['homeCollection', 'is24x7', 'emergency', 'ambulanceService'].forEach(key => {
      if (formData[key] === "true") formData[key] = true;
      if (formData[key] === "false") formData[key] = false;
    });

    const updated = await Registration.findByIdAndUpdate(id, formData, { new: true });

    if (!updated) {
      return res.status(404).json({ success: false, message: "Pathology not found" });
    }

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: updated,
    });
  } catch (error) {
    console.error("Pathology Update Error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to update profile",
    });
  }
};

// 1. Get tests selected by the lab with their current pricing
export const getMySelectedTests = async (req, res) => {
  try {
    const labId = req.user.id;
    
    // Get lab to see selected tests
    const lab = await Registration.findById(labId).populate("selectedTests");
    if (!lab) return res.status(404).json({ success: false, message: "Lab not found" });

    // Get current pricings set by the lab
    const pricings = await LabTestPricing.find({ registration: labId, isDeleted: false });

    // Combine test details with lab-specific pricing
    const combinedData = lab.selectedTests.map(test => {
      const pricing = pricings.find(p => p.test && p.test.toString() === test._id.toString());
      return {
        _id: test._id,
        title: test.title,
        test_code: test.test_code,
        image: test.image,
        mrp: test.mrp,
        lab_price: pricing ? pricing.price : test.price,
        lab_discount_price: pricing ? pricing.discountPrice : test.price,
        discountPercent: pricing ? pricing.discountPercent : "0%",
        pricingId: pricing ? pricing._id : null
      };
    });

    res.status(200).json({
      success: true,
      data: combinedData
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 2. Update pricing for a single test
export const updateSingleTestPricing = async (req, res) => {
  try {
    const labId = req.user.id;
    const { testId, price, discountPrice, discountPercent } = req.body;

    if (!testId) {
      return res.status(400).json({ success: false, message: "testId is required" });
    }

    // Upsert pricing: Update if exists, create if not
    const pricing = await LabTestPricing.findOneAndUpdate(
      { registration: labId, test: testId },
      { 
        price, 
        discountPrice, 
        discountPercent: discountPercent || "",
        addedBy: labId,
        isDeleted: false,
        status: true
      },
      { new: true, upsert: true }
    );

    res.status(200).json({
      success: true,
      message: "Test pricing updated successfully",
      data: pricing
    });
  } catch (error) {
    console.error("Update Single Test Pricing Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
// 3. Get Lab Dashboard Analytics (Total bookings, completed, total tests, etc.)
export const getLabDashboardData = async (req, res) => {
  try {
    const labId = req.user.id;
    const labObjectId = new mongoose.Types.ObjectId(labId);

    // 1. Get Lab Details & Test Count
    const lab = await Registration.findById(labId)
      .populate("parent")
      .select("-password");

    if (!lab) {
      return res.status(404).json({ success: false, message: "Lab not found" });
    }

    // 2. Get Counts from Both Systems (Website & App)
    const [
      directTotal,
      directCompleted,
      appTotal,
      appCompleted
    ] = await Promise.all([
      Booking.countDocuments({ registration: labObjectId }),
      Booking.countDocuments({ registration: labObjectId, status: "Completed" }),
      TestBooking.countDocuments({ labId: labObjectId }),
      TestBooking.countDocuments({ labId: labObjectId, bookingStatus: "Completed" })
    ]);

    // 3. Calculate Aggregated Stats
    const totalBookings = directTotal + appTotal;
    const completedBookings = directCompleted + appCompleted;
    const pendingBookings = totalBookings - completedBookings;
    
    // Total Tests is the length of selectedTests array in Registration
    const totalTests = lab.selectedTests ? lab.selectedTests.length : 0;

    res.status(200).json({
      success: true,
      message: "Dashboard analytics fetched successfully",
      data: {
        labDetails: lab,
        stats: {
          totalBookings,
          completedBookings,
          pendingBookings,
          totalTests,
          sourceBreakdown: {
            website: {
              total: directTotal,
              completed: directCompleted,
              pending: directTotal - directCompleted
            },
            app: {
              total: appTotal,
              completed: appCompleted,
              pending: appTotal - appCompleted
            }
          }
        }
      }
    });
  } catch (error) {
    console.error("GET_LAB_DASHBOARD_DATA_ERROR:", error);
    res.status(500).json({ 
      success: false, 
      message: "Error fetching dashboard analytics",
      error: error.message 
    });
  }
};
