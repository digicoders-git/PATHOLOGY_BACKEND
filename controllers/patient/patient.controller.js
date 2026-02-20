import Patient from "../../model/patient/patient.model.js";
import Otp from "../../model/patient/otp.model.js";
import LabTestPricing from "../../model/labTestPricing.model.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

export const sendOtp = async (req, res) => {
  try {
    const { mobile } = req.body;

    if (!mobile) {
      return res.status(400).json({ success: false, message: "Mobile number is required" });
    }

    // Indian mobile validation (10 digits, starts with 6-9)
    const mobileRegex = /^[6-9]\d{9}$/;
    if (!mobileRegex.test(mobile)) {
      return res.status(400).json({ success: false, message: "Please enter a valid 10-digit Indian mobile number (6-9 starting)" });
    }

    // Generate 4 digit OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    console.log(`OTP for ${mobile}: ${otp}`);

    await Otp.deleteMany({ mobile });
    await Otp.create({ mobile, otp });

    res.json({
      success: true,
      message: "OTP sent successfully (Check console)",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const verifyOtp = async (req, res) => {
  try {
    const { mobile, otp } = req.body;

    if (!mobile || !otp) {
      return res.status(400).json({ success: false, message: "Mobile and OTP are required" });
    }

    const otpData = await Otp.findOne({ mobile, otp });

    if (!otpData) {
      return res.status(400).json({ success: false, message: "Invalid or expired OTP" });
    }

    let patient = await Patient.findOne({ mobile });

    if (!patient) {
      patient = await Patient.create({ mobile });
    }

    const token = jwt.sign(
      { id: patient._id },
      process.env.JWT_SECRET || 'your_default_secret'
    );

    await Otp.deleteOne({ _id: otpData._id });

    res.json({
      success: true,
      message: "Login successful",
      token,
      patient,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateProfile = async (req, res) => {
  try {
    // If patientId is provided in body, and we use patientAdminAuth, 
    // we can allow admin to update a specific patient.
    // If not, it defaults to the logged-in user's ID (self-update).
    const id = req.body.patientId || req.user.id;
    const updateData = { ...req.body };

    // Validations handled by Schema, but additional checks for file
    if (req.file) {
      updateData.profileImage = `uploads/profiles/${req.file.filename}`;
    }

    // Double check name validation manually if needed for better error message
    // if (updateData.name && updateData.name.trim().split(/\s+/).length < 1) {
    //   return res.status(400).json({ success: false, message: "Name must contain at least two words (e.g., First Last)" });
    // }

    const patient = await Patient.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!patient) {
      return res.status(404).json({ success: false, message: "Patient not found" });
    }

    res.json({
      success: true,
      message: "Profile updated successfully",
      patient,
    });
  } catch (error) {
    // Catch Mongoose validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({ success: false, message: messages[0] });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const patient = await Patient.findById(id);

    if (!patient) {
      return res.status(404).json({ success: false, message: "Patient not found" });
    }

    // Toggle logic: if true -> false, if false -> true
    patient.isActive = !patient.isActive;

    await patient.save();

    res.json({
      success: true,
      message: `Patient status toggled to ${patient.isActive ? 'Active' : 'Inactive'}`,
      patient,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAllPatients = async (req, res) => {
  try {
    const { search, name, email, mobile, age, address, isActive } = req.query;

    let query = {};

    // Global Search (Multiple fields)
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { mobile: { $regex: search, $options: "i" } },
        { address: { $regex: search, $options: "i" } },
      ];
    }

    // Specific Filters
    if (name) query.name = { $regex: name, $options: "i" };
    if (email) query.email = { $regex: email, $options: "i" };
    if (mobile) query.mobile = { $regex: mobile, $options: "i" };
    if (age) query.age = age;
    if (address) query.address = { $regex: address, $options: "i" };
    if (isActive !== undefined) query.isActive = isActive === "true";

    const patients = await Patient.find(query).sort({ createdAt: -1 });

    res.json({
      success: true,
      count: patients.length,
      patients,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getProfile = async (req, res) => {
  try {
    const id = req.user.id;
    const patient = await Patient.findById(id);

    if (!patient) {
      return res.status(404).json({ success: false, message: "Patient not found" });
    }

    res.json({
      success: true,
      patient,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAllTestPricingForPatient = async (req, res) => {
  try {
    const { search, minPrice, maxPrice, labId } = req.query;

    let query = {
      status: true,
      isDeleted: false,
    };

    if (labId) {
      query.registration = labId;
    }

    if (minPrice || maxPrice) {
      query.$and = query.$and || [];
      if (minPrice) query.$and.push({ price: { $gte: minPrice } });
      if (maxPrice) query.$and.push({ price: { $lte: maxPrice } });
    }

    // Search by test title or lab name
    if (search) {
      const TestService = mongoose.model("TestService");
      const Registration = mongoose.model("Registration");

      const [tests, labs] = await Promise.all([
        TestService.find({ title: { $regex: search, $options: "i" } }).select("_id"),
        Registration.find({ labName: { $regex: search, $options: "i" } }).select("_id"),
      ]);

      const testIds = tests.map((t) => t._id);
      const labIds = labs.map((l) => l._id);

      query.$or = [
        { test: { $in: testIds } },
        { registration: { $in: labIds } },
      ];
    }

    const pricings = await LabTestPricing.find(query)
      .populate("test")
      .populate({
        path: "registration",
        select: "labName labLogo fullAddress city areaName phone email",
      })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: pricings.length,
      data: pricings,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
