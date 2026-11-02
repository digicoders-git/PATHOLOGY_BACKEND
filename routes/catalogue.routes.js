import express from "express";
import upload from "../middleware/multer.js";
import { verifyAdminToken } from "../middleware/verifyAdminToken.js";
import {
  createCatalogue,
  getAllCatalogues,
  getActiveCatalogues,
  getCatalogueById,
  updateCatalogue,
  deleteCatalogue,
  toggleCatalogueStatus,
} from "../controllers/catalogue.controller.js";

const catalogueRouter = express.Router();

const uploadFields = upload.fields([
  { name: "cover", maxCount: 1 },
  { name: "banner", maxCount: 1 },
  { name: "catalogueCover", maxCount: 1 },
  { name: "catalogueBanner", maxCount: 1 },
  { name: "file", maxCount: 1 },
]);

// Public endpoints (Website)
catalogueRouter.get("/active", getActiveCatalogues);
catalogueRouter.get("/detail/:id", getCatalogueById);

// Admin endpoints (Dashboard)
catalogueRouter.get("/", verifyAdminToken, getAllCatalogues);
catalogueRouter.get("/:id", verifyAdminToken, getCatalogueById);

// Create
catalogueRouter.post("/", verifyAdminToken, uploadFields, createCatalogue);
catalogueRouter.post("/create", verifyAdminToken, uploadFields, createCatalogue);

// Update
catalogueRouter.put("/:id", verifyAdminToken, uploadFields, updateCatalogue);
catalogueRouter.put("/update/:id", verifyAdminToken, uploadFields, updateCatalogue);

// Status Toggle
catalogueRouter.patch("/:id/status", verifyAdminToken, toggleCatalogueStatus);
catalogueRouter.patch("/toggle/:id", verifyAdminToken, toggleCatalogueStatus);

// Delete
catalogueRouter.delete("/:id", verifyAdminToken, deleteCatalogue);
catalogueRouter.delete("/delete/:id", verifyAdminToken, deleteCatalogue);

export default catalogueRouter;
