import Registration from "../model/registration.model.js";

// Helper to get local URL path
const getLocalUrl = (req, file) => {
  if (!file) return null;
  // Standardize slashes for URL and prepend base URL if needed
  const relativePath = file.path.replace(/\\/g, "/");
  return `${req.protocol}://${req.get("host")}/${relativePath}`;
};

export const createRegistration = async (req, res) => {
  try {
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
      if (typeof formData.Certification === "string") {
        formData.Certification = JSON.parse(formData.Certification);
      } else if (typeof formData.certifications === "string") {
        // Fallback for old field name
        formData.Certification = JSON.parse(formData.certifications);
        delete formData.certifications;
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

    // console.log("Saving Registration with data:", JSON.stringify(formData, null, 2));

    const registration = await Registration.create(formData);

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
    const { page = 1, limit = 10, search = "", status, type, regType, source, parentId } = req.query;

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
    if (regType === "individual") {
      query.$and.push({
        $or: [
          { parent: { $exists: false } },
          { parent: null }
        ]
      });
    } else if (regType === "parent") {
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
    if (regType === "individual") {
      tabStatsQuery.$and.push({ $or: [{ parent: { $exists: false } }, { parent: null }] });
    } else if (regType === "parent") {
      tabStatsQuery.$and.push({ parent: { $ne: null, $exists: true } });
    }
    if (tabStatsQuery.$and.length === 0) delete tabStatsQuery.$and;

    const [total, registrations, typeStats, statusStats, sourceStats, individualTotal, parentTotal, parentStatsByReg] = await Promise.all([
      Registration.countDocuments(query),
      Registration.find(query)
        .populate("selectedTests")
        .populate("parent")
        .populate("test.name")
        .sort({ createdAt: -1 })
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
      .populate("parent")
      .populate("test.name");
    if (!registration) {
      return res.status(404).json({ success: false, message: "Registration not found" });
    }
    res.status(200).json({ success: true, data: registration });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch registration details",
      error: error.message,
    });
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

    // Handle empty parent
    if (formData.parent === "" || formData.parent === "null") {
      formData.parent = null;
    }

    // Handle empty numbers
    if (formData.establishmentYear === "") {
      formData.establishmentYear = null;
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
