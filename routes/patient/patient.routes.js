import express from "express";
import { sendOtp, verifyOtp, updateProfile, getProfile, updateStatus, getAllPatients, getAllTestPricingForPatient } from "../../controllers/patient/patient.controller.js";
import { patientAuth, patientAdminAuth } from "../../middleware/patientAuth.middleware.js";
import { verifyAdminToken } from "../../middleware/verifyAdminToken.js";
import upload from "../../middleware/multer.js";

const router = express.Router();

// Public routes
router.post("/send-otp", sendOtp);
router.post("/verify-otp", verifyOtp);
router.get("/all-tests", getAllTestPricingForPatient);

// Protected routes
router.get("/profile", patientAuth, getProfile);
router.put("/update-profile", patientAdminAuth, upload.single('profilePhoto'), updateProfile);

// Admin only routes
router.get("/all-patients", verifyAdminToken, getAllPatients);
router.patch("/update-status/:id", verifyAdminToken, updateStatus);

export default router;
