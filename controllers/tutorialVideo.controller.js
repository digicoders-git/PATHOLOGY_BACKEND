import TutorialVideo from "../model/tutorialVideo.model.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const extractYoutubeId = (url) => {
  if (!url) return "";
  const trimmed = url.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;

  const regExp = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = trimmed.match(regExp);
  return match && match[1] ? match[1] : "";
};

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

const normalizeTutorial = (item, req) => {
  const doc = item && item.toObject ? item.toObject() : { ...item };
  let localPath = "";
  if (doc.thumbnail && typeof doc.thumbnail === "object") {
    localPath = (doc.thumbnail.local || "").trim();
  } else if (typeof doc.thumbnail === "string") {
    localPath = doc.thumbnail.trim();
  }

  let fullThumbnailUrl = "";
  if (localPath) {
    if (localPath.startsWith("http://") || localPath.startsWith("https://") || localPath.startsWith("data:")) {
      fullThumbnailUrl = localPath;
    } else {
      const clean = localPath.replace(/^\/+/, "");
      if (req && req.get) {
        fullThumbnailUrl = `${req.protocol}://${req.get("host")}/${clean}`;
      } else {
        fullThumbnailUrl = `https://api.laboindia.com/${clean}`;
      }
    }
  } else if (doc.youtubeId) {
    fullThumbnailUrl = `https://img.youtube.com/vi/${doc.youtubeId}/hqdefault.jpg`;
  }

  doc.thumbnailUrl = fullThumbnailUrl;
  return doc;
};

