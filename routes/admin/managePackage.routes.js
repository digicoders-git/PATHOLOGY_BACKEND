import express from "express";
import {
  createPackage,
  getAllPackages,
  getSinglePackage,
  updatePackage,
  deletePackage,
  togglePackageStatus,
} from "../../controllers/admin/managePackage.controller.js";

const managePackageRoutes = express.Router();
import upload from "../../middleware/multer.js";

managePackageRoutes.post("/create", upload.single("image"), createPackage);
managePackageRoutes.get("/", getAllPackages);
managePackageRoutes.get("/:id", getSinglePackage);
managePackageRoutes.put("/:id", upload.single("image"), updatePackage);
managePackageRoutes.delete("/:id", deletePackage);
managePackageRoutes.patch("/status/:id", togglePackageStatus);

export default managePackageRoutes;
