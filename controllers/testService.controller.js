import TestService from "../model/testService.model.js";
import { uploadAndKeepLocal } from "../utils/cloudinary.js";

export const createTestService = async (req, res) => {
  try {
    const { 
      title, 
      status, 
      category_id, 
      fasting_required, 
      fasting_hours, 
      instruction_text, 
      sample_type, 
      report_time, 
      instructions,
      mrp,
      price,
      test_code
    } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, message: "Title is required" });
    }

    let inputInstructions = instructions;
    if (typeof instructions === 'string' && instructions !== "") {
      try {
        inputInstructions = JSON.parse(instructions);
      } catch (_) {
        inputInstructions = [];
      }
    }

    let imageData = { local: "", cloudinary: "" };
    if (req.file) {
      const cloudinaryUrl = await uploadAndKeepLocal(req.file.path, "pathology/tests");
      imageData = {
        local: req.file.path.replace(/\\/g, '/'),
        cloudinary: cloudinaryUrl || ""
      };
    }

    const newService = await TestService.create({ 
      title, 
      status: status !== undefined ? status : true, 
      category_id: category_id || null, 
      fasting_required: fasting_required || false, 
      fasting_hours: fasting_hours || 0, 
      instruction_text: instruction_text || "", 
      sample_type: sample_type || "", 
      report_time: report_time || "", 
      instructions: inputInstructions || [],
      mrp: mrp || 0,
      price: price || 0,
      test_code: test_code || "",
      image: imageData
    });

    res.status(201).json({ success: true, message: "Test Service created successfully", data: newService });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAllTestServices = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "", status, category_id } = req.query;

    const query = {};

    if (search) {
      query.title = { $regex: search, $options: "i" };
    }

    if (status !== undefined && status !== "") {
      query.status = status === "true" || status === true;
    }

    if (category_id) {
      query.category_id = category_id;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await TestService.countDocuments(query);
    const services = await TestService.find(query)
      .populate('category_id')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      data: services,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


export const getTestServiceById = async (req, res) => {
  try {
    const service = await TestService.findById(req.params.id)
      .populate('category_id');
    if (!service) {
      return res.status(404).json({ success: false, message: "Test Service not found" });
    }
    res.status(200).json({ success: true, data: service });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateTestService = async (req, res) => {
  try {
    let updateData = { ...req.body };
    
    // Parse JSON strings if they come from FormData
    if (typeof updateData.instructions === 'string' && updateData.instructions !== "") {
      try {
        updateData.instructions = JSON.parse(updateData.instructions);
      } catch (_) {
        updateData.instructions = [];
      }
    }

    if (updateData.category_id === "" || updateData.category_id === "null") updateData.category_id = null;
    delete updateData.subcategory_id;

    if (req.file) {
      const cloudinaryUrl = await uploadAndKeepLocal(req.file.path, "pathology/tests");
      updateData.image = {
        local: req.file.path.replace(/\\/g, '/'),
        cloudinary: cloudinaryUrl || ""
      };
    }

    const service = await TestService.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );
    if (!service) {
      return res.status(404).json({ success: false, message: "Test Service not found" });
    }
    res.status(200).json({ success: true, message: "Test Service updated successfully", data: service });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteTestService = async (req, res) => {
  try {
    const service = await TestService.findByIdAndDelete(req.params.id);
    if (!service) {
      return res.status(404).json({ success: false, message: "Test Service not found" });
    }
    res.status(200).json({ success: true, message: "Test Service deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateTestServiceStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const service = await TestService.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!service) {
      return res.status(404).json({ success: false, message: "Test Service not found" });
    }
    res.status(200).json({ success: true, message: "Status updated successfully", data: service });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const bulkCreateTestServices = async (req, res) => {
  try {
    const { services } = req.body;
    if (!services || !Array.isArray(services)) {
      return res.status(400).json({ success: false, message: "Invalid data format" });
    }

    const createdServices = await TestService.insertMany(services);

    res.status(201).json({
      success: true,
      message: `${createdServices.length} Test Services imported successfully`,
      data: createdServices
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

