import MediaEvent from "../model/mediaEvent.model.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const toRelativePath = (absolutePath) => {
  if (!absolutePath) return "";
  const normalized = absolutePath.replace(/\\/g, "/");
  const idx = normalized.indexOf("/uploads/");
  return idx !== -1 ? normalized.slice(idx + 1) : normalized.replace(/^\/+/, "");
};

const resolveUrl = (localPath, req) => {
  if (!localPath) return "";
  localPath = localPath.trim();
  if (localPath.startsWith("http://") || localPath.startsWith("https://") || localPath.startsWith("data:")) {
    return localPath;
  }
  const clean = localPath.replace(/^\/+/, "");
  if (req && req.get) {
    return `${req.protocol}://${req.get("host")}/${clean}`;
  }
  return `http://localhost:3000/${clean}`;
};

const normalizeMediaEvent = (item, req) => {
  const doc = item && item.toObject ? item.toObject() : { ...item };
  let localPath = "";
  if (doc.image && typeof doc.image === "object") {
    localPath = (doc.image.local || doc.image.cloudinary || "").trim();
  } else if (typeof doc.image === "string") {
    localPath = doc.image.trim();
  }

  const fullUrl = resolveUrl(localPath, req);
  doc.imageUrl = fullUrl;
  doc.bannerUrl = fullUrl; // Alias

  // Normalize gallery photos
  if (Array.isArray(doc.gallery)) {
    doc.gallery = doc.gallery.map((g) => {
      const copy = { ...g };
      let gPath = "";
      if (copy.local) gPath = copy.local;
      else if (copy.cloudinary) gPath = copy.cloudinary;
      else if (typeof copy === "string") gPath = copy;
      copy.imageUrl = resolveUrl(gPath, req);
      return copy;
    });
  } else {
    doc.gallery = [];
  }

  // Normalize items
  if (Array.isArray(doc.items)) {
    doc.items = doc.items.map((sub) => {
      const s = { ...sub };
      let subPath = "";
      if (s.image && typeof s.image === "object") {
        subPath = (s.image.local || s.image.cloudinary || "").trim();
      } else if (typeof s.image === "string") {
        subPath = s.image.trim();
      }
      if (subPath) {
        s.imageUrl = resolveUrl(subPath, req);
      }
      return s;
    });
  } else {
    doc.items = [];
  }

  // Compute purely dynamic photo count
  const count = doc.gallery.length > 0 ? doc.gallery.length : (doc.items.length > 0 ? doc.items.length : 0);
  doc.photoCount = count;

  // If category is Media/Gallery or metaText was dummy 120+, make it purely dynamic
  const cat = (doc.category || "").toLowerCase();
  if (cat.includes("media") || cat.includes("gallery") || (doc.metaText && doc.metaText.includes("120"))) {
    doc.metaText = `${count} Photos`;
  } else if (!doc.metaText) {
    doc.metaText = `${count} Photos`;
  }

  return doc;
};

