import Presentation from "../model/presentation.model.js";
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

const formatDisplayDate = (dateVal) => {
  if (dateVal && typeof dateVal === "string" && dateVal.trim()) return dateVal.trim();
  const d = new Date();
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const normalizePresentation = (item, req) => {
  const doc = item && item.toObject ? item.toObject() : { ...item };
  let localPath = "";
  if (doc.banner && typeof doc.banner === "object") {
    localPath = (doc.banner.local || "").trim();
  } else if (typeof doc.banner === "string") {
    localPath = doc.banner.trim();
  }

  let fullBannerUrl = "";
  if (localPath) {
    if (localPath.startsWith("http://") || localPath.startsWith("https://") || localPath.startsWith("data:")) {
      fullBannerUrl = localPath;
    } else {
      const clean = localPath.replace(/^\/+/, "");
      if (req && req.get) {
        fullBannerUrl = `${req.protocol}://${req.get("host")}/${clean}`;
      } else {
        fullBannerUrl = `http://localhost:3000/${clean}`;
      }
    }
  }

  doc.bannerUrl = fullBannerUrl;
  return doc;
};

// ── CREATE ────────────────────────────────────────────────────────────────────
export const createPresentation = async (req, res) => {
  try {
    const b = req.body;
    if (!b.title) {
      return res.status(400).json({ success: false, message: "Title is required" });
    }

    let bannerData = { local: "", cloudinary: "" };
    if (req.file) {
      bannerData.local = toRelativePath(req.file.path);
    } else if (b.bannerUrl && typeof b.bannerUrl === "string") {
      bannerData.local = b.bannerUrl;
    }

    const presentation = await Presentation.create({
      title: b.title.trim(),
      description: b.description ? b.description.trim() : "",
      category: b.category ? b.category.trim() : "Company Profile",
      banner: bannerData,
      type: b.type ? b.type.trim() : "PDF",
      pages: b.pages ? String(b.pages).trim() : "20",
      date: formatDisplayDate(b.date),
      fileUrl: b.fileUrl ? b.fileUrl.trim() : "",
      status: b.status === "false" || b.status === false ? false : true,
      sortOrder: Number(b.sortOrder) || 0,
    });

    res.status(201).json({
      success: true,
      message: "Presentation created successfully",
      data: normalizePresentation(presentation, req),
    });
  } catch (err) {
    console.error("createPresentation Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── UPDATE ────────────────────────────────────────────────────────────────────
export const updatePresentation = async (req, res) => {
  try {
    const { id } = req.params;
    const b = req.body;

    const existing = await Presentation.findById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "Presentation not found" });
    }

    const updateData = {};
    if (b.title !== undefined) updateData.title = b.title.trim();
    if (b.description !== undefined) updateData.description = b.description.trim();
    if (b.category !== undefined) updateData.category = b.category.trim();
    if (b.type !== undefined) updateData.type = b.type.trim();
    if (b.pages !== undefined) updateData.pages = String(b.pages).trim();
    if (b.date !== undefined) updateData.date = formatDisplayDate(b.date);
    if (b.fileUrl !== undefined) updateData.fileUrl = b.fileUrl.trim();
    if (b.sortOrder !== undefined) updateData.sortOrder = Number(b.sortOrder);
    if (b.status !== undefined) updateData.status = b.status === "true" || b.status === true;

    if (req.file) {
      // Remove previous local file if it was custom uploaded
      if (existing.banner?.local && !existing.banner.local.includes("pres-")) {
        const oldPath = path.join(__dirname, "..", existing.banner.local);
        if (fs.existsSync(oldPath)) {
          try { fs.unlinkSync(oldPath); } catch (_) {}
        }
      }
      updateData.banner = {
        local: toRelativePath(req.file.path),
        cloudinary: "",
      };
    } else if (b.bannerUrl && typeof b.bannerUrl === "string") {
      updateData.banner = {
        local: b.bannerUrl,
        cloudinary: "",
      };
    }

    const updated = await Presentation.findByIdAndUpdate(id, updateData, { new: true });

    res.status(200).json({
      success: true,
      message: "Presentation updated successfully",
      data: normalizePresentation(updated, req),
    });
  } catch (err) {
    console.error("updatePresentation Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET ALL (Admin) ───────────────────────────────────────────────────────────
export const getAllPresentations = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = "", status, category } = req.query;
    const query = {};

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { category: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    if (status !== undefined && status !== "") {
      query.status = status === "true" || status === true;
    }

    if (category && category !== "All") {
      query.category = { $regex: new RegExp(`^${category}$`, "i") };
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.max(1, parseInt(limit, 10));
    const skip = (pageNum - 1) * limitNum;

    const total = await Presentation.countDocuments(query);
    const presentations = await Presentation.find(query)
      .sort({ sortOrder: 1, createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    res.status(200).json({
      success: true,
      total,
      totalPages: Math.ceil(total / limitNum) || 1,
      currentPage: pageNum,
      count: presentations.length,
      data: presentations.map((item) => normalizePresentation(item, req)),
    });
  } catch (err) {
    console.error("getAllPresentations Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET ACTIVE (Public Website) ───────────────────────────────────────────────
export const getActivePresentations = async (req, res) => {
  try {
    const { category, search } = req.query;
    const query = { status: true };

    if (category && category !== "All") {
      query.category = { $regex: new RegExp(`^${category}$`, "i") };
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { category: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const presentations = await Presentation.find(query).sort({
      sortOrder: 1,
      createdAt: -1,
    });

    res.status(200).json({
      success: true,
      count: presentations.length,
      data: presentations.map((item) => normalizePresentation(item, req)),
    });
  } catch (err) {
    console.error("getActivePresentations Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET CATEGORIES ────────────────────────────────────────────────────────────
export const getPresentationCategories = async (req, res) => {
  try {
    const rawCategories = await Presentation.distinct("category");
    const counts = await Presentation.aggregate([
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
          activeCount: { $sum: { $cond: ["$status", 1, 0] } },
        },
      },
      { $sort: { count: -1 } },
    ]);

    const categories = rawCategories
      .filter((c) => c && typeof c === "string" && c.trim())
      .map((c) => c.trim());

    res.status(200).json({
      success: true,
      data: categories,
      counts: counts.map((item) => ({
        category: item._id,
        count: item.count,
        activeCount: item.activeCount,
      })),
    });
  } catch (err) {
    console.error("getPresentationCategories Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET BY ID ─────────────────────────────────────────────────────────────────
export const getPresentationById = async (req, res) => {
  try {
    const { id } = req.params;
    const presentation = await Presentation.findById(id);
    if (!presentation) {
      return res.status(404).json({ success: false, message: "Presentation not found" });
    }
    res.status(200).json({
      success: true,
      data: normalizePresentation(presentation, req),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── DELETE ────────────────────────────────────────────────────────────────────
export const deletePresentation = async (req, res) => {
  try {
    const { id } = req.params;
    const presentation = await Presentation.findByIdAndDelete(id);
    if (!presentation) {
      return res.status(404).json({ success: false, message: "Presentation not found" });
    }

    // Attempt deleting local banner file
    if (presentation.banner?.local && !presentation.banner.local.includes("pres-")) {
      const filePath = path.join(__dirname, "..", presentation.banner.local);
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch (_) {}
      }
    }

    res.status(200).json({ success: true, message: "Presentation deleted successfully" });
  } catch (err) {
    console.error("deletePresentation Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── TOGGLE STATUS ─────────────────────────────────────────────────────────────
export const togglePresentationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const presentation = await Presentation.findById(id);
    if (!presentation) {
      return res.status(404).json({ success: false, message: "Presentation not found" });
    }

    presentation.status = !presentation.status;
    await presentation.save();

    res.status(200).json({
      success: true,
      message: `Presentation ${presentation.status ? "activated" : "deactivated"} successfully`,
      data: normalizePresentation(presentation, req),
    });
  } catch (err) {
    console.error("togglePresentationStatus Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};
