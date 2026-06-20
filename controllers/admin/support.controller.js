import Support from "../../model/support.model.js";
import { sendNotificationToUser } from "../../services/notificationService.js";

/**
 * Get all support queries
 */
export const getAllSupportQueries = async (req, res) => {
  try {
    const queries = await Support.find()
      .populate("patientId", "name mobile email")
      .populate("labId", "labName phone email")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: queries.length,
      data: queries,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get a specific support query by ID
 */
export const getSupportQueryById = async (req, res) => {
  try {
    const queryId = req.params.id;
    const query = await Support.findById(queryId)
      .populate("patientId", "name mobile email")
      .populate("labId", "labName phone email");

    if (!query) {
      return res.status(404).json({ success: false, message: "Support query not found" });
    }

    res.status(200).json({
      success: true,
      data: query,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Update support query (e.g., status, adminReply)
 */
export const updateSupportQuery = async (req, res) => {
  try {
    const queryId = req.params.id;
    const { status, adminReply } = req.body;

    const query = await Support.findById(queryId);

    if (!query) {
      return res.status(404).json({ success: false, message: "Support query not found" });
    }

    let isStatusChanged = false;
    let isReplied = false;

    if (status && query.status !== status) {
      query.status = status;
      isStatusChanged = true;
    }
    
    if (adminReply !== undefined && query.adminReply !== adminReply) {
      query.adminReply = adminReply;
      isReplied = true;
    }

    await query.save();

    // Send FCM Notification to User
    if (isStatusChanged || isReplied) {
      const title = isReplied ? "Support Query Replied" : "Support Query Updated";
      const body = isReplied 
        ? `Admin has replied to your query regarding: ${query.subject}`
        : `The status of your query '${query.subject}' has been updated to: ${query.status}`;
      
      if (query.userType === "Lab" && query.labId) {
        sendNotificationToUser(query.labId, title, body, { queryId: query._id.toString(), type: "SUPPORT" }, "pathology")
          .catch(err => console.log("Failed to send FCM notification to Lab:", err.message));
      } else if (query.userType === "Patient" && query.patientId) {
        sendNotificationToUser(query.patientId, title, body, { queryId: query._id.toString(), type: "SUPPORT" }, "patient")
          .catch(err => console.log("Failed to send FCM notification to Patient:", err.message));
      }
    }

    res.status(200).json({
      success: true,
      message: "Support query updated successfully",
      data: query,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Explicit API for Admin to Reply to a support query
 */
export const replyToSupportQuery = async (req, res) => {
  try {
    const queryId = req.params.id;
    const { adminReply } = req.body;

    if (!adminReply) {
      return res.status(400).json({ success: false, message: "Reply message is required" });
    }

    const query = await Support.findById(queryId);

    if (!query) {
      return res.status(404).json({ success: false, message: "Support query not found" });
    }

    query.adminReply = adminReply;
    query.status = "Resolved"; // Automatically mark as resolved when replied

    await query.save();

    // Send FCM Notification
    const title = "Support Query Replied";
    const body = `Admin has replied to your query regarding: ${query.subject}`;
    
    if (query.userType === "Lab" && query.labId) {
      sendNotificationToUser(query.labId, title, body, { queryId: query._id.toString(), type: "SUPPORT" }, "pathology")
        .catch(err => console.log("Failed to send FCM notification to Lab:", err.message));
    } else if (query.userType === "Patient" && query.patientId) {
      sendNotificationToUser(query.patientId, title, body, { queryId: query._id.toString(), type: "SUPPORT" }, "patient")
        .catch(err => console.log("Failed to send FCM notification to Patient:", err.message));
    }

    res.status(200).json({
      success: true,
      message: "Reply sent successfully",
      data: query,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Delete a support query
 */
export const deleteSupportQuery = async (req, res) => {
  try {
    const queryId = req.params.id;
    const query = await Support.findByIdAndDelete(queryId);

    if (!query) {
      return res.status(404).json({ success: false, message: "Support query not found" });
    }

    res.status(200).json({
      success: true,
      message: "Support query deleted successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
