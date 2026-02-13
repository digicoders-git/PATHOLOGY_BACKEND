import TestService from "../model/testService.model.js";

export const createTestService = async (req, res) => {
  try {
    const { title, status } = req.body;
    if (!title) {
      return res.status(400).json({ success: false, message: "Title is required" });
    }
    const newService = await TestService.create({ title, status });
    res.status(201).json({ success: true, message: "Test Service created successfully", data: newService });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAllTestServices = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "", status } = req.query;

    const query = {};

    if (search) {
      query.title = { $regex: search, $options: "i" };
    }

    if (status !== undefined && status !== "") {
      query.status = status === "true" || status === true;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await TestService.countDocuments(query);
    const services = await TestService.find(query)
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
    const service = await TestService.findById(req.params.id);
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
    const { title, status } = req.body;
    const service = await TestService.findByIdAndUpdate(
      req.params.id,
      { title, status },
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

