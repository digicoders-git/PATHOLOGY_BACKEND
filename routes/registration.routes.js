import express from "express";
import {
  createRegistration,
  getAllRegistrations,
  getRegistrationById,
  updateRegistrationStatus,
  updateRegistration,
  deleteRegistration,
} from "../controllers/registration.controller.js";
import { verifyAdminToken } from "../middleware/verifyAdminToken.js";
import upload from "../middleware/multer.js";

const router = express.Router();

// Define multple file fields
const cpUpload = upload.fields([
  { name: "labLogo", maxCount: 1 },
  { name: "labBanner", maxCount: 1 },
  { name: "certificationFiles", maxCount: 10 },
  { name: "pathologyDocs", maxCount: 1 },
]);

// Public route for website
router.post("/create", cpUpload, createRegistration);

// Protected routes for dashboard
router.get("/get", verifyAdminToken, getAllRegistrations);
router.get("/get/:id", verifyAdminToken, getRegistrationById);
router.put("/:id", verifyAdminToken, cpUpload, updateRegistration);
router.patch("/status/:id", verifyAdminToken, updateRegistrationStatus);
router.delete("/:id", verifyAdminToken, deleteRegistration);

export default router;
