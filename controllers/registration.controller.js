import Registration from "../model/registration.model.js";
import LabTestPricing from "../model/labTestPricing.model.js";
import bcrypt from "bcryptjs";
import axios from "axios";
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');
import fs from "fs";
import { createNotification } from "./notification.controller.js";

// Helper to get local URL path
const getLocalUrl = (req, file) => {
  if (!file) return null;
  // Standardize slashes for URL and prepend base URL if needed
  const relativePath = file.path.replace(/\\/g, "/");
  return `${req.protocol}://${req.get("host")}/${relativePath}`;
};

export const createRegistration = async (req, res) => {
  try {
    const { phone, email } = req.body;

    // Check if pathology already exists
    const existingPathology = await Registration.findOne({
      $or: [{ phone }, { email }]
    });

    if (existingPathology) {
      return res.status(400).json({
        success: false,
        message: "Pathology already registered with this phone number or email"
      });
    }

    // console.log("Incoming Registration Request Body:", req.body);
    const formData = { ...req.body };

    // Handle single files
    if (req.files) {
      if (req.files.labLogo) {
        formData.labLogo = getLocalUrl(req, req.files.labLogo[0]);
      }
      if (req.files.labBanner) {
        formData.labBanner = getLocalUrl(req, req.files.labBanner[0]);
      }
      if (req.files.pathologyDocs) {
        formData.pathologyDocs = getLocalUrl(req, req.files.pathologyDocs[0]);
      }
    }

    // Parse nested arrays and objects
    try {
      // selectedTests (Array of ObjectIds)
      if (typeof formData.selectedTests === "string") {
        formData.selectedTests = JSON.parse(formData.selectedTests);
      }

      // test (Array of { name, price }) - previously named pricingItems in controller
      if (typeof formData.test === "string") {
        formData.test = JSON.parse(formData.test);
      } else if (typeof formData.pricingItems === "string") {
        formData.test = JSON.parse(formData.pricingItems);
        delete formData.pricingItems;
      }
      // certifications is handled below if needed, but 'test' (which contains discountPrice) is already parsed above.

      // Handle Certification: [{ name, file }]
      // The frontend might send certificationData as a JSON string
      // Standardize field name to 'Certification'
      if (formData.certifications) {
         formData.Certification = formData.certifications;
         delete formData.certifications;
      }
      if (formData.certification) {
         formData.Certification = formData.certification;
         delete formData.certification;
      }

      // Parse 'Certification' if it's a JSON string
      if (typeof formData.Certification === "string") {
        try {
          formData.Certification = JSON.parse(formData.Certification);
        } catch (e) {
          console.error("CERT_PARSE_ERROR:", e);
          formData.Certification = [];
        }
      }

      // If there are uploaded certification files, map them to the Certification array
      if (req.files && req.files.certificationFiles) {
        if (!formData.Certification) formData.Certification = [];

        req.files.certificationFiles.forEach((file, index) => {
          // If we have existing certification data row for this file, update it
          // Otherwise, create a new one. This assumes files match the order in the array
          if (formData.Certification[index]) {
            formData.Certification[index].file = getLocalUrl(req, file);
          } else {
            formData.Certification.push({
              name: file.originalname.split('.')[0], // Default name if not provided
              file: getLocalUrl(req, file)
            });
          }
        });
      }

    } catch (parseError) {
      console.error("JSON Parse Error:", parseError);
    }

    // Parse booleans
    ['homeCollection', 'is24x7', 'emergency', 'status', 'ambulanceService'].forEach(key => {
      if (formData[key] === "true") formData[key] = true;
      if (formData[key] === "false") formData[key] = false;
    });

    // Convert numeric fields
    if (formData.establishmentYear) {
      formData.establishmentYear = Number(formData.establishmentYear);
    }
    if (formData.latitude) formData.latitude = Number(formData.latitude);
    if (formData.longitude) formData.longitude = Number(formData.longitude);

    if (formData.latitude && formData.longitude) {
      formData.location = {
        type: "Point",
        coordinates: [Number(formData.longitude), Number(formData.latitude)]
      };
    }

    // Hash password if provided
    if (formData.password) {
      formData.password = await bcrypt.hash(formData.password, 10);
    }

    // console.log("Saving Registration with data:", JSON.stringify(formData, null, 2));

    const registration = await Registration.create(formData);

    // Auto notification — fire and forget
    createNotification(
      "New Lab Registration",
      `${formData.labName || "A new lab"} has submitted a registration request.`,
      "registration",
      "/dashboard/registrations",
      registration._id
    ).catch(() => {});

    // Save test pricing separately
    if (formData.test && Array.isArray(formData.test)) {
      const pricingData = formData.test.map(item => ({
        registration: registration._id,
        test: item.name,
        price: item.price,
        discountPrice: item.discountPrice,
        discountPercent: item.discountPercent || "",
        addedBy: registration._id,
      }));

      await LabTestPricing.insertMany(pricingData);
    }

    res.status(201).json({
      success: true,
      message: "Registration submitted successfully",
      data: registration,
    });
  } catch (error) {
    console.error("REGISTRATION_SUBMISSION_ERROR:", error);

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        message: "Validation failed: " + messages.join(", "),
        error: error.errors
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to submit registration: " + error.message,
      error: error.stack,
    });
  }
};

