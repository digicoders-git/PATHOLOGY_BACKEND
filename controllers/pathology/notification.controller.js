import LabNotification from "../../model/labNotification.model.js";

// Get paginated notifications for logged-in Lab
export const getMyNotifications = async (req, res) => {
  try {
    const labId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const total = await LabNotification.countDocuments({ labId });
    const unreadCount = await LabNotification.countDocuments({ labId, isRead: false });

    const notifications = await LabNotification.find({ labId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      message: "Notifications fetched successfully",
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      unreadCount,
      data: notifications,
    });
  } catch (error) {
    console.error("GET_NOTIFICATIONS_ERROR:", error);
    res.status(500).json({ success: false, message: "Failed to fetch notifications", error: error.message });
  }
};

// Get unread count only
export const getUnreadCount = async (req, res) => {
  try {
    const labId = req.user.id;
    const unreadCount = await LabNotification.countDocuments({ labId, isRead: false });
    res.status(200).json({ success: true, unreadCount });
  } catch (error) {
    console.error("GET_UNREAD_COUNT_ERROR:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Mark a notification as read
export const markAsRead = async (req, res) => {
  try {
    const labId = req.user.id;
    const { id } = req.params;

    const notification = await LabNotification.findOneAndUpdate(
      { _id: id, labId },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }

    res.status(200).json({ success: true, message: "Notification marked as read", data: notification });
  } catch (error) {
    console.error("MARK_READ_ERROR:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
