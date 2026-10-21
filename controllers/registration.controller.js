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
      if (req.files.cmoCertificate) {
        formData.cmoCertificate = getLocalUrl(req, req.files.cmoCertificate[0]);
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

    // Set pending approval status if registration is from mobile app
    if (formData.source === "app") {
      formData.status = false;
      formData.approvalStatus = "pending";
    }

    // Hash password if provided
    if (formData.password) {
      formData.password = await bcrypt.hash(formData.password, 10);
    }

    // Handle FCM tokens from mobile app registration
    if (formData.fcmToken) {
      formData.fcmTokens = [formData.fcmToken];
    } else if (typeof formData.fcmTokens === "string") {
      try {
        formData.fcmTokens = JSON.parse(formData.fcmTokens);
      } catch (e) {
        formData.fcmTokens = [formData.fcmTokens];
      }
    }

    // Ensure initial walletBalance is 0 for unapproved registrations
    formData.walletBalance = Number(formData.walletBalance) || 0;

    const registration = await Registration.create(formData);

    // Auto notification — fire and forget
    const isApp = formData.source === "app";
    createNotification(
      isApp ? "New Lab Partner Registration (App)" : "New Lab Registration",
      `${formData.labName || "A new lab"} has submitted a registration request${isApp ? " from the Lab Mobile App (Pending Approval)" : ""}.`,
      "registration",
      "/dashboard/registrations",
      registration._id
    ).catch(() => {});

    // Send instant welcome push notification to device if FCM token was provided
    if (formData.fcmToken || (formData.fcmTokens && formData.fcmTokens.length > 0)) {
      try {
        const { sendToTokens } = await import("../services/notificationService.js");
        const tokensToSend = (formData.fcmTokens && formData.fcmTokens.length > 0)
          ? formData.fcmTokens
          : [formData.fcmToken];
        await sendToTokens(
          tokensToSend,
          "Registration Submitted! 📋",
          "Your lab registration has been received. Our admin team will review and verify your details within 48 hours.",
          {
            type: "account_approval",
            approvalStatus: "pending",
          }
        );
      } catch (fcmErr) {
        console.error("WELCOME_PUSH_ERR:", fcmErr);
      }
    }

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
    const { page = 1, limit = 10, search = "", status, type, regType, source, parentId, featured, approvalStatus, isProfileComplete } = req.query;

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

    if (approvalStatus) {
      query.$and.push({ approvalStatus });
    }

    if (isProfileComplete !== undefined && isProfileComplete !== "") {
      query.$and.push({ isProfileComplete: isProfileComplete === "true" || isProfileComplete === true });
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

    const [total, registrationsDocs, typeStats, statusStats, sourceStats, approvalStats, individualTotal, parentTotal, parentStatsByReg] = await Promise.all([
      Registration.countDocuments(query),
      Registration.find(query)
        .populate("selectedTests")
        .populate("parent")
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
      Registration.aggregate([
        { $match: tabStatsQuery },
        { $group: { _id: "$approvalStatus", count: { $sum: 1 } } }
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

    const regIds = registrationsDocs.map(r => r._id);
    const labTestPricings = await LabTestPricing.find({ registration: { $in: regIds } }).populate("test");

    const registrations = registrationsDocs.map(reg => {
      const obj = reg.toObject();
      obj.testPricing = labTestPricings.filter(p => p.registration.toString() === obj._id.toString());
      // Clean up any unapproved lab that mistakenly has wallet balance before admin approval
      if (obj.approvalStatus !== "approved" && obj.walletBalance > 0) {
        obj.walletBalance = 0;
        Registration.updateOne({ _id: obj._id }, { $set: { walletBalance: 0 } }).exec();
        import("../model/walletTransaction.model.js").then(({ default: WT }) => {
          WT.deleteMany({ labId: obj._id, description: { $regex: /Welcome Bonus/i } }).exec();
        }).catch(() => {});
      }
      return obj;
    });

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
          { label: "Admin", value: "admin", count: sourceStats.find(s => s._id === "admin")?.count || 0 },
          { label: "App", value: "app", count: sourceStats.find(s => s._id === "app")?.count || 0 }
        ],
        approvalStatus: [
          { label: "Pending", value: "pending", count: approvalStats.find(s => s._id === "pending")?.count || 0 },
          { label: "Approved", value: "approved", count: approvalStats.find(s => s._id === "approved")?.count || 0 },
          { label: "Rejected", value: "rejected", count: approvalStats.find(s => s._id === "rejected")?.count || 0 }
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
    const isTrue = status === true || status === "true";
    const updateData = { status: isTrue };
    if (isTrue) {
      updateData.approvalStatus = "approved";
    }
    const registration = await Registration.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );
    if (!registration) {
      return res.status(404).json({ success: false, message: "Registration not found" });
    }
    res.status(200).json({
      success: true,
      message: `Status updated to ${isTrue ? "Active" : "Inactive"}${isTrue ? " and Approved" : ""}`,
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

export const updateApprovalStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { approvalStatus, reason } = req.body;

    if (!["pending", "approved", "rejected", "hold"].includes(approvalStatus)) {
      return res.status(400).json({
        success: false,
        message: "Invalid approval status. Must be pending, approved, rejected, or hold.",
      });
    }

    const updateData = { approvalStatus };
    if (approvalStatus === "approved") {
      updateData.status = true;
      updateData.adminQuery = "";
    } else if (approvalStatus === "rejected") {
      updateData.status = false;
      if (reason) updateData.rejectReason = reason;
    } else if (approvalStatus === "hold") {
      updateData.status = false;
      updateData.adminQuery = reason || "Clarification needed on your registration details.";
    }

    const registration = await Registration.findById(id);
    if (!registration) {
      return res.status(404).json({ success: false, message: "Registration not found" });
    }

    registration.approvalStatus = approvalStatus;
    if (approvalStatus === "approved") {
      registration.status = true;
      registration.adminQuery = "";

      // Credit 100 Welcome Bonus points upon Admin approval (if not already given)
      try {
        const WalletTransaction = (await import("../model/walletTransaction.model.js")).default;
        const existingBonus = await WalletTransaction.findOne({
          labId: registration._id,
          description: { $regex: /Welcome Bonus/i },
        });

        if (!existingBonus) {
          registration.walletBalance = (Number(registration.walletBalance) || 0) + 100;

          await WalletTransaction.create({
            labId: registration._id,
            amount: 100,
            type: "credit",
            description: "Welcome Bonus - 100 Points on Account Approval",
            status: "success",
          });

          const LabNotification = (await import("../model/labNotification.model.js")).default;
          await LabNotification.create({
            labId: registration._id,
            title: "Welcome Bonus Credited! 🎁",
            body: "Congratulations! 100 points have been credited to your lab wallet upon approval of your registration.\n\n— Team Labo India",
            type: "WALLET",
          });
        }
      } catch (wErr) {
        console.error("APPROVAL_WALLET_BONUS_ERR:", wErr);
      }
    } else if (approvalStatus === "rejected") {
      registration.status = false;
      if (reason) registration.rejectReason = reason;
    } else if (approvalStatus === "hold") {
      registration.status = false;
      registration.adminQuery = reason || "Clarification needed on your registration details.";
    }

    await registration.save();

    // Send notifications to the lab
    try {
      let notifTitle = "Registration Status Update";
      let notifMsg = "";

      if (approvalStatus === "approved") {
        notifTitle = "Account Approved! 🎉";
        notifMsg = "Congratulations! Your lab registration has been approved by Admin and 100 welcome bonus points have been credited to your wallet. You can now login and complete your lab profile.\n\n— Team Labo India";
      } else if (approvalStatus === "hold") {
        notifTitle = "Action Required: Registration on Hold ⚠️";
        notifMsg = `${reason ? `Admin Query: ${reason}\n\n` : ""}Please update your details for verification.\n\n— Team Labo India`;
      } else {
        notifTitle = "Registration Rejected";
        notifMsg = `Your registration request was rejected by Admin.${reason ? "\nReason: " + reason : ""}\n\n— Team Labo India`;
      }

      const { sendNotificationToUser } = await import("../services/notificationService.js");
      // Use tokens on registration doc or registration ID
      const target = (registration.fcmTokens && registration.fcmTokens.length > 0)
        ? registration.fcmTokens
        : registration._id;

      await sendNotificationToUser(
        target,
        notifTitle,
        notifMsg,
        {
          type: "account_approval",
          approvalStatus,
          adminQuery: reason || "",
          rejectReason: reason || "",
          message: notifMsg,
        },
        "pathology"
      );
    } catch (notifErr) {
      console.error("APPROVAL_NOTIFICATION_ERR:", notifErr);
    }

    res.status(200).json({
      success: true,
      message: `Lab registration marked as ${approvalStatus}`,
      data: registration,
    });
  } catch (error) {
    console.error("UPDATE_APPROVAL_STATUS_ERR:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update approval status: " + error.message,
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
      if (req.files.cmoCertificate) {
        formData.cmoCertificate = getLocalUrl(req, req.files.cmoCertificate[0]);
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

/**
 * Credit Offer / Coupon / Custom points to Lab Wallet (Admin)
 * POST /registrations/wallet/credit
 */
export const creditLabWallet = async (req, res) => {
  try {
    const { labId, amount, type, description } = req.body;

    if (!labId || !amount || Number(amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid labId and a positive point/amount value are required",
      });
    }

    const numAmount = Number(amount);
    const lab = await Registration.findById(labId);
    if (!lab) {
      return res.status(404).json({ success: false, message: "Lab not found" });
    }

    lab.walletBalance = (lab.walletBalance || 0) + numAmount;
    await lab.save();

    const creditType = type || "Offer Points";
    const txDescription = description?.trim()
      ? description.trim()
      : `${creditType} Credited by Admin`;

    const WalletTransaction = (await import("../model/walletTransaction.model.js")).default;
    const transaction = await WalletTransaction.create({
      labId: lab._id,
      amount: numAmount,
      type: "credit",
      description: txDescription,
      status: "success",
    });

    // Create In-App Notification for the Lab
    try {
      const LabNotification = (await import("../model/labNotification.model.js")).default;
      await LabNotification.create({
        labId: lab._id,
        title: "Wallet Points Credited! 🎁",
        body: `₹${numAmount} (${creditType}) have been credited to your wallet by Admin. ${txDescription}\n\n— Team Labo India`,
        type: "WALLET",
      });
    } catch (notifErr) {
      console.error("LAB_NOTIFICATION_ERROR:", notifErr);
    }

    // Push Notification via FCM
    try {
      if (lab.fcmTokens && lab.fcmTokens.length > 0) {
        const { sendNotificationToUser } = await import("../services/notificationService.js");
        await sendNotificationToUser(lab.fcmTokens, {
          title: "Wallet Points Credited! 🎁",
          body: `₹${numAmount} (${creditType}) has been credited to your wallet by Admin.`,
          data: { type: "wallet_credit", amount: String(numAmount) },
        });
      }
    } catch (fcmErr) {
      console.error("FCM_PUSH_ERROR:", fcmErr);
    }

    res.status(200).json({
      success: true,
      message: `Successfully credited ${numAmount} points to ${lab.labName}'s wallet!`,
      data: {
        newBalance: lab.walletBalance,
        transaction,
      },
    });
  } catch (error) {
    console.error("CREDIT_LAB_WALLET_ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Failed to credit wallet points: " + error.message,
    });
  }
};

/**
 * Get Wallet Transactions for a Lab (Admin)
 * GET /registrations/:id/wallet-transactions
 */
export const getLabWalletTransactionsForAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const WalletTransaction = (await import("../model/walletTransaction.model.js")).default;
    const transactions = await WalletTransaction.find({ labId: id })
      .populate({
        path: "relatedBookingId",
        select: "bookingId totalAmount testAmount discount amountPaid",
      })
      .sort({ createdAt: -1 });

    const lab = await Registration.findById(id).select("walletBalance labName");

    res.status(200).json({
      success: true,
      data: {
        walletBalance: lab?.walletBalance || 0,
        labName: lab?.labName || "",
        transactions,
      },
    });
  } catch (error) {
    console.error("GET_LAB_WALLET_TXS_ADMIN_ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch wallet transactions: " + error.message,
    });
  }
};

/**
 * Save FCM token for a registration by ID or phone (Public)
 * POST /registrations/fcm-token
 */
export const saveRegistrationFcmToken = async (req, res) => {
  try {
    const { registrationId, phone, token } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, message: "FCM token is required" });
    }
    const cleanPhone = phone ? String(phone).replace(/\D/g, "") : null;
    let query = null;
    if (registrationId) {
      query = { _id: registrationId };
    } else if (cleanPhone) {
      query = { $or: [{ phone: cleanPhone }, { phone: String(phone) }] };
    }

    if (!query) {
      return res.status(400).json({ success: false, message: "registrationId or phone is required" });
    }

    const registration = await Registration.findOneAndUpdate(
      query,
      { $addToSet: { fcmTokens: token } },
      { new: true }
    );

    if (!registration) {
      return res.status(404).json({ success: false, message: "Registration not found" });
    }

    res.status(200).json({
      success: true,
      message: "FCM token saved successfully",
      data: { labId: registration._id, fcmCount: registration.fcmTokens?.length || 0 }
    });
  } catch (error) {
    console.error("SAVE_REG_FCM_TOKEN_ERROR:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