export const getAllRegistrations = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "", status, type, regType, source, parentId, featured } = req.query;

    const query = { $and: [] };

    if (search) {
      query.$and.push({
        $or: [
          { labName: { $regex: search, $options: "i" } },
          { ownerName: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
          { phone: { $regex: search, $options: "i" } },
        ]
      });
    }

    if (status !== undefined && status !== "") {
      query.$and.push({ status: status === "true" || status === true });
    }

    if (featured !== undefined && featured !== "") {
      query.$and.push({ isFeatured: featured === "true" });
    }

    if (type) {
      query.$and.push({ labType: type });
    }

    if (source) {
      query.$and.push({ source });
    }

    if (parentId) {
      query.$and.push({ parent: parentId });
    }

    // Filter by regType (Individual vs Parent)
    const normalizedRegType = regType?.toLowerCase().trim();
    if (normalizedRegType === "individual") {
      query.$and.push({
        $or: [
          { parent: { $exists: false } },
          { parent: null }
        ]
      });
    } else if (normalizedRegType === "parent") {
      query.$and.push({ parent: { $ne: null, $exists: true } });
    }

    if (query.$and.length === 0) {
      delete query.$and;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Base stats query (everything except regType)
    const baseStatsQuery = { $and: [] };
    if (search) {
      baseStatsQuery.$and.push({
        $or: [
          { labName: { $regex: search, $options: "i" } },
          { ownerName: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
          { phone: { $regex: search, $options: "i" } },
        ]
      });
    }
    if (status !== undefined && status !== "") {
      baseStatsQuery.$and.push({ status: status === "true" || status === true });
    }
    if (type) {
      baseStatsQuery.$and.push({ labType: type });
    }
    if (source) {
      baseStatsQuery.$and.push({ source });
    }
    if (baseStatsQuery.$and.length === 0) delete baseStatsQuery.$and;

    // Query for tab-specific stats (ignores status, type, and source filters)
    const tabStatsQuery = { $and: [] };
    if (search) {
      tabStatsQuery.$and.push({
        $or: [
          { labName: { $regex: search, $options: "i" } },
          { ownerName: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
          { phone: { $regex: search, $options: "i" } },
        ]
      });
    }
    if (normalizedRegType === "individual") {
      tabStatsQuery.$and.push({ $or: [{ parent: { $exists: false } }, { parent: null }] });
    } else if (normalizedRegType === "parent") {
      tabStatsQuery.$and.push({ parent: { $ne: null, $exists: true } });
    }
    if (tabStatsQuery.$and.length === 0) delete tabStatsQuery.$and;

    const [total, registrations, typeStats, statusStats, sourceStats, individualTotal, parentTotal, parentStatsByReg] = await Promise.all([
      Registration.countDocuments(query),
      Registration.find(query)
        .populate("selectedTests")
        .populate("parent")
        .sort({ isFeatured: -1, createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Registration.aggregate([
        { $match: query },
        { $group: { _id: "$labType", count: { $sum: 1 } } }
      ]),
      Registration.aggregate([
        { $match: tabStatsQuery },
        { $group: { _id: "$status", count: { $sum: 1 } } }
      ]),
      Registration.aggregate([
        { $match: tabStatsQuery },
        { $group: { _id: "$source", count: { $sum: 1 } } }
      ]),
      Registration.countDocuments({
        ...baseStatsQuery,
        $or: [{ parent: { $exists: false } }, { parent: null }]
      }),
      Registration.countDocuments({
        ...baseStatsQuery,
        parent: { $ne: null, $exists: true }
      }),
      Registration.aggregate([
        { $match: { parent: { $ne: null, $exists: true } } },
        { $group: { _id: "$parent", count: { $sum: 1 } } },
        {
          $lookup: {
            from: "parents",
            localField: "_id",
            foreignField: "_id",
            as: "parentDetails"
          }
        },
        { $unwind: "$parentDetails" },
        {
          $project: {
            name: "$parentDetails.name",
            count: 1
          }
        }
      ])
    ]);

    res.status(200).json({
      success: true,
      data: registrations,
      stats: {
        types: typeStats.map(s => ({ label: s._id || "Other", value: s._id, count: s.count })),
        status: [
          { label: "Active", value: "true", count: statusStats.find(s => s._id === true)?.count || 0 },
          { label: "Inactive", value: "false", count: statusStats.find(s => s._id === false)?.count || 0 }
        ],
        sources: [
          { label: "Website", value: "website", count: sourceStats.find(s => s._id === "website")?.count || 0 },
          { label: "Admin", value: "admin", count: sourceStats.find(s => s._id === "admin")?.count || 0 }
        ],
        parents: parentStatsByReg.map(p => ({ label: p.name, value: p._id, count: p.count })),
        totalCount: total,
        individualCount: individualTotal,
        parentCount: parentTotal
      },
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch registrations",
      error: error.message,
    });
  }
};

export const getRegistrationById = async (req, res) => {
  try {
    const registration = await Registration.findById(req.params.id)
      .populate("selectedTests")
      .populate("parent");

    if (!registration) {
      return res.status(404).json({ success: false, message: "Registration not found" });
    }

    const tests = await LabTestPricing.find({
      registration: req.params.id,
    }).populate("test");

    res.status(200).json({
      success: true,
      data: {
        ...registration.toObject(),
        testPricing: tests,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch registration details",
      error: error.message,
    });
  }
};

export const toggleFeatured = async (req, res) => {
  try {
    const { id } = req.params;
    const reg = await Registration.findById(id);
    if (!reg) return res.status(404).json({ success: false, message: "Registration not found" });

    const newFeatured = !reg.isFeatured;
    await Registration.findByIdAndUpdate(id, { isFeatured: newFeatured });

    res.json({
      success: true,
      message: `Lab ${newFeatured ? "marked as Featured" : "removed from Featured"}`,
      isFeatured: newFeatured,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateRegistrationStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const registration = await Registration.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!registration) {
      return res.status(404).json({ success: false, message: "Registration not found" });
    }
    res.status(200).json({
      success: true,
      message: `Status updated to ${status ? "Active" : "Inactive"}`,
      data: registration,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update status",
      error: error.message,
    });
  }
};

export const deleteRegistration = async (req, res) => {
  try {
    const registration = await Registration.findByIdAndDelete(req.params.id);
    if (!registration) {
      return res.status(404).json({ success: false, message: "Registration not found" });
    }
    res.status(200).json({ success: true, message: "Registration deleted successfully" });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete registration",
      error: error.message,
    });
  }
};

export const updateRegistration = async (req, res) => {
  try {
    const { id } = req.params;
    const formData = { ...req.body };

    // Check if phone or email already exists for another pathology
    if (formData.phone || formData.email) {
      const existingPathology = await Registration.findOne({
        _id: { $ne: id },
        $or: [
          ...(formData.phone ? [{ phone: formData.phone }] : []),
          ...(formData.email ? [{ email: formData.email }] : [])
        ]
      });

      if (existingPathology) {
        return res.status(400).json({
          success: false,
          message: "Another pathology is already registered with this phone number or email"
        });
      }
    }

    // Handle empty parent
    if (formData.parent === "" || formData.parent === "null") {
      formData.parent = null;
    }

    // Handle empty numbers
    if (formData.establishmentYear === "") {
      formData.establishmentYear = null;
    }
    if (formData.latitude) formData.latitude = Number(formData.latitude);
    if (formData.longitude) formData.longitude = Number(formData.longitude);
    if (formData.latitude === "") formData.latitude = null;
    if (formData.longitude === "") formData.longitude = null;

    if (formData.latitude && formData.longitude) {
      formData.location = {
        type: "Point",
        coordinates: [Number(formData.longitude), Number(formData.latitude)]
      };
    }

    // Handle files
    if (req.files) {
      if (req.files.labLogo) {
        formData.labLogo = getLocalUrl(req, req.files.labLogo[0]);
      }
      if (req.files.labBanner) {
        formData.labBanner = getLocalUrl(req, req.files.labBanner[0]);
      }
      if (req.files.pathologyDocs) {
        formData.pathologyDocs = getLocalUrl(req, req.files.pathologyDocs[0]);
      }
    }

    // Parse JSON fields
    try {
      if (typeof formData.selectedTests === "string") {
        formData.selectedTests = JSON.parse(formData.selectedTests);
      }
      if (typeof formData.test === "string") {
        formData.test = JSON.parse(formData.test);
      }
      if (typeof formData.Certification === "string") {
        formData.Certification = JSON.parse(formData.Certification);
      }

      // Handle uploaded certification files
      if (req.files && req.files.certificationFiles) {
        if (!formData.Certification) formData.Certification = [];

        // This logic might need refinement depending on how frontend sends updates
        // Here we just append or update based on index if provided
        req.files.certificationFiles.forEach((file, index) => {
          if (formData.Certification[index]) {
            formData.Certification[index].file = getLocalUrl(req, file);
          } else {
            formData.Certification.push({
              name: file.originalname.split('.')[0],
              file: getLocalUrl(req, file)
            });
          }
        });
      }

      // Hash password if updating
      if (formData.password) {
        formData.password = await bcrypt.hash(formData.password, 10);
      }
    } catch (e) {
      console.error("Parse error in update:", e);
    }

    // Convert booleans
    ['homeCollection', 'is24x7', 'emergency', 'status', 'ambulanceService'].forEach(key => {
      if (formData[key] === "true") formData[key] = true;
      if (formData[key] === "false") formData[key] = false;
    });

    const updated = await Registration.findByIdAndUpdate(id, formData, { new: true });

    if (!updated) {
      return res.status(404).json({ success: false, message: "Registration not found" });
    }

    // Update test pricing separately
    if (formData.test) {
      await LabTestPricing.deleteMany({ registration: id });

      const pricingData = formData.test.map(item => ({
        registration: id,
        test: item.name,
        price: item.price,
        discountPrice: item.discountPrice,
        discountPercent: item.discountPercent || "",
        addedBy: id,
      }));

      await LabTestPricing.insertMany(pricingData);
    }

    res.status(200).json({
      success: true,
      message: "Registration updated successfully",
      data: updated,
    });
  } catch (error) {
    console.error("Update Error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to update registration",
    });
  }
};

export const importRegistrationsExcel = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Please upload an excel file" });
    }

    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);

    if (data.length === 0) {
       fs.unlinkSync(req.file.path);
       return res.status(400).json({ success: false, message: "Excel file is empty" });
    }

    const results = {
      imported: 0,
      errors: []
    };

    for (const row of data) {
      try {
        // Validation: Required fields
        if (!row.phone || !row.email || !row.labName || !row.ownerName) {
           results.errors.push(`Row ${data.indexOf(row) + 2}: Required fields missing (phone, email, labName, ownerName)`);
           continue;
        }

        // Check duplicates
        const existing = await Registration.findOne({
          $or: [{ phone: row.phone.toString() }, { email: row.email.toString() }]
        });

        if (existing) {
          results.errors.push(`Row ${data.indexOf(row) + 2}: Lab with phone ${row.phone} or email ${row.email} already exists`);
          continue;
        }

        // Default password if not provided
        const password = row.password ? row.password.toString() : "Lab@123";
        const hashedPassword = await bcrypt.hash(password, 10);

        // 🌍 GEOCODE: If coordinates are missing, fetch from address
        let latitude = row.latitude;
        let longitude = row.longitude;
        
        if (!latitude || !longitude) {
           const searchAddr = row.fullAddress || `${row.areaName}, ${row.city}, ${row.state}`;
           if (searchAddr && searchAddr.length > 5) {
              try {
                 const geoRes = await axios.get(`https://maps.googleapis.com/maps/api/geocode/json`, {
                    params: {
                       address: searchAddr,
                       key: "AIzaSyBEss4wpsQ0o9WPBjDgHsSByUzFuo2oSNE"
                    }
                 });
                 if (geoRes.data.status === "OK") {
                    const location = geoRes.data.results[0].geometry.location;
                    latitude = location.lat;
                    longitude = location.lng;
                 }
              } catch (geoErr) {
                 console.error("Geocoding failed for row:", searchAddr, geoErr.message);
              }
           }
        }

        const newLab = new Registration({
          ...row,
          latitude: latitude ? Number(latitude) : undefined,
          longitude: longitude ? Number(longitude) : undefined,
          password: hashedPassword,
          source: "admin",
          status: true
        });

        await newLab.save();
        results.imported++;
      } catch (err) {
        results.errors.push(`Row ${data.indexOf(row) + 2}: ${err.message}`);
      }
    }

    // Delete temp file after processing
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(200).json({
      success: true,
      message: `Import completed: ${results.imported} registrations successfully imported`,
      data: results
    });

  } catch (error) {
    console.error("EXCEL_IMPORT_ERROR:", error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ success: false, message: "Import failed: " + error.message });
  }
};

