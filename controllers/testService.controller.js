import TestService from "../model/testService.model.js";
import { uploadAndKeepLocal } from "../utils/cloudinary.js";

// ── Helper: Parse and Clean Data ──────────────────────────────────────────────
const cleanStr = (val) => {
  if (typeof val !== "string") return val;
  // Remove starting/ending quotes and whitespace if double-quoted
  let s = val.trim();
  if (s.startsWith('"') && s.endsWith('"')) s = s.substring(1, s.length - 1);
  return s.trim();
};

const parseArrayField = (val) => {
  if (Array.isArray(val)) return val;
  if (typeof val === "string" && val.trim() !== "") {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }
  return [];
};

// ── CREATE ───────────────────────────────────────────────────────────────────
export const createTestService = async (req, res) => {
  try {
    const b = req.body;
    
    // Handle image
    let imageData = { local: "", cloudinary: "" };
    if (req.file) {
      const cloudinaryUrl = await uploadAndKeepLocal(req.file.path, "pathology/tests");
      imageData = { local: req.file.path.replace(/\\/g, "/"), cloudinary: cloudinaryUrl || "" };
    }

    const newService = await TestService.create({
      title:              cleanStr(b.title),
      test_code:          cleanStr(b.test_code),
      status:             b.status === "true" || b.status === true,
      is_featured:        b.is_featured === "true" || b.is_featured === true,
      category_id:        (b.category_id && b.category_id !== "null") ? b.category_id : null,
      mrp:                Number(b.mrp) || 0,
      price:              Number(b.price) || 0,
      sample_type:        cleanStr(b.sample_type),
      report_time:        cleanStr(b.report_time),
      short_description:  cleanStr(b.short_description),
      overview:           b.overview || "", // Rich text, don't trim quotes
      test_method:        cleanStr(b.test_method),
      fasting_required:   b.fasting_required === "true" || b.fasting_required === true,
      fasting_hours:      Number(b.fasting_hours) || 0,
      precautions_during: cleanStr(b.precautions_during),
      instruction_text:   cleanStr(b.instruction_text),
      // Array fields
      purpose:            parseArrayField(b.purpose),
      test_components:    parseArrayField(b.test_components),
      precautions_before: parseArrayField(b.precautions_before),
      precautions_after:  parseArrayField(b.precautions_after),
      instructions:       parseArrayField(b.instructions),
      image: imageData,
    });

    res.status(201).json({ success: true, message: "Created successfully", data: newService });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── UPDATE ───────────────────────────────────────────────────────────────────
export const updateTestService = async (req, res) => {
  try {
    const b = req.body;
    const updateData = {};

    // Strings
    const stringFields = ["title", "test_code", "sample_type", "report_time", "short_description", "test_method", "precautions_during", "instruction_text"];
    stringFields.forEach(f => { if (b[f] !== undefined) updateData[f] = cleanStr(b[f]); });

    if (b.overview !== undefined) updateData.overview = b.overview;

    // Numbers
    if (b.mrp !== undefined)   updateData.mrp = Number(b.mrp);
    if (b.price !== undefined) updateData.price = Number(b.price);
    if (b.fasting_hours !== undefined) updateData.fasting_hours = Number(b.fasting_hours);

    // Booleans
    if (b.status !== undefined)           updateData.status = (b.status === "true" || b.status === true);
    if (b.is_featured !== undefined)      updateData.is_featured = (b.is_featured === "true" || b.is_featured === true);
    if (b.fasting_required !== undefined) updateData.fasting_required = (b.fasting_required === "true" || b.fasting_required === true);

    // Category
    if (b.category_id !== undefined) updateData.category_id = (b.category_id === "" || b.category_id === "null") ? null : b.category_id;

    // Arrays
    const arrayFields = ["purpose", "test_components", "precautions_before", "precautions_after", "instructions"];
    arrayFields.forEach(f => { if (b[f] !== undefined) updateData[f] = parseArrayField(b[f]); });

    // Image
    if (req.file) {
      const cloudinaryUrl = await uploadAndKeepLocal(req.file.path, "pathology/tests");
      updateData.image = { local: req.file.path.replace(/\\/g, "/"), cloudinary: cloudinaryUrl || "" };
    }

    const service = await TestService.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!service) return res.status(404).json({ success: false, message: "Not found" });
    res.status(200).json({ success: true, message: "Updated successfully", data: service });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET ALL ──────────────────────────────────────────────────────────────────
export const getAllTestServices = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "", status, category_id } = req.query;
    const query = {};
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { test_code: { $regex: search, $options: "i" } }
      ];
    }
    if (status !== undefined && status !== "") {
      query.status = (status === "true" || status === true);
    }
    if (category_id) query.category_id = category_id;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await TestService.countDocuments(query);
    const services = await TestService.find(query)
      .populate('category_id', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      data: services,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET BY ID ────────────────────────────────────────────────────────────────
export const getTestServiceById = async (req, res) => {
  try {
    let id = req.params.id;
    // Remove any non-hex characters just in case
    id = id.replace(/[^a-fA-F0-9]/g, "").trim(); 
    
    console.log("CLEANED ID FOR SEARCH:", id);

    let service = await TestService.findById(id); 
    
    if (!service) {
      service = await TestService.findOne({ _id: id });
    }
    
    if (!service) {
      return res.status(404).json({ success: false, message: `Test with ID ${id} not found in database.` });
    }
    
    // Now populate if found
    await service.populate('category_id', 'name');
    
    res.status(200).json({ success: true, data: service });
  } catch (err) {
    console.error("CRITICAL GET_BY_ID ERROR:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── DELETE ───────────────────────────────────────────────────────────────────
export const deleteTestService = async (req, res) => {
  try {
    const service = await TestService.findByIdAndDelete(req.params.id);
    if (!service) return res.status(404).json({ success: false, message: "Not found" });
    res.status(200).json({ success: true, message: "Deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── STATUS ───────────────────────────────────────────────────────────────────
export const updateTestServiceStatus = async (req, res) => {
  try {
    const service = await TestService.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
    if (!service) return res.status(404).json({ success: false, message: "Not found" });
    res.status(200).json({ success: true, message: "Status updated", data: service });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── BULK ─────────────────────────────────────────────────────────────────────
export const bulkCreateTestServices = async (req, res) => {
  try {
    const { services } = req.body;
    if (!services || !Array.isArray(services) || services.length === 0) {
      return res.status(400).json({ success: false, message: "No services provided" });
    }

    // Get all categories once for name→id lookup
    const Category = (await import('../model/category.model.js')).default;
    const allCategories = await Category.find({}, '_id name');
    const catMap = {};
    allCategories.forEach(c => { catMap[c.name.toLowerCase().trim()] = c._id; });

    const results = { imported: 0, errors: [] };

    for (const row of services) {
      try {
        if (!row.title) {
          results.errors.push(`Row missing title — skipped`);
          continue;
        }

        // Resolve category name to ObjectId
        let category_id = null;
        if (row.category) {
          category_id = catMap[row.category.toLowerCase().trim()] || null;
          if (!category_id) results.errors.push(`Category "${row.category}" not found for "${row.title}" — saved without category`);
        }

        await TestService.create({
          title:              cleanStr(row.title),
          test_code:          cleanStr(row.test_code || ""),
          category_id,
          mrp:                Number(row.mrp) || 0,
          price:              Number(row.price) || 0,
          sample_type:        cleanStr(row.sample_type || ""),
          report_time:        cleanStr(row.report_time || ""),
          short_description:  cleanStr(row.short_description || ""),
          overview:           row.overview || "",
          test_method:        cleanStr(row.test_method || ""),
          precautions_during: cleanStr(row.precautions_during || ""),
          instruction_text:   cleanStr(row.instruction_text || ""),
          fasting_required:   row.fasting_required === true || row.fasting_required === "true" || row.fasting_required === 1,
          fasting_hours:      Number(row.fasting_hours) || 0,
          status:             row.status === false || row.status === "false" || row.status === 0 ? false : true,
          is_featured:        row.is_featured === true || row.is_featured === "true" || row.is_featured === 1,
        });
        results.imported++;
      } catch (err) {
        results.errors.push(`"${row.title}": ${err.message}`);
      }
    }

    res.status(201).json({
      success: true,
      message: `${results.imported} tests imported successfully${results.errors.length ? `, ${results.errors.length} skipped` : ""}`,
      data: results,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
