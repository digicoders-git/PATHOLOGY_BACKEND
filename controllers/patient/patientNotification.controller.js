import PatientNotification from "../../model/patientNotification.model.js";

/**
 * Get all notifications for the logged-in patient
 */
export const getMyNotifications = async (req, res) => {
  try {
    const patientId = req.user.id;
    const { page = 1, limit = 20 } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const total = await PatientNotification.countDocuments({ patientId });
    const unreadCount = await PatientNotification.countDocuments({ patientId, isRead: false });

    const notifications = await PatientNotification.find({ patientId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      count: notifications.length,
      unreadCount,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      },
      data: notifications,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Mark a specific notification as read
 */
export const markNotificationAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const patientId = req.user.id;

    const notification = await PatientNotification.findOneAndUpdate(
      { _id: id, patientId },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }

    res.status(200).json({ success: true, message: "Marked as read", data: notification });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Mark all notifications as read for the patient
 */
export const markAllNotificationsAsRead = async (req, res) => {
  try {
    const patientId = req.user.id;
    
    await PatientNotification.updateMany(
      { patientId, isRead: false },
      { isRead: true }
    );

    res.status(200).json({ success: true, message: "All notifications marked as read" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