export const bulkCreateRegistrations = async (req, res) => {
  try {
    const { labs } = req.body;
    if (!labs || !Array.isArray(labs) || labs.length === 0) {
      return res.status(400).json({ success: false, message: "No lab data provided" });
    }

    const results = {
      imported: 0,
      errors: []
    };

    for (const row of labs) {
      try {
        if (!row.phone || !row.email || !row.labName || !row.ownerName) {
           results.errors.push(`Lab "${row.labName || 'Unknown'}": Required fields missing`);
           continue;
        }

        const existing = await Registration.findOne({
          $or: [{ phone: row.phone.toString() }, { email: row.email.toString() }]
        });

        if (existing) {
          results.errors.push(`Lab "${row.labName}": Already exists with phone/email`);
          continue;
        }

        const password = row.password ? row.password.toString() : "Lab@123";
        const hashedPassword = await bcrypt.hash(password, 10);

        const newLab = new Registration({
          ...row,
          password: hashedPassword,
          source: "admin",
          status: true
        });

        await newLab.save();
        results.imported++;
      } catch (err) {
        results.errors.push(`Lab "${row.labName}": ${err.message}`);
      }
    }

    res.status(200).json({
      success: true,
      message: `Successfully imported ${results.imported} labs`,
      data: results
    });

  } catch (error) {
    res.status(500).json({ success: false, message: "Bulk import failed: " + error.message });
  }
};

