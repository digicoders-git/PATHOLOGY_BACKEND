import express from "express";
import { createSubcategory, getSubcategories, updateSubcategory, deleteSubcategory } from "../../controllers/admin/subcategory.controller.js";
import { verifyAdminToken } from "../../middleware/verifyAdminToken.js";

const router = express.Router();

router.post("/", verifyAdminToken, createSubcategory);
router.get("/", getSubcategories);
router.patch("/:id", verifyAdminToken, updateSubcategory);
router.delete("/:id", verifyAdminToken, deleteSubcategory);

export default router;
