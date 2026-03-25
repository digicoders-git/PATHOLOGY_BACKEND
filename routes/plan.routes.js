import express from "express";
import { createPlan, getPlans, updatePlan, deletePlan } from "../controllers/plan.controller.js";
import { verifyAdminToken } from "../middleware/verifyAdminToken.js";

const router = express.Router();

// Public: Website needs this to show plans
router.get("/get", getPlans);

// Protected: Only Admin can modify
router.post("/create", verifyAdminToken, createPlan);
router.put("/:id", verifyAdminToken, updatePlan);
router.delete("/:id", verifyAdminToken, deletePlan);

export default router;
