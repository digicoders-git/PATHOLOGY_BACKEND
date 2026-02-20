import express from "express";
import {
  addMyTestPricing,
  getMyTestPricing,
  updateMyTestPricing,
  toggleMyTestPricingStatus,
  deleteMyTestPricing,
  restoreMyTestPricing,
} from "../../controllers/pathology/pathologyTestPricing.controller.js";
import { pathologyAuth } from "../../middleware/pathologyAuth.middleware.js";

const router = express.Router();

// Apply auth middleware to all routes
router.use(pathologyAuth);

router.get("/get-my-pricing", getMyTestPricing);
router.post("/add-pricing", addMyTestPricing);
router.put("/update-pricing/:id", updateMyTestPricing);
router.patch("/toggle-status/:id", toggleMyTestPricingStatus);
router.delete("/delete-pricing/:id", deleteMyTestPricing);
router.patch("/restore-pricing/:id", restoreMyTestPricing);

export default router;
