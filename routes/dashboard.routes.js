import express from "express";
import { getDashboardStats } from "../controllers/dashboard.controller.js";
import { verifyAdminToken } from "../middleware/verifyAdminToken.js";

const router = express.Router();

router.get("/stats", verifyAdminToken, getDashboardStats);

export default router;
