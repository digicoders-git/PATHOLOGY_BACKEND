import express from "express";
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications,
  getUnreadCount,
} from "../controllers/notification.controller.js";
import { verifyAdminToken } from "../middleware/verifyAdminToken.js";

const router = express.Router();

router.get("/", verifyAdminToken, getNotifications);
router.get("/unread-count", verifyAdminToken, getUnreadCount);
router.patch("/mark-all-read", verifyAdminToken, markAllAsRead);
router.patch("/:id/read", verifyAdminToken, markAsRead);
router.delete("/clear-all", verifyAdminToken, deleteAllNotifications);
router.delete("/:id", verifyAdminToken, deleteNotification);

export default router;
