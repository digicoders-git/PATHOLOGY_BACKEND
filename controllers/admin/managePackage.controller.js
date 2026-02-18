// import Package from "../model/admin/managePackage.model.js";

import Package from "../../model/admin/managePackage.model.js";
import { uploadOnCloudinary } from "../../utils/cloudinary.js";



// CREATE PACKAGE
export const createPackage = async (req, res) => {
  try {
    let {
      packageName,
      description,
      category,
      image,
      tests,
      actualPrice,
      discountPrice,
    } = req.body;

    if (!packageName) {
      return res.status(400).json({
        success: false,
        message: "Package name is required",
      });
    }

    // Handle tests parsing if it's a string
    let parsedTests = tests;
    if (typeof tests === "string") {
      try {
        // Replace single quotes with double quotes for valid JSON if necessary
        const jsonString = tests.replace(/'/g, '"');
        parsedTests = JSON.parse(jsonString);
      } catch (e) {
        parsedTests = tests.split(",").map((t) => t.trim());
      }
    }

    // Handle Cloudinary Upload
    let imageUrl = image;
    if (req.file) {
      imageUrl = await uploadOnCloudinary(req.file.path);
    }

    const newPackage = new Package({
      packageName,
      description,
      category,
      image: imageUrl,
      tests: parsedTests,
      actualPrice,
      discountPrice,
    });

    await newPackage.save();

    res.status(201).json({
      success: true,
      message: "Package created successfully",
      data: newPackage,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


// GET ALL PACKAGES
export const getAllPackages = async (req, res) => {
  try {
    const { search, status, testService } = req.query;

    const query = { isDeleted: false };

    if (search) {
      query.$or = [
        { packageName: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } }
      ];
    }

    if (status !== undefined && status !== "") {
      query.status = status === 'true' || status === true;
    }

    if (testService) {
      query.tests = testService;
    }

    const packages = await Package.find(query)
      .populate("tests")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: packages.length,
      data: packages,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


// GET SINGLE PACKAGE
export const getSinglePackage = async (req, res) => {
  try {
    const packageData = await Package.findById(req.params.id)
      .populate("tests");

    if (!packageData || packageData.isDeleted) {
      return res.status(404).json({
        success: false,
        message: "Package not found",
      });
    }

    res.status(200).json({
      success: true,
      data: packageData,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


// UPDATE PACKAGE
export const updatePackage = async (req, res) => {
  try {
    let updateData = { ...req.body };

    // Handle tests parsing if it's a string in updateData
    if (updateData.tests && typeof updateData.tests === "string") {
      try {
        const jsonString = updateData.tests.replace(/'/g, '"');
        updateData.tests = JSON.parse(jsonString);
      } catch (e) {
        updateData.tests = updateData.tests.split(",").map((t) => t.trim());
      }
    }

    // Handle Cloudinary Upload for update
    if (req.file) {
      const imageUrl = await uploadOnCloudinary(req.file.path);
      if (imageUrl) {
        updateData.image = imageUrl;
      }
    }

    const updated = await Package.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Package not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Package updated successfully",
      data: updated,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


// DELETE PACKAGE (SOFT DELETE)
export const deletePackage = async (req, res) => {
  try {
    const deleted = await Package.findByIdAndUpdate(
      req.params.id,
      { isDeleted: true },
      { new: true }
    );

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Package not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Package deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


// TOGGLE STATUS
export const togglePackageStatus = async (req, res) => {
  try {
    const pkg = await Package.findById(req.params.id);

    if (!pkg) {
      return res.status(404).json({
        success: false,
        message: "Package not found",
      });
    }

    pkg.status = !pkg.status;
    await pkg.save();

    res.status(200).json({
      success: true,
      message: "Status updated successfully",
      data: pkg,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
