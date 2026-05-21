import express from "express";
import { createPlan, getPlans, updatePlan, deletePlan, purchasePlan, getLabBookingStats } from "../controllers/plan.controller.js";
import { verifyAdminToken } from "../middleware/verifyAdminToken.js";
import { pathologyAuth } from "../middleware/pathologyAuth.middleware.js";

const router = express.Router();

// Public: Website needs this to show plans
router.get("/get", getPlans);

// Protected: Only Admin can modify
router.post("/create", verifyAdminToken, createPlan);
router.put("/:id", verifyAdminToken, updatePlan);
router.delete("/:id", verifyAdminToken, deletePlan);

// Protected: Lab can purchase and view stats
router.post("/purchase", pathologyAuth, purchasePlan);
router.get("/stats", pathologyAuth, getLabBookingStats);

export default router;
