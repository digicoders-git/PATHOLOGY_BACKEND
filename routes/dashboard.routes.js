import express from "express";
import { getDashboardStats, getSettings, updateSetting } from "../controllers/dashboard.controller.js";
import { verifyAdminToken } from "../middleware/verifyAdminToken.js";

const router = express.Router();

router.get("/stats", verifyAdminToken, getDashboardStats);
router.get("/settings", verifyAdminToken, getSettings);
router.post("/settings", verifyAdminToken, updateSetting);

export default router;
