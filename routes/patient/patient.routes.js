import express from "express";
import { sendOtp, verifyOtp, updateProfile, getProfile, updateStatus, getAllPatients, getAllTestPricingForPatient } from "../../controllers/patient/patient.controller.js";
import { getAvailableSlots, bookTest, getMyBookings } from "../../controllers/patient/booking.controller.js";
import { getMyTransactions } from "../../controllers/patient/transaction.controller.js";
import { submitSupportQuery, getMySupportQueries } from "../../controllers/patient/support.controller.js";
import { getMyNotifications, markNotificationAsRead, markAllNotificationsAsRead, savePatientFCMToken, removePatientFCMToken } from "../../controllers/patient/patientNotification.controller.js";
import { downloadReport } from "../../controllers/booking.controller.js";
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
router.get("/transactions", patientAuth, getMyTransactions);
router.get("/download-report/:id", patientAuth, downloadReport);

// Support / Contact routes
router.post("/support", patientAuth, submitSupportQuery);
router.get("/support", patientAuth, getMySupportQueries);

// Notification routes
router.get("/notifications", patientAuth, getMyNotifications);
router.patch("/notifications/mark-all-read", patientAuth, markAllNotificationsAsRead);
router.patch("/notifications/:id/read", patientAuth, markNotificationAsRead);
router.post("/fcm/save", patientAuth, savePatientFCMToken);
router.post("/fcm/remove", patientAuth, removePatientFCMToken);

// Admin only routes
router.get("/all-patients", verifyAdminToken, getAllPatients);
router.patch("/update-status/:id", verifyAdminToken, updateStatus);

export default router;
