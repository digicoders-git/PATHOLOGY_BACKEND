import express from "express";
import {
  createParent,
  getAllParents,
  updateParent,
  deleteParent,
  updateParentStatus,
} from "../controllers/parent.controller.js";

const router = express.Router();

router.post("/create", createParent);
router.get("/get", getAllParents);
router.put("/update/:id", updateParent);
router.delete("/delete/:id", deleteParent);
router.patch("/status/:id", updateParentStatus);

export default router;
