import LabTestPricing from "../model/labTestPricing.model.js";
import mongoose from "mongoose";

// @desc Create a new Lab Test Pricing
export const createLabTestPricing = async (req, res) => {
  try {
    const pricing = await LabTestPricing.create(req.body);
    res.status(201).json({
      success: true,
      message: "Lab test pricing created successfully",
      data: pricing,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to create lab test pricing",
    });
  }
};

// @desc Get all Lab Test Pricing with Search, Filter & Pagination
export const getAllLabTestPricing = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      registration,
      test,
      minPrice,
      maxPrice,
      status
    } = req.query;

    const query = { status: status !== undefined ? status === "true" : true }; // Default to fetching active ones

    // Global Search (Searching in prices or through aggregation/populate is tricky, 
    // but here we can search in price strings if they match the search query)
    if (search) {
      query.$or = [
        { price: { $regex: search, $options: "i" } },
        { discountPrice: { $regex: search, $options: "i" } },
      ];
    }

    // Filtering
    if (registration) query.registration = registration;
    if (test) query.test = test;

    if (minPrice || maxPrice) {
      query.$and = query.$and || [];
      if (minPrice) query.$and.push({ price: { $gte: minPrice } });
      if (maxPrice) query.$and.push({ price: { $lte: maxPrice } });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [total, pricings] = await Promise.all([
      LabTestPricing.countDocuments(query),
      LabTestPricing.find(query)
        .populate("registration")
        .populate("test")
        .populate("addedBy")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
    ]);

    res.status(200).json({
      success: true,
      count: pricings.length,
      total,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
      data: pricings,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch lab test pricings",
    });
  }
};

// @desc Get a single Lab Test Pricing by ID
export const getLabTestPricingById = async (req, res) => {
  try {
    const pricing = await LabTestPricing.findById(req.params.id)
      .populate("registration")
      .populate("test")
      .populate("addedBy");

    if (!pricing) {
      return res.status(404).json({
        success: false,
        message: "Lab test pricing not found",
      });
    }

    res.status(200).json({
      success: true,
      data: pricing,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch lab test pricing details",
    });
  }
};

// @desc Update Lab Test Pricing
export const updateLabTestPricing = async (req, res) => {
  try {
    const pricing = await LabTestPricing.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!pricing) {
      return res.status(404).json({
        success: false,
        message: "Lab test pricing not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Lab test pricing updated successfully",
      data: pricing,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to update lab test pricing",
    });
  }
};

// @desc Soft Delete Lab Test Pricing
export const deleteLabTestPricing = async (req, res) => {
  try {
    const pricing = await LabTestPricing.findByIdAndUpdate(
      req.params.id,
      { status: false },
      { new: true }
    );

    if (!pricing) {
      return res.status(404).json({ success: false, message: "Lab test pricing not found" });
    }

    res.status(200).json({
      success: true,
      message: "Lab test pricing deleted (soft delete) successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Restore Soft Deleted Lab Test Pricing
export const restoreLabTestPricing = async (req, res) => {
  try {
    const pricing = await LabTestPricing.findByIdAndUpdate(
      req.params.id,
      { status: true },
      { new: true }
    );

    if (!pricing) {
      return res.status(404).json({ success: false, message: "Lab test pricing not found" });
    }

    res.status(200).json({
      success: true,
      message: "Lab test pricing restored successfully",
      data: pricing,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Update Status (Toggle or Set Active/Inactive)
export const updateLabTestPricingStatus = async (req, res) => {
  try {
    const body = req.body || {};
    let status = body.status;

    // If status is not provided in body, toggle the current status
    if (status === undefined) {
      const currentPricing = await LabTestPricing.findById(req.params.id);
      if (!currentPricing) {
        return res.status(404).json({ success: false, message: "Lab test pricing not found" });
      }
      status = !currentPricing.status;
    }

    const pricing = await LabTestPricing.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!pricing) {
      return res.status(404).json({ success: false, message: "Lab test pricing not found" });
    }

    res.status(200).json({
      success: true,
      message: `Status updated to ${status ? "Active" : "Inactive"}`,
      data: pricing,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to update status",
    });
  }
};
