import Category from "../../model/category.model.js";
import Subcategory from "../../model/subcategory.model.js";
import TestService from "../../model/testService.model.js";
import { uploadAndKeepLocal } from "../../utils/cloudinary.js";

// POST /categories
export const createCategory = async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ success: false, message: "Category name is required" });

    const existing = await Category.findOne({ name });
    if (existing) return res.status(400).json({ success: false, message: "Category already exists" });

    let imageData = { local: "", cloudinary: "" };
    if (req.file) {
      const cloudinaryUrl = await uploadAndKeepLocal(req.file.path, "pathology/categories");
      imageData = {
        local: req.file.path.replace(/\\/g, '/'),
        cloudinary: cloudinaryUrl || ""
      };
    }

    const category = await Category.create({ 
      name, 
      description,
      image: imageData
    });
    res.status(201).json({ success: true, message: "Category created successfully", data: category });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /categories
export const getCategories = async (req, res) => {
  try {
    const categories = await Category.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: categories.length, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /categories/tree/:id
export const getCategoryTree = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findById(id);
    if (!category) return res.status(404).json({ success: false, message: "Category not found" });

    // Fetch all tests under this category
    const services = await TestService.find({ 
      category_id: id, 
      status: true 
    }).select('title status fasting_required sample_type report_time mrp price test_code image');

    res.status(200).json({ 
      success: true, 
      data: {
        ...category.toObject(),
        services
      } 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PATCH /categories/:id
export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, status } = req.body;
    
    let updateData = { name, description, status };

    if (req.file) {
      const cloudinaryUrl = await uploadAndKeepLocal(req.file.path, "pathology/categories");
      updateData.image = {
        local: req.file.path.replace(/\\/g, '/'),
        cloudinary: cloudinaryUrl || ""
      };
    }

    const category = await Category.findByIdAndUpdate(id, updateData, { new: true });
    if (!category) return res.status(404).json({ success: false, message: "Category not found" });
    res.status(200).json({ success: true, message: "Category updated successfully", data: category });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /categories/:id
export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findByIdAndDelete(id);
    if (!category) return res.status(404).json({ success: false, message: "Category not found" });
    res.status(200).json({ success: true, message: "Category deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
