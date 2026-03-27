import express from "express";
import {
  createParent,
  getAllParents,
  updateParent,
  deleteParent,
  updateParentStatus,
} from "../controllers/parent.controller.js";
import { verifyAdminToken } from "../middleware/verifyAdminToken.js";

const router = express.Router();

router.post("/create", verifyAdminToken, createParent);
router.get("/get", getAllParents);
router.put("/update/:id", verifyAdminToken, updateParent);
router.delete("/delete/:id", verifyAdminToken, deleteParent);
router.patch("/status/:id", verifyAdminToken, updateParentStatus);

export default router;
