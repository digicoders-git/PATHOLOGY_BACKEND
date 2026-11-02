import express from "express";
import upload from "../middleware/multer.js";
import { verifyAdminToken } from "../middleware/verifyAdminToken.js";
import {
  createMediaEvent,
  getAllMediaEvents,
  getActiveMediaEvents,
  getMediaEventCategories,
  getMediaEventById,
  updateMediaEvent,
  deleteMediaEvent,
  toggleMediaEventStatus,
} from "../controllers/mediaEvent.controller.js";

const mediaEventRouter = express.Router();

const uploadFields = upload.fields([
  { name: "image", maxCount: 1 },
  { name: "mediaImage", maxCount: 1 },
  { name: "banner", maxCount: 1 },
  { name: "gallery", maxCount: 100 },
  { name: "galleryImages", maxCount: 100 },
]);

// Public endpoints (Website)
mediaEventRouter.get("/active", getActiveMediaEvents);
mediaEventRouter.get("/categories", getMediaEventCategories);
mediaEventRouter.get("/detail/:id", getMediaEventById);

// Admin endpoints (Dashboard)
mediaEventRouter.get("/", verifyAdminToken, getAllMediaEvents);
mediaEventRouter.get("/:id", verifyAdminToken, getMediaEventById);

// Create
mediaEventRouter.post("/", verifyAdminToken, uploadFields, createMediaEvent);
mediaEventRouter.post("/create", verifyAdminToken, uploadFields, createMediaEvent);

// Update
mediaEventRouter.put("/:id", verifyAdminToken, uploadFields, updateMediaEvent);
mediaEventRouter.put("/update/:id", verifyAdminToken, uploadFields, updateMediaEvent);

// Status Toggle
mediaEventRouter.patch("/:id/status", verifyAdminToken, toggleMediaEventStatus);
mediaEventRouter.patch("/toggle/:id", verifyAdminToken, toggleMediaEventStatus);

// Delete
mediaEventRouter.delete("/:id", verifyAdminToken, deleteMediaEvent);
mediaEventRouter.delete("/delete/:id", verifyAdminToken, deleteMediaEvent);

export default mediaEventRouter;