// ── CREATE ────────────────────────────────────────────────────────────────────
export const createTutorialVideo = async (req, res) => {
  try {
    const b = req.body;
    if (!b.title) {
      return res.status(400).json({ success: false, message: "Title is required" });
    }

    let thumbnailData = { local: "", cloudinary: "" };
    if (req.file) {
      thumbnailData.local = toRelativePath(req.file.path);
    } else if (b.thumbnailUrl && typeof b.thumbnailUrl === "string") {
      thumbnailData.local = b.thumbnailUrl;
    }

    const videoUrl = (b.videoUrl || "").trim();
    const youtubeId = b.youtubeId ? b.youtubeId.trim() : extractYoutubeId(videoUrl);

    const tutorial = await TutorialVideo.create({
      title: b.title.trim(),
      category: b.category ? b.category.trim() : "Patient Guide",
      description: b.description ? b.description.trim() : "",
      videoUrl: videoUrl,
      youtubeId: youtubeId,
      thumbnail: thumbnailData,
      duration: b.duration ? b.duration.trim() : "03:30",
      date: formatDisplayDate(b.date),
      views: b.views ? b.views.trim() : "1.0K Views",
      status: b.status === "false" || b.status === false ? false : true,
      sortOrder: Number(b.sortOrder) || 0,
    });

    res.status(201).json({
      success: true,
      message: "Tutorial video created successfully",
      data: normalizeTutorial(tutorial, req),
    });
  } catch (err) {
    console.error("createTutorialVideo Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── UPDATE ────────────────────────────────────────────────────────────────────
export const updateTutorialVideo = async (req, res) => {
  try {
    const { id } = req.params;
    const b = req.body;

    const existing = await TutorialVideo.findById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "Tutorial video not found" });
    }

    const updateData = {};
    if (b.title !== undefined) updateData.title = b.title.trim();
    if (b.category !== undefined) updateData.category = b.category.trim();
    if (b.description !== undefined) updateData.description = b.description.trim();
    if (b.duration !== undefined) updateData.duration = b.duration.trim();
    if (b.date !== undefined) updateData.date = formatDisplayDate(b.date);
    if (b.views !== undefined) updateData.views = b.views.trim();
    if (b.sortOrder !== undefined) updateData.sortOrder = Number(b.sortOrder);
    if (b.status !== undefined) updateData.status = b.status === "true" || b.status === true;

    if (b.videoUrl !== undefined) {
      updateData.videoUrl = b.videoUrl.trim();
      updateData.youtubeId = b.youtubeId ? b.youtubeId.trim() : extractYoutubeId(b.videoUrl);
    } else if (b.youtubeId !== undefined) {
      updateData.youtubeId = b.youtubeId.trim();
    }

    if (req.file) {
      // Remove previous local file if it was custom uploaded
      if (existing.thumbnail?.local && !existing.thumbnail.local.includes("banner-")) {
        const oldPath = path.join(__dirname, "..", existing.thumbnail.local);
        if (fs.existsSync(oldPath)) {
          try { fs.unlinkSync(oldPath); } catch (_) {}
        }
      }
      updateData.thumbnail = {
        local: toRelativePath(req.file.path),
        cloudinary: "",
      };
    } else if (b.thumbnailUrl && typeof b.thumbnailUrl === "string") {
      updateData.thumbnail = {
        local: b.thumbnailUrl,
        cloudinary: "",
      };
    }

    const updated = await TutorialVideo.findByIdAndUpdate(id, updateData, { new: true });

    res.status(200).json({
      success: true,
      message: "Tutorial video updated successfully",
      data: normalizeTutorial(updated, req),
    });
  } catch (err) {
    console.error("updateTutorialVideo Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET ALL (Admin) ───────────────────────────────────────────────────────────
export const getAllTutorialVideos = async (req, res) => {
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

    const total = await TutorialVideo.countDocuments(query);
    const tutorials = await TutorialVideo.find(query)
      .sort({ sortOrder: 1, createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    res.status(200).json({
      success: true,
      total,
      totalPages: Math.ceil(total / limitNum) || 1,
      currentPage: pageNum,
      count: tutorials.length,
      data: tutorials.map((item) => normalizeTutorial(item, req)),
    });
  } catch (err) {
    console.error("getAllTutorialVideos Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET ACTIVE (Public Website) ───────────────────────────────────────────────
export const getActiveTutorialVideos = async (req, res) => {
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

    const tutorials = await TutorialVideo.find(query).sort({
      sortOrder: 1,
      createdAt: -1,
    });

    res.status(200).json({
      success: true,
      count: tutorials.length,
      data: tutorials.map((item) => normalizeTutorial(item, req)),
    });
  } catch (err) {
    console.error("getActiveTutorialVideos Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET BY ID ─────────────────────────────────────────────────────────────────
export const getTutorialVideoById = async (req, res) => {
  try {
    const { id } = req.params;
    const tutorial = await TutorialVideo.findById(id);
    if (!tutorial) {
      return res.status(404).json({ success: false, message: "Tutorial video not found" });
    }
    res.status(200).json({
      success: true,
      data: normalizeTutorial(tutorial, req),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── DELETE ────────────────────────────────────────────────────────────────────
export const deleteTutorialVideo = async (req, res) => {
  try {
    const { id } = req.params;
    const tutorial = await TutorialVideo.findByIdAndDelete(id);
    if (!tutorial) {
      return res.status(404).json({ success: false, message: "Tutorial video not found" });
    }

    // Attempt deleting local thumbnail file
    if (tutorial.thumbnail?.local && !tutorial.thumbnail.local.includes("banner-")) {
      const filePath = path.join(__dirname, "..", tutorial.thumbnail.local);
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch (_) {}
      }
    }

    res.status(200).json({ success: true, message: "Tutorial video deleted successfully" });
  } catch (err) {
    console.error("deleteTutorialVideo Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── TOGGLE STATUS ─────────────────────────────────────────────────────────────
export const toggleTutorialVideoStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const tutorial = await TutorialVideo.findById(id);
    if (!tutorial) {
      return res.status(404).json({ success: false, message: "Tutorial video not found" });
    }

    tutorial.status = !tutorial.status;
    await tutorial.save();

    res.status(200).json({
      success: true,
      message: `Tutorial video ${tutorial.status ? "activated" : "deactivated"} successfully`,
      data: normalizeTutorial(tutorial, req),
    });
  } catch (err) {
    console.error("toggleTutorialVideoStatus Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};


// ── GET CATEGORIES (Dynamic Categories) ───────────────────────────────────────
export const getTutorialCategories = async (req, res) => {
  try {
    const rawCategories = await TutorialVideo.distinct("category");
    const counts = await TutorialVideo.aggregate([
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
    console.error("getTutorialCategories Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};