// ── CREATE ────────────────────────────────────────────────────────────────────
export const createMediaEvent = async (req, res) => {
  try {
    const b = req.body;
    if (!b.title) {
      return res.status(400).json({ success: false, message: "Title is required" });
    }

    let imageData = { local: "", cloudinary: "" };
    if (req.file) {
      imageData.local = toRelativePath(req.file.path);
    } else if (req.files && req.files.image && req.files.image[0]) {
      imageData.local = toRelativePath(req.files.image[0].path);
    } else if (req.files && req.files.mediaImage && req.files.mediaImage[0]) {
      imageData.local = toRelativePath(req.files.mediaImage[0].path);
    } else if (b.imageUrl && typeof b.imageUrl === "string") {
      imageData.local = b.imageUrl;
    } else if (b.image && typeof b.image === "string") {
      imageData.local = b.image;
    }

    // Process multiple gallery images
    const gallery = [];
    const galleryFiles = [];
    if (req.files && Array.isArray(req.files.gallery)) {
      galleryFiles.push(...req.files.gallery);
    }
    if (req.files && Array.isArray(req.files.galleryImages)) {
      galleryFiles.push(...req.files.galleryImages);
    }

    for (const f of galleryFiles) {
      gallery.push({
        local: toRelativePath(f.path),
        title: f.originalname || "",
        createdAt: new Date(),
      });
    }

    // Parse items if passed
    let items = [];
    if (b.items) {
      if (Array.isArray(b.items)) {
        items = b.items;
      } else if (typeof b.items === "string") {
        try {
          items = JSON.parse(b.items);
        } catch (e) {
          console.warn("Could not parse items JSON:", e.message);
        }
      }
    }

    const category = b.category ? b.category.trim() : "Media";
    const categoryKey = b.categoryKey
      ? b.categoryKey.trim().toLowerCase()
      : category.toLowerCase().replace(/[^a-z0-9]/g, "");

    const totalPhotos = gallery.length > 0 ? gallery.length : items.length;
    let metaText = b.metaText ? b.metaText.trim() : "";
    if (category.toLowerCase().includes("media") || category.toLowerCase().includes("gallery") || metaText.includes("120")) {
      metaText = `${totalPhotos} Photos`;
    }

    const mediaEvent = await MediaEvent.create({
      title: b.title.trim(),
      subtitle: b.subtitle ? b.subtitle.trim() : "",
      category,
      categoryKey,
      description: b.description ? b.description.trim() : "",
      metaText,
      buttonText: b.buttonText ? b.buttonText.trim() : "View Details",
      image: imageData,
      gallery,
      items,
      status: b.status === "Inactive" ? "Inactive" : "Active",
      isFeatured: b.isFeatured === "true" || b.isFeatured === true,
      order: Number.isNaN(Number(b.order)) ? 0 : Number(b.order),
    });

    return res.status(201).json({
      success: true,
      message: "Media / Event created successfully",
      mediaEvent: normalizeMediaEvent(mediaEvent, req),
    });
  } catch (error) {
    console.error("Create media event error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── GET ALL (Admin) ──────────────────────────────────────────────────────────
export const getAllMediaEvents = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = "",
      category = "",
      status = "",
      sortBy = "order",
      sortOrder = "asc",
    } = req.query;

    const query = {};

    if (status && status !== "All") {
      query.status = status;
    }

    if (category && category !== "All" && category !== "all") {
      query.$or = [
        { category: { $regex: new RegExp(`^${category.trim()}$`, "i") } },
        { categoryKey: category.trim().toLowerCase() },
      ];
    }

    if (search && search.trim()) {
      const q = search.trim();
      const searchConditions = [
        { title: { $regex: q, $options: "i" } },
        { subtitle: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } },
        { category: { $regex: q, $options: "i" } },
      ];
      if (query.$or) {
        query.$and = [{ $or: query.$or }, { $or: searchConditions }];
        delete query.$or;
      } else {
        query.$or = searchConditions;
      }
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 20);
    const skip = (pageNum - 1) * limitNum;

    const sortOptions = {};
    if (sortBy === "order") {
      sortOptions.order = sortOrder === "desc" ? -1 : 1;
      sortOptions.createdAt = -1;
    } else {
      sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;
    }

    const [mediaEvents, total] = await Promise.all([
      MediaEvent.find(query).sort(sortOptions).skip(skip).limit(limitNum).lean(),
      MediaEvent.countDocuments(query),
    ]);

    const normalized = mediaEvents.map((item) => normalizeMediaEvent(item, req));

    return res.status(200).json({
      success: true,
      mediaEvents: normalized,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (error) {
    console.error("Get all media events error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── GET ACTIVE (Public Website) ───────────────────────────────────────────────
export const getActiveMediaEvents = async (req, res) => {
  try {
    const { category } = req.query;
    const query = { status: "Active" };

    if (category && category !== "All" && category !== "all") {
      query.$or = [
        { category: { $regex: new RegExp(`^${category.trim()}$`, "i") } },
        { categoryKey: category.trim().toLowerCase() },
      ];
    }

    const mediaEvents = await MediaEvent.find(query)
      .sort({ order: 1, createdAt: -1 })
      .lean();

    const normalized = mediaEvents.map((item) => normalizeMediaEvent(item, req));

    return res.status(200).json({
      success: true,
      mediaEvents: normalized,
      count: normalized.length,
    });
  } catch (error) {
    console.error("Get active media events error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── GET CATEGORIES ────────────────────────────────────────────────────────────
export const getMediaEventCategories = async (req, res) => {
  try {
    const rawCategories = await MediaEvent.aggregate([
      { $match: { status: "Active" } },
      {
        $group: {
          _id: {
            category: "$category",
            categoryKey: "$categoryKey",
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    const categories = rawCategories.map((c) => ({
      category: c._id.category,
      categoryKey: c._id.categoryKey || c._id.category.toLowerCase().replace(/[^a-z0-9]/g, ""),
      count: c.count,
    }));

    return res.status(200).json({
      success: true,
      categories,
    });
  } catch (error) {
    console.error("Get media event categories error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── GET BY ID ────────────────────────────────────────────────────────────────
export const getMediaEventById = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await MediaEvent.findById(id).lean();
    if (!item) {
      return res.status(404).json({ success: false, message: "Media / Event not found" });
    }
    return res.status(200).json({
      success: true,
      mediaEvent: normalizeMediaEvent(item, req),
    });
  } catch (error) {
    console.error("Get media event by id error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── UPDATE ───────────────────────────────────────────────────────────────────
export const updateMediaEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const b = req.body;

    const existing = await MediaEvent.findById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "Media / Event not found" });
    }

    if (b.title !== undefined) existing.title = b.title.trim();
    if (b.subtitle !== undefined) existing.subtitle = b.subtitle.trim();
    if (b.description !== undefined) existing.description = b.description.trim();
    if (b.metaText !== undefined) existing.metaText = b.metaText.trim();
    if (b.buttonText !== undefined) existing.buttonText = b.buttonText.trim();
    if (b.status !== undefined) existing.status = b.status === "Inactive" ? "Inactive" : "Active";
    if (b.isFeatured !== undefined) existing.isFeatured = b.isFeatured === "true" || b.isFeatured === true;
    if (b.order !== undefined) existing.order = Number.isNaN(Number(b.order)) ? existing.order : Number(b.order);

    if (b.category !== undefined && b.category.trim()) {
      existing.category = b.category.trim();
      existing.categoryKey = b.categoryKey
        ? b.categoryKey.trim().toLowerCase()
        : existing.category.toLowerCase().replace(/[^a-z0-9]/g, "");
    }

    // Main cover image update
    if (req.file) {
      existing.image = {
        local: toRelativePath(req.file.path),
        cloudinary: "",
      };
    } else if (req.files && req.files.image && req.files.image[0]) {
      existing.image = {
        local: toRelativePath(req.files.image[0].path),
        cloudinary: "",
      };
    } else if (req.files && req.files.mediaImage && req.files.mediaImage[0]) {
      existing.image = {
        local: toRelativePath(req.files.mediaImage[0].path),
        cloudinary: "",
      };
    } else if (b.imageUrl && typeof b.imageUrl === "string") {
      existing.image = { local: b.imageUrl, cloudinary: "" };
    }

    // Handle existing gallery photos vs deletions
    let currentGallery = existing.gallery || [];
    if (b.retainedGallery !== undefined) {
      try {
        const retained = typeof b.retainedGallery === "string" ? JSON.parse(b.retainedGallery) : b.retainedGallery;
        if (Array.isArray(retained)) {
          currentGallery = currentGallery.filter((img) =>
            retained.some((r) => (r._id && String(r._id) === String(img._id)) || r.local === img.local)
          );
        }
      } catch (e) {
        console.warn("Could not parse retainedGallery:", e.message);
      }
    }

    // Add newly uploaded gallery images
    const newGalleryFiles = [];
    if (req.files && Array.isArray(req.files.gallery)) {
      newGalleryFiles.push(...req.files.gallery);
    }
    if (req.files && Array.isArray(req.files.galleryImages)) {
      newGalleryFiles.push(...req.files.galleryImages);
    }

    for (const f of newGalleryFiles) {
      currentGallery.push({
        local: toRelativePath(f.path),
        title: f.originalname || "",
        createdAt: new Date(),
      });
    }

    existing.gallery = currentGallery;

    // Update sub-items if passed
    if (b.items !== undefined) {
      if (Array.isArray(b.items)) {
        existing.items = b.items;
      } else if (typeof b.items === "string") {
        try {
          existing.items = JSON.parse(b.items);
        } catch (e) {
          console.warn("Could not parse items JSON on update:", e.message);
        }
      }
    }

    // Dynamically update metaText if it's Media/Gallery
    const cat = existing.category.toLowerCase();
    const count = existing.gallery.length > 0 ? existing.gallery.length : (existing.items.length || 0);
    if (cat.includes("media") || cat.includes("gallery") || existing.metaText.includes("120")) {
      existing.metaText = `${count} Photos`;
    }

    await existing.save();

    return res.status(200).json({
      success: true,
      message: "Media / Event updated successfully",
      mediaEvent: normalizeMediaEvent(existing, req),
    });
  } catch (error) {
    console.error("Update media event error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── TOGGLE STATUS ────────────────────────────────────────────────────────────
export const toggleMediaEventStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await MediaEvent.findById(id);
    if (!item) {
      return res.status(404).json({ success: false, message: "Media / Event not found" });
    }

    item.status = item.status === "Active" ? "Inactive" : "Active";
    await item.save();

    return res.status(200).json({
      success: true,
      message: `Status updated to ${item.status}`,
      status: item.status,
      mediaEvent: normalizeMediaEvent(item, req),
    });
  } catch (error) {
    console.error("Toggle media event status error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── DELETE ───────────────────────────────────────────────────────────────────
export const deleteMediaEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await MediaEvent.findById(id);
    if (!item) {
      return res.status(404).json({ success: false, message: "Media / Event not found" });
    }

    // Try cleaning local files
    try {
      if (item.image && item.image.local && !item.image.local.startsWith("http")) {
        const fullImgPath = path.join(__dirname, "..", item.image.local);
        if (fs.existsSync(fullImgPath)) {
          fs.unlinkSync(fullImgPath);
        }
      }
      if (Array.isArray(item.gallery)) {
        for (const g of item.gallery) {
          if (g.local && !g.local.startsWith("http")) {
            const p = path.join(__dirname, "..", g.local);
            if (fs.existsSync(p)) fs.unlinkSync(p);
          }
        }
      }
    } catch (e) {
      console.warn("Could not delete media image file:", e.message);
    }

    await MediaEvent.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Media / Event deleted successfully",
    });
  } catch (error) {
    console.error("Delete media event error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
