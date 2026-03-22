import Subcategory from "../../model/subcategory.model.js";

// POST /subcategories
export const createSubcategory = async (req, res) => {
  try {
    const { name, category_id, description } = req.body;
    if (!name || !category_id) {
      return res.status(400).json({ success: false, message: "Subcategory name and category_id are required" });
    }

    const existing = await Subcategory.findOne({ name, category_id });
    if (existing) return res.status(400).json({ success: false, message: "Subcategory already exists for this category" });

    const subcategory = await Subcategory.create({ name, category_id, description });
    res.status(201).json({ success: true, message: "Subcategory created successfully", data: subcategory });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /subcategories?category_id=
export const getSubcategories = async (req, res) => {
  try {
    const { category_id } = req.query;
    const query = {};
    if (category_id) query.category_id = category_id;

    const subcategories = await Subcategory.find(query).populate('category_id').sort({ name: 1 });
    res.status(200).json({ success: true, count: subcategories.length, data: subcategories });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PATCH /subcategories/:id
export const updateSubcategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, status } = req.body;
    const subcategory = await Subcategory.findByIdAndUpdate(id, { name, description, status }, { new: true });
    if (!subcategory) return res.status(404).json({ success: false, message: "Subcategory not found" });
    res.status(200).json({ success: true, message: "Subcategory updated successfully", data: subcategory });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /subcategories/:id
export const deleteSubcategory = async (req, res) => {
  try {
    const { id } = req.params;
    const subcategory = await Subcategory.findByIdAndDelete(id);
    if (!subcategory) return res.status(404).json({ success: false, message: "Subcategory not found" });
    res.status(200).json({ success: true, message: "Subcategory deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
