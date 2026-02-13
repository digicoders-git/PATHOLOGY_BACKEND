import express from "express";
import {
  createTestService,
  getAllTestServices,
  getTestServiceById,
  updateTestService,
  deleteTestService,
  updateTestServiceStatus,
} from "../controllers/testService.controller.js";
import { verifyAdminToken } from "../middleware/verifyAdminToken.js";

const router = express.Router();

// Public route (if you want visitors to see services)
router.get("/get", getAllTestServices);
router.get("/get/:id", getTestServiceById);

// Protected routes (Admin only)
router.post("/create", verifyAdminToken, createTestService);
router.put("/update/:id", verifyAdminToken, updateTestService);
router.delete("/delete/:id", verifyAdminToken, deleteTestService);
router.patch("/status/:id", verifyAdminToken, updateTestServiceStatus);

export default router;
