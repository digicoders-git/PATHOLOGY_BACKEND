import express from "express";
import {
  createPackage,
  getAllPackages,
  getSinglePackage,
  updatePackage,
  deletePackage,
  togglePackageStatus,
  setFreeBookingsForLab,
  getAllLabSubscriptions,
  getMySubscription,
  createPurchaseOrder,
  verifyPaymentAndActivate,
  acceptBooking,
  declineBooking,
  generateTestSignature,
} from "../../controllers/admin/managePackage.controller.js";
import { verifyAdminToken } from "../../middleware/verifyAdminToken.js";
import { pathologyAuth } from "../../middleware/pathologyAuth.middleware.js";

const router = express.Router();

// ── Admin: Package CRUD ───────────────────────────────────────────────────────
router.post("/create", verifyAdminToken, createPackage);
router.get("/", getAllPackages);                                    // Public — show on website/app
router.get("/subscriptions", verifyAdminToken, getAllLabSubscriptions);
router.get("/:id", getSinglePackage);
router.put("/:id", verifyAdminToken, updatePackage);
router.delete("/:id", verifyAdminToken, deletePackage);
router.patch("/status/:id", verifyAdminToken, togglePackageStatus);

// ── Admin: Set free bookings for a specific lab ───────────────────────────────
router.post("/set-free-bookings", verifyAdminToken, setFreeBookingsForLab);

// ── Lab: Subscription ─────────────────────────────────────────────────────────
router.get("/my/subscription", pathologyAuth, getMySubscription);
router.post("/purchase/order", pathologyAuth, createPurchaseOrder);
router.post("/purchase/verify", pathologyAuth, verifyPaymentAndActivate);

// ── Lab: Booking Accept / Decline ─────────────────────────────────────────────
router.post("/booking/accept", pathologyAuth, acceptBooking);
router.post("/booking/decline", pathologyAuth, declineBooking);

// ── Test Helper: Generate Signature (For Testing Only) ────────────────────────
router.post("/test/generate-signature", generateTestSignature);

export default router;