export const getNearbyLabs = async (req, res) => {
  try {
    const { lat, lng, distance = 10, featured } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        message: "Latitude and Longitude are required",
      });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    const radiusInMeter = parseFloat(distance) * 1000;

    const matchQuery = { status: true };
    if (featured === "true") matchQuery.isFeatured = true;

    const nearbyLabs = await Registration.aggregate([
      {
        $geoNear: {
          near: { type: "Point", coordinates: [longitude, latitude] },
          distanceField: "distance_meter",
          maxDistance: radiusInMeter,
          spherical: true,
          query: matchQuery,
        },
      },
      {
        $lookup: {
          from: "labtestpricings",
          localField: "_id",
          foreignField: "registration",
          as: "testPricing",
        },
      },
      {
        $addFields: {
          distance_km: { $divide: ["$distance_meter", 1000] },
        },
      },
      {
        $project: {
          password: 0,
          "testPricing.addedBy": 0,
        },
      },
      { $sort: { isFeatured: -1, distance_meter: 1 } },
    ]);

    // Populate test details in testPricing
    const TestService = (await import("../model/testService.model.js")).default;
    const populated = await Promise.all(
      nearbyLabs.map(async (lab) => {
        const pricingWithTests = await Promise.all(
          lab.testPricing.map(async (p) => {
            const testDoc = await TestService.findById(p.test).select(
              "title test_code image mrp price sample_type report_time fasting_required category_id"
            );
            return { ...p, test: testDoc };
          })
        );
        return { ...lab, testPricing: pricingWithTests };
      })
    );

    res.status(200).json({
      success: true,
      count: populated.length,
      data: populated,
    });
  } catch (error) {
    console.error("NEARBY_LABS_ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch nearby labs: " + error.message,
    });
  }
};

