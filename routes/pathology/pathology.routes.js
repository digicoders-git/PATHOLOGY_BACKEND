import express from "express";
import { loginPathology, getPathologyProfile } from "../../controllers/pathology/pathology.controller.js";
import { generateSlots, getLabSlots, deleteSlot } from "../../controllers/pathology/slot.controller.js";
import { getMyLabBookings, updateBookingStatus, uploadTestReport } from "../../controllers/pathology/bookingManagement.controller.js";
import { pathologyAuth } from "../../middleware/pathologyAuth.middleware.js";
import upload from "../../middleware/multer.js";

const router = express.Router();

router.post("/login", loginPathology);
router.get("/profile", pathologyAuth, getPathologyProfile);

// Slot Management
router.post("/generate-slots", generateSlots);
router.get("/get-slots", getLabSlots);
router.delete("/delete-slot/:id", deleteSlot);

// Booking Management
router.get("/my-bookings", pathologyAuth, getMyLabBookings);
router.patch("/update-booking-status/:bookingId", pathologyAuth, updateBookingStatus);
router.post("/upload-report/:bookingId", pathologyAuth, upload.single("testReport"), uploadTestReport);

export default router;
