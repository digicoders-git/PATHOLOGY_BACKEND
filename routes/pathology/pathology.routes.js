import express from "express";
import { loginPathology, getPathologyProfile } from "../../controllers/pathology/pathology.controller.js";
import { getAllSlots, generateSlots, getLabSlots, deleteSlot } from "../../controllers/pathology/slot.controller.js";
import { getMyLabBookings, updateBookingStatus, uploadTestReport } from "../../controllers/pathology/bookingManagement.controller.js";
import { createLabOffer, updateLabOffer, getMyOffers, getActiveLabOffers, deleteLabOffer, toggleLabOfferStatus } from "../../controllers/pathology/labOffer.controller.js";
import { pathologyAuth } from "../../middleware/pathologyAuth.middleware.js";
import upload from "../../middleware/multer.js";

const router = express.Router();

router.post("/login", loginPathology);
router.get("/profile", pathologyAuth, getPathologyProfile);

// Slot Management
router.get("/all-slots", getAllSlots);
router.post("/generate-slots", generateSlots);
router.get("/get-slots", getLabSlots);
router.delete("/delete-slot/:id", deleteSlot);

// Booking Management
router.get("/my-bookings", pathologyAuth, getMyLabBookings);
router.patch("/update-booking-status/:bookingId", pathologyAuth, updateBookingStatus);
router.post("/upload-report/:bookingId", pathologyAuth, upload.single("testReport"), uploadTestReport);

// ── Lab Offer Management ──────────────────────────────────────────────────────
// Public
router.get("/offers/active", getActiveLabOffers);                                          // GET /pathology/offers/active?labId=xxx
// Protected (lab owner)
router.get("/offers", pathologyAuth, getMyOffers);                                         // GET /pathology/offers
router.post("/offers/create", pathologyAuth, upload.single("offerImage"), createLabOffer); // POST /pathology/offers/create
router.put("/offers/update/:id", pathologyAuth, upload.single("offerImage"), updateLabOffer); // PUT /pathology/offers/update/:id
router.delete("/offers/delete/:id", pathologyAuth, deleteLabOffer);                        // DELETE /pathology/offers/delete/:id
router.patch("/offers/toggle/:id", pathologyAuth, toggleLabOfferStatus);                   // PATCH /pathology/offers/toggle/:id

export default router;
