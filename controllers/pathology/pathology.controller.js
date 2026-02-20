import Registration from "../../model/registration.model.js";
import LabTestPricing from "../../model/labTestPricing.model.js";
import generateToken from "../../config/token.js";
import bcrypt from "bcryptjs";

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

    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      data: {
        id: pathology._id,
        labName: pathology.labName,
        ownerName: pathology.ownerName,
        phone: pathology.phone,
        email: pathology.email,
        labLogo: pathology.labLogo,
      },
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
