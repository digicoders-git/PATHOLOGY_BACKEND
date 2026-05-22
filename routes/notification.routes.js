import express from 'express';
import jwt from 'jsonwebtoken';
import { saveFCMToken, removeFCMToken, getUserFCMTokens, sendNotificationToUser, sendNotificationToTopic, subscribeToTopic, unsubscribeFromTopic } from '../services/notificationService.js';
import { verifyAdminToken } from '../middleware/verifyAdminToken.js';
import { markAsRead, markAllAsRead, deleteNotification, deleteAllNotifications, getUnreadCount, getNotifications } from '../controllers/notification.controller.js';

const router = express.Router();

// Decode JWT — works for both admin and lab tokens
const anyAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }
  try {
    const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
    if (!decoded?.id) return res.status(401).json({ success: false, message: 'Invalid token' });
    req.user = { id: decoded.id.toString(), role: decoded.role || 'pathology' };
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

// Save FCM token
router.post('/save-token', anyAuth, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ success: false, message: 'FCM token is required' });
    const result = await saveFCMToken(req.user.id, token, req.user.role);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Remove FCM token
router.post('/remove-token', anyAuth, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ success: false, message: 'FCM token is required' });
    const result = await removeFCMToken(req.user.id, token, req.user.role);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get FCM tokens
router.get('/get-tokens', anyAuth, async (req, res) => {
  try {
    const result = await getUserFCMTokens(req.user.id, req.user.role);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Subscribe to topic
router.post('/subscribe-to-topic', anyAuth, async (req, res) => {
  try {
    const { topic } = req.body;
    if (!topic) return res.status(400).json({ success: false, message: 'Topic is required' });
    const { tokens } = await getUserFCMTokens(req.user.id, req.user.role);
    if (!tokens || tokens.length === 0) {
      return res.status(400).json({ success: false, message: 'No FCM tokens found. Save a token first.' });
    }
    const result = await subscribeToTopic(tokens, topic);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Unsubscribe from topic
router.post('/unsubscribe-from-topic', anyAuth, async (req, res) => {
  try {
    const { topic } = req.body;
    if (!topic) return res.status(400).json({ success: false, message: 'Topic is required' });
    const { tokens } = await getUserFCMTokens(req.user.id, req.user.role);
    if (!tokens || tokens.length === 0) {
      return res.status(400).json({ success: false, message: 'No FCM tokens found' });
    }
    const result = await unsubscribeFromTopic(tokens, topic);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Test notification
router.post('/test-notification', anyAuth, async (req, res) => {
  try {
    const { title = 'Test Notification', body = 'This is a test notification' } = req.body;
    const result = await sendNotificationToUser(req.user.id, title, body, { type: 'test' }, req.user.role);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Send to topic (no auth) — v2
router.post('/send-to-topic', async (req, res) => {
  try {
    const { topic, title, body, data } = req.body;
    if (!topic || !title || !body) {
      return res.status(400).json({ success: false, message: 'topic, title, and body are required' });
    }
    const result = await sendNotificationToTopic(topic, title, body, data);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Admin notification panel routes
router.get('/', verifyAdminToken, getNotifications);
router.get('/unread-count', verifyAdminToken, getUnreadCount);
router.patch('/mark-all-read', verifyAdminToken, markAllAsRead);
router.delete('/clear-all', verifyAdminToken, deleteAllNotifications);
router.patch('/:id/read', verifyAdminToken, markAsRead);
router.delete('/:id', verifyAdminToken, deleteNotification);

export default router;
