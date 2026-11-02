import express from "express";
import upload from "../middleware/multer.js";
import { verifyAdminToken } from "../middleware/verifyAdminToken.js";
import {
  createPresentation,
  updatePresentation,
  getAllPresentations,
  getActivePresentations,
  getPresentationCategories,
  getPresentationById,
  deletePresentation,
  togglePresentationStatus,
} from "../controllers/presentation.controller.js";

const presentationRouter = express.Router();

// Public routes (Website & Admin)
presentationRouter.get("/active", getActivePresentations);
presentationRouter.get("/categories", getPresentationCategories);
presentationRouter.get("/detail/:id", getPresentationById);

// Admin routes (Dashboard)
presentationRouter.get("/", verifyAdminToken, getAllPresentations);
presentationRouter.post(
  "/create",
  verifyAdminToken,
  upload.single("banner"),
  createPresentation
);
presentationRouter.put(
  "/update/:id",
  verifyAdminToken,
  upload.single("banner"),
  updatePresentation
);
presentationRouter.delete("/delete/:id", verifyAdminToken, deletePresentation);
presentationRouter.patch("/toggle/:id", verifyAdminToken, togglePresentationStatus);

export default presentationRouter;
