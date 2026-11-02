import express from "express";
import upload from "../middleware/multer.js";
import { verifyAdminToken } from "../middleware/verifyAdminToken.js";
import {
  createTutorialVideo,
  updateTutorialVideo,
  getAllTutorialVideos,
  getActiveTutorialVideos,
  getTutorialVideoById,
  deleteTutorialVideo,
  toggleTutorialVideoStatus,
  getTutorialCategories,
} from "../controllers/tutorialVideo.controller.js";

const tutorialVideoRouter = express.Router();

// Public routes (Website & Admin)
tutorialVideoRouter.get("/active", getActiveTutorialVideos);
tutorialVideoRouter.get("/categories", getTutorialCategories);
tutorialVideoRouter.get("/detail/:id", getTutorialVideoById);

// Admin routes (Dashboard)
tutorialVideoRouter.get("/", verifyAdminToken, getAllTutorialVideos);
tutorialVideoRouter.post(
  "/create",
  verifyAdminToken,
  upload.single("thumbnail"),
  createTutorialVideo
);
tutorialVideoRouter.put(
  "/update/:id",
  verifyAdminToken,
  upload.single("thumbnail"),
  updateTutorialVideo
);
tutorialVideoRouter.delete("/delete/:id", verifyAdminToken, deleteTutorialVideo);
tutorialVideoRouter.patch("/toggle/:id", verifyAdminToken, toggleTutorialVideoStatus);

export default tutorialVideoRouter;
