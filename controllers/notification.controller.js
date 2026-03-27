import Notification from "../model/notification.model.js";

// Get all notifications (with pagination)
export const getNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 20, isRead } = req.query;
    const query = {};
    if (isRead !== undefined && isRead !== "") query.isRead = isRead === "true";

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Notification.countDocuments(query);
    const unreadCount = await Notification.countDocuments({ isRead: false });

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: notifications,
      total,
      unreadCount,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Mark single notification as read
export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await Notification.findByIdAndUpdate(
      id,
      { isRead: true },
      { new: true }
    );
    if (!notification)
      return res.status(404).json({ success: false, message: "Notification not found" });
    res.json({ success: true, message: "Marked as read", data: notification });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Mark all as read
export const markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany({ isRead: false }, { isRead: true });
    res.json({ success: true, message: "All notifications marked as read" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete single notification
export const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await Notification.findByIdAndDelete(id);
    if (!notification)
      return res.status(404).json({ success: false, message: "Notification not found" });
    res.json({ success: true, message: "Notification deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete all notifications
export const deleteAllNotifications = async (req, res) => {
  try {
    await Notification.deleteMany({});
    res.json({ success: true, message: "All notifications cleared" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get unread count only (for header bell icon polling)
export const getUnreadCount = async (req, res) => {
  try {
    const unreadCount = await Notification.countDocuments({ isRead: false });
    res.json({ success: true, unreadCount });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create notification (internal helper — also exposed as API)
export const createNotification = async (title, message, type = "system", link = "", refId = null) => {
  try {
    await Notification.create({ title, message, type, link, refId });
  } catch (err) {
    console.error("NOTIFICATION_CREATE_ERROR:", err.message);
  }
};
