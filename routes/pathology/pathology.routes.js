import express from "express";
import { loginPathology, getPathologyProfile, updatePathologyProfile, getMySelectedTests, updateSingleTestPricing, getLabDashboardData } from "../../controllers/pathology/pathology.controller.js";
import { getAllSlots, generateSlots, getLabSlots, deleteSlot } from "../../controllers/pathology/slot.controller.js";
import { getMyLabBookings, updateBookingStatus, uploadTestReport, getSingleBookingDetails, getLabReports } from "../../controllers/pathology/bookingManagement.controller.js";
import { createLabOffer, updateLabOffer, getMyOffers, getActiveLabOffers, deleteLabOffer, toggleLabOfferStatus } from "../../controllers/pathology/labOffer.controller.js";
import { submitLabSupportQuery, getMyLabSupportQueries } from "../../controllers/pathology/support.controller.js";
import { savePathologyFCMToken, removePathologyFCMToken } from "../../controllers/pathology/fcm.controller.js";
import { pathologyAuth } from "../../middleware/pathologyAuth.middleware.js";
import upload from "../../middleware/multer.js";

const router = express.Router();

// Define multple file fields
const cpUpload = upload.fields([
  { name: "labLogo", maxCount: 1 },
  { name: "labBanner", maxCount: 1 },
]);

router.post("/login", loginPathology);
router.get("/profile", pathologyAuth, getPathologyProfile);
router.put("/update-profile", pathologyAuth, cpUpload, updatePathologyProfile);
router.get("/my-tests", pathologyAuth, getMySelectedTests);
router.put("/update-test-pricing", pathologyAuth, updateSingleTestPricing);
router.get("/dashboard-stats", pathologyAuth, getLabDashboardData);

// Slot Management
router.get("/all-slots", getAllSlots);
router.post("/generate-slots", generateSlots);
router.get("/get-slots", getLabSlots);
router.delete("/delete-slot/:id", deleteSlot);

// Booking Management
router.get("/my-bookings", pathologyAuth, getMyLabBookings);
router.get("/booking-details/:bookingId", pathologyAuth, getSingleBookingDetails);
router.patch("/update-booking-status/:bookingId", pathologyAuth, updateBookingStatus);
router.post("/upload-report/:bookingId", pathologyAuth, upload.single("testReport"), uploadTestReport);
router.get("/all-reports", pathologyAuth, getLabReports);

// ── Lab Offer Management ──────────────────────────────────────────────────────
// Public
router.get("/offers/active", getActiveLabOffers);                                          // GET /pathology/offers/active?labId=xxx
// Protected (lab owner)
router.get("/offers", pathologyAuth, getMyOffers);                                         // GET /pathology/offers
router.post("/offers/create", pathologyAuth, upload.single("offerImage"), createLabOffer); // POST /pathology/offers/create
router.put("/offers/update/:id", pathologyAuth, upload.single("offerImage"), updateLabOffer); // PUT /pathology/offers/update/:id
router.delete("/offers/delete/:id", pathologyAuth, deleteLabOffer);                        // DELETE /pathology/offers/delete/:id
router.patch("/offers/toggle/:id", pathologyAuth, toggleLabOfferStatus);                   // PATCH /pathology/offers/toggle/:id

// ── Support / Contact ─────────────────────────────────────────────────────────
router.post("/support", pathologyAuth, submitLabSupportQuery);
router.get("/support", pathologyAuth, getMyLabSupportQueries);

// ── Wallet / Transactions ───────────────────────────────────────────────────
import { getMyWalletTransactions } from "../../controllers/pathology/wallet.controller.js";
router.get("/wallet-transactions", pathologyAuth, getMyWalletTransactions);

// ── FCM Notification ─────────────────────────────────────────────────────────
router.post("/fcm/save", pathologyAuth, savePathologyFCMToken);
router.post("/fcm/remove", pathologyAuth, removePathologyFCMToken);

// ── In-App Notifications ───────────────────────────────────────────────────
import { getMyNotifications, getUnreadCount, markAsRead } from "../../controllers/pathology/notification.controller.js";
router.get("/notifications", pathologyAuth, getMyNotifications);
router.get("/notifications/unread", pathologyAuth, getUnreadCount);
router.put("/notifications/:id/read", pathologyAuth, markAsRead);

export default router;
