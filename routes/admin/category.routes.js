import express from "express";
import { createCategory, getCategories, updateCategory, getCategoryTree, deleteCategory } from "../../controllers/admin/category.controller.js";
import { verifyAdminToken } from "../../middleware/verifyAdminToken.js";
import upload from "../../middleware/multer.js";

const router = express.Router();

router.post("/", verifyAdminToken, upload.single('categoryIcon'), createCategory);
router.get("/", getCategories);
router.get("/tree/:id", getCategoryTree); 
router.patch("/:id", verifyAdminToken, upload.single('categoryIcon'), updateCategory);
router.delete("/:id", verifyAdminToken, deleteCategory);

export default router;
