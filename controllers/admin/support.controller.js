import Support from "../../model/support.model.js";
import { sendNotificationToUser } from "../../services/notificationService.js";

/**
 * Get all support queries
 */
export const getAllSupportQueries = async (req, res) => {
  try {
    const queries = await Support.find()
      .populate("patientId", "name mobile email")
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
    const query = await Support.findById(queryId).populate("patientId", "name mobile email");

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

    // Send FCM Notification to Patient
    if ((isStatusChanged || isReplied) && query.patientId) {
      const title = isReplied ? "Support Query Replied" : "Support Query Updated";
      const body = isReplied 
        ? `Admin has replied to your query regarding: ${query.subject}`
        : `The status of your query '${query.subject}' has been updated to: ${query.status}`;
      
      // We pass 'patient' as the role so it uses the Patient model to find FCM tokens
      sendNotificationToUser(query.patientId, title, body, { queryId: query._id.toString(), type: "SUPPORT" }, "patient")
        .catch(err => console.log("Failed to send FCM notification:", err.message));
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
