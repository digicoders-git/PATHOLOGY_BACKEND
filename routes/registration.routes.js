import express from "express";
import {
  createRegistration,
  getAllRegistrations,
  getRegistrationById,
  updateRegistrationStatus,
  toggleFeatured,
  updateRegistration,
  deleteRegistration,
  importRegistrationsExcel,
  bulkCreateRegistrations,
  getNearbyLabs,
  getLabsByTest,
  getTestsByLab,
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

// GET routes (Public)
router.get("/get", getAllRegistrations);
router.get("/nearby", getNearbyLabs);
router.get("/test/:testId", getLabsByTest);
router.get("/lab/:id/tests", getTestsByLab);
router.get("/get/:id", getRegistrationById);
router.post("/import-excel", verifyAdminToken, upload.single("excelFile"), importRegistrationsExcel);
router.post("/bulk-create", verifyAdminToken, bulkCreateRegistrations);
router.put("/:id", verifyAdminToken, cpUpload, updateRegistration);
router.patch("/status/:id", verifyAdminToken, updateRegistrationStatus);
router.patch("/featured/:id", verifyAdminToken, toggleFeatured);
router.delete("/:id", verifyAdminToken, deleteRegistration);

export default router;
