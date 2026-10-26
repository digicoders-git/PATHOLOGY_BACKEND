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
  creditLabWallet,
  getLabWalletTransactionsForAdmin,
  updateApprovalStatus,
  saveRegistrationFcmToken,
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
  { name: "cmoCertificate", maxCount: 1 },
  { name: "gstCertificate", maxCount: 1 },
  { name: "gstDoc", maxCount: 1 },
]);

// Public routes
router.post("/create", cpUpload, createRegistration);
router.post("/fcm-token", saveRegistrationFcmToken);

// GET routes (Public)
router.get("/get", getAllRegistrations);
router.get("/nearby", getNearbyLabs);
router.get("/test/:testId", getLabsByTest);
router.get("/lab/:id/tests", getTestsByLab);
router.get("/get/:id", getRegistrationById);

// Admin routes
router.post("/import-excel", verifyAdminToken, upload.single("excelFile"), importRegistrationsExcel);
router.post("/bulk-create", verifyAdminToken, bulkCreateRegistrations);
router.post("/wallet/credit", verifyAdminToken, creditLabWallet);
router.get("/:id/wallet-transactions", verifyAdminToken, getLabWalletTransactionsForAdmin);
router.put("/:id", verifyAdminToken, cpUpload, updateRegistration);
router.patch("/status/:id", verifyAdminToken, updateRegistrationStatus);
router.patch("/approval/:id", verifyAdminToken, updateApprovalStatus);
router.patch("/featured/:id", verifyAdminToken, toggleFeatured);
router.delete("/:id", verifyAdminToken, deleteRegistration);

export default router;
