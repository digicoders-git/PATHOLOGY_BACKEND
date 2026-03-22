import express from "express";
import {
  createTestService,
  getAllTestServices,
  getTestServiceById,
  updateTestService,
  deleteTestService,
  updateTestServiceStatus,
  bulkCreateTestServices
} from "../controllers/testService.controller.js";
import { verifyAdminToken } from "../middleware/verifyAdminToken.js";
import upload from "../middleware/multer.js";

const router = express.Router();

// Public route (if you want visitors to see services)
router.get("/get", getAllTestServices);
router.get("/get/:id", getTestServiceById);

// Protected routes (Admin only)
router.post("/create", verifyAdminToken, upload.single('testImage'), createTestService);
router.post("/bulk-create", verifyAdminToken, bulkCreateTestServices);
router.put("/update/:id", verifyAdminToken, upload.single('testImage'), updateTestService);
router.patch("/update/:id", verifyAdminToken, upload.single('testImage'), updateTestService); // Alias for convenience
router.patch("/:id", verifyAdminToken, upload.single('testImage'), updateTestService);       // Required PATCH /tests/:id
router.delete("/delete/:id", verifyAdminToken, deleteTestService);
router.patch("/status/:id", verifyAdminToken, updateTestServiceStatus);

export default router;
