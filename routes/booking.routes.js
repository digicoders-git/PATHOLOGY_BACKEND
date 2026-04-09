import express from "express";
import jwt from "jsonwebtoken";
import {
  createBooking,
  getAllBookings,
  getBookingById,
  updateBookingStatus,
  uploadReport,
  deleteBooking,
  downloadReport,
} from "../controllers/booking.controller.js";
import { patientAuth } from "../middleware/patientAuth.middleware.js";
import { verifyAdminToken } from "../middleware/verifyAdminToken.js";
import { pathologyAuth } from "../middleware/pathologyAuth.middleware.js";
import upload from "../middleware/multer.js";

const router = express.Router();

// Combined Auth Middleware
const combinedAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "No token" });
  
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Determine Role
    if (decoded.id_admin || decoded.role === 'admin') { 
        req.admin = decoded;
    } else {
        req.user = decoded;
    }
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid session" });
  }
};

// 1. Create Booking (Patient Token)
router.post("/create", patientAuth, createBooking);

// 2. Get All Bookings (Admin sees all, Patient sees own, Lab sees own)
router.get("/get", combinedAuth, getAllBookings);

// 3. Get Specific Detail
router.get("/get/:id", combinedAuth, getBookingById);

// 4. Update Status (System Admin / Lab Owner)
router.put("/status/:id", combinedAuth, updateBookingStatus);

// 5. Upload Test Report (Admin Only from admin panel)
router.post("/upload-report/:id", verifyAdminToken, upload.single("testReport"), uploadReport);

// 6. Delete (Admin Only)
router.delete("/:id", verifyAdminToken, deleteBooking);

// 7. Download Report (Patient Only — verifies ownership)
router.get("/download-report/:id", patientAuth, downloadReport);

export default router;
