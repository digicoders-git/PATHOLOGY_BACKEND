import express from "express";
import upload from "../../middleware/multer.js";
import { verifyAdminToken } from "../../middleware/verifyAdminToken.js";
import {
  createOffer,
  updateOffer,
  getAllOffers,
  getActiveOffers,
  deleteOffer,
  toggleOfferStatus,
} from "../../controllers/offer.controller.js";

const offerRouter = express.Router();

// Public route — website slider
offerRouter.get("/active", getActiveOffers);

// Admin protected routes
offerRouter.get("/", verifyAdminToken, getAllOffers);
offerRouter.post("/create", verifyAdminToken, upload.single("offerImage"), createOffer);
offerRouter.put("/update/:id", verifyAdminToken, upload.single("offerImage"), updateOffer);
offerRouter.delete("/delete/:id", verifyAdminToken, deleteOffer);
offerRouter.patch("/toggle/:id", verifyAdminToken, toggleOfferStatus);

export default offerRouter;
