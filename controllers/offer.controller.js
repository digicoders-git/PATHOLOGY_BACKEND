import Offer from "../model/offer.model.js";
import { uploadAndKeepLocal } from "../utils/cloudinary.js";
import fs from "fs";

// ── CREATE ────────────────────────────────────────────────────────────────────
export const createOffer = async (req, res) => {
  try {
    const b = req.body;

    let imageData = { local: "", cloudinary: "" };
    if (req.file) {
      const cloudUrl = await uploadAndKeepLocal(req.file.path, "pathology/offers");
      imageData = {
        local: req.file.path.replace(/\\/g, "/"),
        cloudinary: cloudUrl || "",
      };
    }

    const offer = await Offer.create({
      title: b.title,
      subtitle: b.subtitle || "",
      description: b.description || "",
      couponCode: b.couponCode || "",
      discountPercent: Number(b.discountPercent) || 0,
      discountAmount: Number(b.discountAmount) || 0,
      offerType: b.offerType || "slider",
      image: imageData,
      link: b.link || "",
      bgColor: b.bgColor || "#ffffff",
      textColor: b.textColor || "#000000",
      validFrom: b.validFrom || null,
      validTo: b.validTo || null,
      status: b.status === "false" ? false : true,
      sortOrder: Number(b.sortOrder) || 0,
    });

    res.status(201).json({ success: true, message: "Offer created successfully", data: offer });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── UPDATE ────────────────────────────────────────────────────────────────────
export const updateOffer = async (req, res) => {
  try {
    const b = req.body;
    const updateData = {};

    const strFields = ["title", "subtitle", "description", "couponCode", "offerType", "link", "bgColor", "textColor"];
    strFields.forEach((f) => { if (b[f] !== undefined) updateData[f] = b[f]; });

    if (b.discountPercent !== undefined) updateData.discountPercent = Number(b.discountPercent);
    if (b.discountAmount !== undefined) updateData.discountAmount = Number(b.discountAmount);
    if (b.sortOrder !== undefined) updateData.sortOrder = Number(b.sortOrder);
    if (b.status !== undefined) updateData.status = b.status === "true" || b.status === true;
    if (b.validFrom !== undefined) updateData.validFrom = b.validFrom || null;
    if (b.validTo !== undefined) updateData.validTo = b.validTo || null;

    if (req.file) {
      const cloudUrl = await uploadAndKeepLocal(req.file.path, "pathology/offers");
      updateData.image = {
        local: req.file.path.replace(/\\/g, "/"),
        cloudinary: cloudUrl || "",
      };
    }

    const offer = await Offer.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!offer) return res.status(404).json({ success: false, message: "Offer not found" });

    res.status(200).json({ success: true, message: "Offer updated successfully", data: offer });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET ALL (Admin) ───────────────────────────────────────────────────────────
export const getAllOffers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "", status, offerType } = req.query;
    const query = {};

    if (search) query.title = { $regex: search, $options: "i" };
    if (status !== undefined && status !== "") query.status = status === "true";
    if (offerType) query.offerType = offerType;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Offer.countDocuments(query);
    const offers = await Offer.find(query)
      .sort({ sortOrder: 1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      data: offers,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET ACTIVE (Public — for website slider) ──────────────────────────────────
export const getActiveOffers = async (req, res) => {
  try {
    const { offerType, labId } = req.query;
    const query = { status: true };
    if (offerType) query.offerType = offerType;
    // If labId provided → return that lab's offers, else return admin offers (labId: null)
    if (labId) query.labId = labId;
    else query.labId = null;

    const now = new Date();
    query.$or = [
      { validFrom: null, validTo: null },
      { validFrom: { $lte: now }, validTo: { $gte: now } },
      { validFrom: null, validTo: { $gte: now } },
      { validFrom: { $lte: now }, validTo: null },
    ];

    const offers = await Offer.find(query).sort({ sortOrder: 1, createdAt: -1 });
    res.status(200).json({ success: true, data: offers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── DELETE ────────────────────────────────────────────────────────────────────
export const deleteOffer = async (req, res) => {
  try {
    const offer = await Offer.findByIdAndDelete(req.params.id);
    if (!offer) return res.status(404).json({ success: false, message: "Offer not found" });

    // Delete local file if exists
    if (offer.image?.local && fs.existsSync(offer.image.local)) {
      fs.unlinkSync(offer.image.local);
    }

    res.status(200).json({ success: true, message: "Offer deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── TOGGLE STATUS ─────────────────────────────────────────────────────────────
export const toggleOfferStatus = async (req, res) => {
  try {
    const offer = await Offer.findById(req.params.id);
    if (!offer) return res.status(404).json({ success: false, message: "Offer not found" });

    offer.status = !offer.status;
    await offer.save();

    res.status(200).json({ success: true, message: `Offer ${offer.status ? "activated" : "deactivated"}`, data: offer });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
