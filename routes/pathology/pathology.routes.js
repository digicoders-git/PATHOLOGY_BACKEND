import express from "express";
import { loginPathology, getPathologyProfile } from "../../controllers/pathology/pathology.controller.js";
import { pathologyAuth } from "../../middleware/pathologyAuth.middleware.js";

const router = express.Router();

router.post("/login", loginPathology);
router.get("/profile", pathologyAuth, getPathologyProfile);

export default router;
