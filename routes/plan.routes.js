import express from "express";
import { createPlan, getPlans, updatePlan, reorderPlans, deletePlan, togglePlanStatus, createPlanPurchaseOrder, verifyPlanPurchase, getLabBookingStats, purchasePlanWithWallet } from "../controllers/plan.controller.js";
import { verifyAdminToken } from "../middleware/verifyAdminToken.js";
import { pathologyAuth } from "../middleware/pathologyAuth.middleware.js";

import upload from "../middleware/multer.js";

const router = express.Router();

// Public: Website needs this to show plans
router.get("/get", getPlans);

// Protected: Only Admin can modify
router.post("/create", verifyAdminToken, upload.single("offerBadge"), createPlan);
router.put("/reorder", verifyAdminToken, reorderPlans);
router.put("/:id", verifyAdminToken, upload.single("offerBadge"), updatePlan);
router.delete("/:id", verifyAdminToken, deletePlan);
router.patch("/:id/status", verifyAdminToken, togglePlanStatus);

// Protected: Lab can purchase and view stats
router.post("/purchase/order", pathologyAuth, createPlanPurchaseOrder);
router.post("/purchase/verify", pathologyAuth, verifyPlanPurchase);
router.post("/purchase/wallet", pathologyAuth, purchasePlanWithWallet);
router.get("/stats", pathologyAuth, getLabBookingStats);

export default router;