export const getLabsByTest = async (req, res) => {
  try {
    const { testId } = req.params;

    if (!testId) {
      return res.status(400).json({
        success: false,
        message: "Test ID is required",
      });
    }

    // Find all pricing entries for this test and populate lab data
    const labPricings = await LabTestPricing.find({ test: testId })
      .populate({
        path: "registration",
        select: "labName labLogo labType fullAddress phone email rating status description",
        match: { status: true } 
      });

    // Filter out entries where registration is null (inactive labs)
    const availableLabs = labPricings.filter(p => p.registration !== null);

    res.status(200).json({
      success: true,
      count: availableLabs.length,
      data: availableLabs.map(item => ({
        lab: item.registration,
        pricing: {
          mrp: item.price,
          sellingPrice: item.discountPrice,
          discountPercent: item.discountPercent
        }
      })),
    });
  } catch (error) {
    console.error("GET_LABS_BY_TEST_ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch labs for this test: " + error.message,
    });
  }
};

export const getTestsByLab = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
       return res.status(400).json({ success: false, message: "Lab ID is required" });
    }

    // Find all tests and pricing for this lab
    const tests = await LabTestPricing.find({ registration: id })
      .populate({
        path: "test",
        select: "title image test_code sample_type report_time short_description category_id",
        populate: { path: "category_id", select: "name" }
      });

    res.status(200).json({
      success: true,
      count: tests.length,
      data: tests.map(item => ({
        test_details: item.test,
        pricing: {
          mrp: item.price,
          sellingPrice: item.discountPrice,
          discountPercent: item.discountPercent
        }
      })),
    });
  } catch (error) {
    console.error("GET_TESTS_BY_LAB_ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch tests for this lab: " + error.message,
    });
  }
};
