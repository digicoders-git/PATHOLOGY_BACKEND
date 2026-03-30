import Offer from "../../model/offer.model.js";
import { uploadAndKeepLocal } from "../../utils/cloudinary.js";
import fs from "fs";

// ── CREATE (Lab Owner) ────────────────────────────────────────────────────────
export const createLabOffer = async (req, res) => {
  try {
    const b = req.body;
    const labId = req.user.id;

    let imageData = { local: "", cloudinary: "" };
    if (req.file) {
      const cloudUrl = await uploadAndKeepLocal(req.file.path, "pathology/lab-offers");
      imageData = {
        local: req.file.path.replace(/\\/g, "/"),
        cloudinary: cloudUrl || "",
      };
    }

    const offer = await Offer.create({
      labId,
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

// ── UPDATE (Lab Owner — only own offers) ──────────────────────────────────────
export const updateLabOffer = async (req, res) => {
  try {
    const labId = req.user.id;
    const offer = await Offer.findOne({ _id: req.params.id, labId });
    if (!offer) return res.status(404).json({ success: false, message: "Offer not found or unauthorized" });

    const b = req.body;
    const strFields = ["title", "subtitle", "description", "couponCode", "offerType", "link", "bgColor", "textColor"];
    strFields.forEach((f) => { if (b[f] !== undefined) offer[f] = b[f]; });

    if (b.discountPercent !== undefined) offer.discountPercent = Number(b.discountPercent);
    if (b.discountAmount !== undefined) offer.discountAmount = Number(b.discountAmount);
    if (b.sortOrder !== undefined) offer.sortOrder = Number(b.sortOrder);
    if (b.status !== undefined) offer.status = b.status === "true" || b.status === true;
    if (b.validFrom !== undefined) offer.validFrom = b.validFrom || null;
    if (b.validTo !== undefined) offer.validTo = b.validTo || null;

    if (req.file) {
      // Delete old local file
      if (offer.image?.local && fs.existsSync(offer.image.local)) fs.unlinkSync(offer.image.local);
      const cloudUrl = await uploadAndKeepLocal(req.file.path, "pathology/lab-offers");
      offer.image = { local: req.file.path.replace(/\\/g, "/"), cloudinary: cloudUrl || "" };
    }

    await offer.save();
    res.status(200).json({ success: true, message: "Offer updated successfully", data: offer });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET MY OFFERS (Lab Owner — all own offers) ────────────────────────────────
export const getMyOffers = async (req, res) => {
  try {
    const labId = req.user.id;
    const { page = 1, limit = 10, status, offerType } = req.query;
    const query = { labId };
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
      pagination: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET ACTIVE LAB OFFERS (Public) ────────────────────────────────────────────
export const getActiveLabOffers = async (req, res) => {
  try {
    const { labId, offerType } = req.query;
    if (!labId) return res.status(400).json({ success: false, message: "labId is required" });

    const query = { labId, status: true };
    if (offerType) query.offerType = offerType;

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

// ── DELETE (Lab Owner — only own offers) ──────────────────────────────────────
export const deleteLabOffer = async (req, res) => {
  try {
    const labId = req.user.id;
    const offer = await Offer.findOneAndDelete({ _id: req.params.id, labId });
    if (!offer) return res.status(404).json({ success: false, message: "Offer not found or unauthorized" });

    if (offer.image?.local && fs.existsSync(offer.image.local)) fs.unlinkSync(offer.image.local);

    res.status(200).json({ success: true, message: "Offer deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── TOGGLE STATUS (Lab Owner) ─────────────────────────────────────────────────
export const toggleLabOfferStatus = async (req, res) => {
  try {
    const labId = req.user.id;
    const offer = await Offer.findOne({ _id: req.params.id, labId });
    if (!offer) return res.status(404).json({ success: false, message: "Offer not found or unauthorized" });

    offer.status = !offer.status;
    await offer.save();

    res.status(200).json({ success: true, message: `Offer ${offer.status ? "activated" : "deactivated"}`, data: offer });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
