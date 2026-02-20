import mongoose from "mongoose";
import LabTestPricing from "../../model/labTestPricing.model.js";

// Add new test pricing
export const addMyTestPricing = async (req, res) => {
  try {
    const { test, price, discountPrice } = req.body;
    const pathologyId = req.user.id; // Logged in pathology ID

    if (!test || !price) {
      return res.status(400).json({ success: false, message: "Test and Price are required" });
    }

    // Check if duplicate for this pathology
    const existing = await LabTestPricing.findOne({
      registration: pathologyId,
      test,
      isDeleted: false
    });

    if (existing) {
      return res.status(400).json({ success: false, message: "Pricing for this test already exists" });
    }

    const newPricing = await LabTestPricing.create({
      registration: pathologyId,
      test,
      price,
      discountPrice,
      addedBy: pathologyId,
    });

    res.status(201).json({
      success: true,
      message: "Test pricing added successfully",
      data: newPricing,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get all my test pricing
export const getMyTestPricing = async (req, res) => {
  try {
    const pathologyId = req.user.id;
    const { search, status, price, discountPrice } = req.query;

    let query = {
      registration: pathologyId,
      isDeleted: false
    };

    // Filter by status
    if (status !== undefined && status !== "") {
      query.status = status === "true" || status === true;
    }

    // Filter by exact price
    if (price) {
      query.price = price;
    }

    // Filter by exact discount price
    if (discountPrice) {
      query.discountPrice = discountPrice;
    }

    // If searching by test title
    if (search) {
      const TestService = mongoose.model("TestService");
      const tests = await TestService.find({
        title: { $regex: search, $options: "i" }
      }).select("_id");

      const testIds = tests.map(t => t._id);

      if (testIds.length > 0) {
        query.test = { $in: testIds };
      } else {
        // If no tests match search, return empty array immediately
        return res.status(200).json({ success: true, data: [] });
      }
    }

    const pricing = await LabTestPricing.find(query).populate("test");

    res.status(200).json({
      success: true,
      count: pricing.length,
      data: pricing,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update test pricing
export const updateMyTestPricing = async (req, res) => {
  try {
    const { id } = req.params;
    const { price, discountPrice, status } = req.body;
    const pathologyId = req.user.id;

    const pricing = await LabTestPricing.findOneAndUpdate(
      { _id: id, registration: pathologyId, isDeleted: false },
      { price, discountPrice, status },
      { new: true }
    );

    if (!pricing) {
      return res.status(404).json({ success: false, message: "Pricing not found or unauthorized" });
    }

    res.status(200).json({
      success: true,
      message: "Pricing updated successfully",
      data: pricing,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Status toggle (PATCH)
export const toggleMyTestPricingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const pathologyId = req.user.id;

    const pricing = await LabTestPricing.findOne({ _id: id, registration: pathologyId, isDeleted: false });

    if (!pricing) {
      return res.status(404).json({ success: false, message: "Pricing not found" });
    }

    pricing.status = !pricing.status;
    await pricing.save();

    res.status(200).json({
      success: true,
      message: `Status updated to ${pricing.status ? "Active" : "Inactive"}`,
      data: pricing,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Soft delete
export const deleteMyTestPricing = async (req, res) => {
  try {
    const { id } = req.params;
    const pathologyId = req.user.id;

    const pricing = await LabTestPricing.findOneAndUpdate(
      { _id: id, registration: pathologyId, isDeleted: false },
      { isDeleted: true },
      { new: true }
    );

    if (!pricing) {
      return res.status(404).json({ success: false, message: "Pricing not found" });
    }

    res.status(200).json({
      success: true,
      message: "Pricing deleted successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Restore soft deleted pricing
export const restoreMyTestPricing = async (req, res) => {
  try {
    const { id } = req.params;
    const pathologyId = req.user.id;

    const pricing = await LabTestPricing.findOneAndUpdate(
      { _id: id, registration: pathologyId, isDeleted: true },
      { isDeleted: false },
      { new: true }
    );

    if (!pricing) {
      return res.status(404).json({ success: false, message: "Deleted pricing not found" });
    }

    res.status(200).json({
      success: true,
      message: "Pricing restored successfully",
      data: pricing,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
