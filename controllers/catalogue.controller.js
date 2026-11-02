import Catalogue from "../model/catalogue.model.js";
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

const normalizeCatalogue = (item, req) => {
  const doc = item && item.toObject ? item.toObject() : { ...item };
  let localPath = "";
  if (doc.cover && typeof doc.cover === "object") {
    localPath = (doc.cover.local || "").trim();
  } else if (typeof doc.cover === "string") {
    localPath = doc.cover.trim();
  }

  let fullCoverUrl = "";
  if (localPath) {
    if (localPath.startsWith("http://") || localPath.startsWith("https://") || localPath.startsWith("data:")) {
      fullCoverUrl = localPath;
    } else {
      const clean = localPath.replace(/^\/+/, "");
      if (req && req.get) {
        fullCoverUrl = `${req.protocol}://${req.get("host")}/${clean}`;
      } else {
        fullCoverUrl = `http://localhost:3000/${clean}`;
      }
    }
  }

  doc.coverUrl = fullCoverUrl;
  doc.bannerUrl = fullCoverUrl; // Alias for consistency
  return doc;
};

// ── CREATE ────────────────────────────────────────────────────────────────────
export const createCatalogue = async (req, res) => {
  try {
    const b = req.body;
    if (!b.title) {
      return res.status(400).json({ success: false, message: "Title is required" });
    }

    let coverData = { local: "", cloudinary: "" };
    if (req.file) {
      coverData.local = toRelativePath(req.file.path);
    } else if (req.files && req.files.cover && req.files.cover[0]) {
      coverData.local = toRelativePath(req.files.cover[0].path);
    } else if (req.files && req.files.banner && req.files.banner[0]) {
      coverData.local = toRelativePath(req.files.banner[0].path);
    } else if (b.coverUrl && typeof b.coverUrl === "string") {
      coverData.local = b.coverUrl;
    } else if (b.banner && typeof b.banner === "string") {
      coverData.local = b.banner;
    }

    let fileData = { local: "", cloudinary: "" };
    if (req.files && req.files.file && req.files.file[0]) {
      fileData.local = toRelativePath(req.files.file[0].path);
    }

    const catalogue = await Catalogue.create({
      title: b.title.trim(),
      subtitle: b.subtitle ? b.subtitle.trim() : "",
      description: b.description ? b.description.trim() : "",
      cover: coverData,
      file: fileData,
      fileSize: b.fileSize ? b.fileSize.trim() : "",
      pages: b.pages ? String(b.pages).trim() : "24",
      status: b.status === "Inactive" ? "Inactive" : "Active",
      isFeatured: b.isFeatured === "true" || b.isFeatured === true,
      order: Number.isNaN(Number(b.order)) ? 0 : Number(b.order),
    });

    return res.status(201).json({
      success: true,
      message: "Catalogue created successfully",
      catalogue: normalizeCatalogue(catalogue, req),
    });
  } catch (error) {
    console.error("Create catalogue error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── GET ALL (Admin) ──────────────────────────────────────────────────────────
export const getAllCatalogues = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = "",
      status = "",
      sortBy = "order",
      sortOrder = "asc",
    } = req.query;

    const query = {};

    if (status && status !== "All") {
      query.status = status;
    }

    if (search && search.trim()) {
      const q = search.trim();
      query.$or = [
        { title: { $regex: q, $options: "i" } },
        { subtitle: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } },
      ];
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

    const [catalogues, total] = await Promise.all([
      Catalogue.find(query).sort(sortOptions).skip(skip).limit(limitNum).lean(),
      Catalogue.countDocuments(query),
    ]);

    const normalized = catalogues.map((item) => normalizeCatalogue(item, req));

    return res.status(200).json({
      success: true,
      catalogues: normalized,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (error) {
    console.error("Get all catalogues error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── GET ACTIVE (Public Website) ───────────────────────────────────────────────
export const getActiveCatalogues = async (req, res) => {
  try {
    const catalogues = await Catalogue.find({ status: "Active" })
      .sort({ order: 1, createdAt: -1 })
      .lean();

    const normalized = catalogues.map((item) => normalizeCatalogue(item, req));

    return res.status(200).json({
      success: true,
      catalogues: normalized,
      count: normalized.length,
    });
  } catch (error) {
    console.error("Get active catalogues error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── GET BY ID ────────────────────────────────────────────────────────────────
export const getCatalogueById = async (req, res) => {
  try {
    const { id } = req.params;
    const catalogue = await Catalogue.findById(id).lean();
    if (!catalogue) {
      return res.status(404).json({ success: false, message: "Catalogue not found" });
    }
    return res.status(200).json({
      success: true,
      catalogue: normalizeCatalogue(catalogue, req),
    });
  } catch (error) {
    console.error("Get catalogue by id error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── UPDATE ───────────────────────────────────────────────────────────────────
export const updateCatalogue = async (req, res) => {
  try {
    const { id } = req.params;
    const b = req.body;

    const existing = await Catalogue.findById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "Catalogue not found" });
    }

    if (b.title !== undefined) existing.title = b.title.trim();
    if (b.subtitle !== undefined) existing.subtitle = b.subtitle.trim();
    if (b.description !== undefined) existing.description = b.description.trim();
    if (b.fileSize !== undefined) existing.fileSize = b.fileSize.trim();
    if (b.pages !== undefined) existing.pages = String(b.pages).trim();
    if (b.status !== undefined) existing.status = b.status === "Inactive" ? "Inactive" : "Active";
    if (b.isFeatured !== undefined) existing.isFeatured = b.isFeatured === "true" || b.isFeatured === true;
    if (b.order !== undefined) existing.order = Number.isNaN(Number(b.order)) ? existing.order : Number(b.order);

    // If new cover uploaded
    if (req.file) {
      existing.cover = {
        local: toRelativePath(req.file.path),
        cloudinary: "",
      };
    } else if (req.files && req.files.cover && req.files.cover[0]) {
      existing.cover = {
        local: toRelativePath(req.files.cover[0].path),
        cloudinary: "",
      };
    } else if (req.files && req.files.banner && req.files.banner[0]) {
      existing.cover = {
        local: toRelativePath(req.files.banner[0].path),
        cloudinary: "",
      };
    } else if (b.coverUrl && typeof b.coverUrl === "string") {
      existing.cover = { local: b.coverUrl, cloudinary: "" };
    }

    // If new document file uploaded
    if (req.files && req.files.file && req.files.file[0]) {
      existing.file = {
        local: toRelativePath(req.files.file[0].path),
        cloudinary: "",
      };
    }

    await existing.save();

    return res.status(200).json({
      success: true,
      message: "Catalogue updated successfully",
      catalogue: normalizeCatalogue(existing, req),
    });
  } catch (error) {
    console.error("Update catalogue error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── TOGGLE STATUS ────────────────────────────────────────────────────────────
export const toggleCatalogueStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const catalogue = await Catalogue.findById(id);
    if (!catalogue) {
      return res.status(404).json({ success: false, message: "Catalogue not found" });
    }

    catalogue.status = catalogue.status === "Active" ? "Inactive" : "Active";
    await catalogue.save();

    return res.status(200).json({
      success: true,
      message: `Catalogue status updated to ${catalogue.status}`,
      status: catalogue.status,
      catalogue: normalizeCatalogue(catalogue, req),
    });
  } catch (error) {
    console.error("Toggle catalogue status error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── DELETE ───────────────────────────────────────────────────────────────────
export const deleteCatalogue = async (req, res) => {
  try {
    const { id } = req.params;
    const catalogue = await Catalogue.findById(id);
    if (!catalogue) {
      return res.status(404).json({ success: false, message: "Catalogue not found" });
    }

    // Try cleaning local file if exists
    try {
      if (catalogue.cover && catalogue.cover.local && !catalogue.cover.local.startsWith("http")) {
        const fullCoverPath = path.join(__dirname, "..", catalogue.cover.local);
        if (fs.existsSync(fullCoverPath)) {
          fs.unlinkSync(fullCoverPath);
        }
      }
    } catch (e) {
      console.warn("Could not delete catalogue cover file:", e.message);
    }

    await Catalogue.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Catalogue deleted successfully",
    });
  } catch (error) {
    console.error("Delete catalogue error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
