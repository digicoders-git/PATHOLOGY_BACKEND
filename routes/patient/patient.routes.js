import express from "express";
import { sendOtp, verifyOtp, updateProfile, getProfile, updateStatus, getAllPatients, getAllTestPricingForPatient } from "../../controllers/patient/patient.controller.js";
import { getAvailableSlots, bookTest, getMyBookings } from "../../controllers/patient/booking.controller.js";
import { patientAuth, patientAdminAuth } from "../../middleware/patientAuth.middleware.js";
import { verifyAdminToken } from "../../middleware/verifyAdminToken.js";
import upload from "../../middleware/multer.js";

const router = express.Router();

// Public routes
router.post("/send-otp", sendOtp);
router.post("/verify-otp", verifyOtp);
router.get("/all-tests", getAllTestPricingForPatient);
router.get("/slots", getAvailableSlots);

// Protected routes
router.get("/profile", patientAuth, getProfile);
router.put("/update-profile", patientAdminAuth, upload.single('profilePhoto'), updateProfile);
router.post("/book-test", patientAuth, bookTest);
router.get("/my-bookings", patientAuth, getMyBookings);

// Admin only routes
router.get("/all-patients", verifyAdminToken, getAllPatients);
router.patch("/update-status/:id", verifyAdminToken, updateStatus);

export default router;
