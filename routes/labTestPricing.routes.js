import express from "express";
import {
  createLabTestPricing,
  getAllLabTestPricing,
  getLabTestPricingById,
  updateLabTestPricing,
  deleteLabTestPricing,
  restoreLabTestPricing,
  updateLabTestPricingStatus,
} from "../controllers/labTestPricing.controller.js";
import { verifyAdminToken } from "../middleware/verifyAdminToken.js";

const router = express.Router();

// Public or Protected depending on requirements, usually these might be protected
router.post("/create", verifyAdminToken, createLabTestPricing);
router.get("/get", verifyAdminToken, getAllLabTestPricing);
router.get("/get/:id", verifyAdminToken, getLabTestPricingById);
router.put("/update/:id", verifyAdminToken, updateLabTestPricing);
router.delete("/delete/:id", verifyAdminToken, deleteLabTestPricing);
router.patch("/restore/:id", verifyAdminToken, restoreLabTestPricing);
router.patch("/status/:id", verifyAdminToken, updateLabTestPricingStatus);

export default router;
