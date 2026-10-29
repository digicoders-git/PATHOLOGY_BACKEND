import Offer from "../model/offer.model.js";
import fs from "fs";
import { sendNotificationToAllPatients } from "../services/notificationService.js";

// ── CREATE ────────────────────────────────────────────────────────────────────
export const createOffer = async (req, res) => {
  try {
    const b = req.body;

    let imageData = { local: "", cloudinary: "" };
    if (req.file) {
      const cleanPath = req.file.path.replace(/\\/g, "/").replace(/^\/+/, "");
      imageData = { local: cleanPath, cloudinary: "" };
    }

    const offer = await Offer.create({
      title: b.title,
      subtitle: b.subtitle || "",
      description: b.description || "",
      couponCode: b.couponCode || "",
      discountPercent: Number(b.discountPercent) || 0,
      discountAmount: Number(b.discountAmount) || 0,
      coinsReward: Number(b.coinsReward) || 0,
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

    // Send FCM Notification to all patients if offer is active
    if (offer.status) {
      const title = "🔥 New Exciting Offer!";
      const body = b.subtitle ? `${b.title} - ${b.subtitle}` : `Checkout our new offer: ${b.title}`;
      
      sendNotificationToAllPatients(title, body, { type: "OFFER", offerId: offer._id.toString() })
        .catch(err => console.log("Failed to send Offer notification:", err.message));
    }

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
    if (b.coinsReward !== undefined) updateData.coinsReward = Number(b.coinsReward);
    if (b.sortOrder !== undefined) updateData.sortOrder = Number(b.sortOrder);
    if (b.status !== undefined) updateData.status = b.status === "true" || b.status === true;
    if (b.validFrom !== undefined) updateData.validFrom = b.validFrom || null;
    if (b.validTo !== undefined) updateData.validTo = b.validTo || null;

    if (req.file) {
      const cleanPath = req.file.path.replace(/\\/g, "/").replace(/^\/+/, "");
      updateData.image = { local: cleanPath, cloudinary: "" };
    }

    const offer = await Offer.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!offer) return res.status(404).json({ success: false, message: "Offer not found" });

    res.status(200).json({ success: true, message: "Offer updated successfully", data: offer });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const normalizeOffer = (o) => {
  const doc = o && o.toObject ? o.toObject() : { ...o };
  if (doc.image && typeof doc.image === "object") {
    // Prefer cloudinary if available
    let url = "";
    const cloudinary = (doc.image.cloudinary || "").trim();
    const local = (doc.image.local || "").trim();

    if (cloudinary) {
      url = cloudinary;
    } else if (local) {
      if (local.startsWith("http://") || local.startsWith("https://")) {
        // Fix old render.com URLs
        url = local.replace("https://pathology-backend-live.onrender.com", "https://api.laboindia.com")
                   .replace("http://pathology-backend-live.onrender.com", "https://api.laboindia.com");
      } else {
        // Relative path → full URL
        url = `https://api.laboindia.com/${local.replace(/^\/+/, "")}`;
      }
    }
    doc.image = { local: url, cloudinary: cloudinary };
  }
  return doc;
};

// ── GET ALL (Admin) ───────────────────────────────────────────────────────────
export const getAllOffers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "", status, offerType } = req.query;
    const query = {};

    if (search) query.title = { $regex: search, $options: "i" };
    if (status !== undefined && status !== "") query.status = status === "true";
    if (offerType) {
      if (offerType.includes(",")) {
        query.offerType = { $in: offerType.split(",").map((t) => t.trim()) };
      } else if (offerType.startsWith("!")) {
        query.offerType = { $ne: offerType.substring(1).trim() };
      } else {
        query.offerType = offerType;
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Offer.countDocuments(query);
    const offers = await Offer.find(query)
      .sort({ sortOrder: 1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      data: offers.map(normalizeOffer),
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

// ── GET ACTIVE (Public — for website slider & patient app banners) ────────────
export const getActiveOffers = async (req, res) => {
  try {
    const { offerType, labId } = req.query;
    const now = new Date();

    let typeQuery = {};
    if (offerType) {
      if (offerType === "all") {
        typeQuery = {};
      } else if (offerType.startsWith("!")) {
        typeQuery = { offerType: { $ne: offerType.slice(1) } };
      } else if (offerType.includes(",")) {
        typeQuery = { offerType: { $in: offerType.split(",") } };
      } else {
        typeQuery = { offerType };
      }
    } else {
      typeQuery = { offerType: { $ne: "app_banner" } };
    }

    const query = {
      status: true,
      $and: [
        typeQuery,
        {
          $or: [
            { validFrom: null, validTo: null },
            { validFrom: { $lte: now }, validTo: { $gte: now } },
            { validFrom: null, validTo: { $gte: now } },
            { validFrom: { $lte: now }, validTo: null },
          ],
        },
      ],
    };

    if (labId) query.labId = labId;

    const offers = await Offer.find(query).sort({ sortOrder: 1, createdAt: -1 });
    res.status(200).json({ success: true, data: offers.map(normalizeOffer) });
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

// ── VALIDATE COUPON (For Patient App) ─────────────────────────────────────────
export const validateCoupon = async (req, res) => {
  try {
    const { couponCode, labId } = req.body;
    const patientId = req.user?.id; // Assumes route is protected by patientAuth

    if (!couponCode) {
      return res.status(400).json({ success: false, message: "Coupon code is required" });
    }

    const query = {
      couponCode: { $regex: new RegExp("^" + couponCode + "$", "i") },
      status: true
    };

    const offer = await Offer.findOne(query);

    if (!offer) {
      return res.status(404).json({ success: false, message: "Invalid or inactive coupon code" });
    }

    // Check expiry
    const now = new Date();
    if (offer.validFrom && now < new Date(offer.validFrom)) {
      return res.status(400).json({ success: false, message: "This coupon is not valid yet" });
    }
    if (offer.validTo && now > new Date(offer.validTo)) {
      return res.status(400).json({ success: false, message: "This coupon has expired" });
    }

    // Check Lab specificity
    if (offer.labId && labId) {
      if (offer.labId.toString() !== labId.toString()) {
        return res.status(400).json({ success: false, message: "This coupon is not valid for the selected lab" });
      }
    }

    // Check One-Time Use (Has this patient already used this coupon?)
    if (patientId) {
      const TestBooking = (await import("../model/testBooking.model.js")).default;
      const previousTestBooking = await TestBooking.findOne({
        patientId: patientId,
        couponCode: { $regex: new RegExp("^" + couponCode + "$", "i") },
        bookingStatus: { $ne: "Cancelled" }
      });

      const Booking = (await import("../model/booking.model.js")).default;
      const previousDirectBooking = await Booking.findOne({
        patient: patientId,
        couponCode: { $regex: new RegExp("^" + couponCode + "$", "i") },
        status: { $ne: "Cancelled" }
      });

      if (previousTestBooking || previousDirectBooking) {
        return res.status(400).json({ success: false, message: "You have already used this coupon" });
      }
    }

    // If valid, return discount info
    res.status(200).json({
      success: true,
      message: "Coupon is valid",
      data: {
        _id: offer._id,
        title: offer.title,
        couponCode: offer.couponCode,
        discountPercent: offer.discountPercent,
        discountAmount: offer.discountAmount,
        offerType: offer.offerType,
        isAdminOffer: !offer.labId
      }
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
