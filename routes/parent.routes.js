import express from "express";
import {
  createParent,
  getAllParents,
  updateParent,
  deleteParent,
  updateParentStatus,
  getParentsWithLabs,
  getParentWithLabsById,
} from "../controllers/parent.controller.js";
import { verifyAdminToken } from "../middleware/verifyAdminToken.js";

const router = express.Router();

router.post("/create", verifyAdminToken, createParent);
router.get("/get", getAllParents);
router.get("/with-labs", getParentsWithLabs);           // GET /parent/with-labs
router.get("/with-labs/:id", getParentWithLabsById);   // GET /parent/with-labs/:id
router.put("/update/:id", verifyAdminToken, updateParent);
router.delete("/delete/:id", verifyAdminToken, deleteParent);
router.patch("/status/:id", verifyAdminToken, updateParentStatus);

export default router;
