import express from 'express';
import { pathologyAuth } from '../../middleware/pathologyAuth.middleware.js';
import { saveFCMToken, removeFCMToken, getUserFCMTokens } from '../../services/notificationService.js';

const router = express.Router();

/**
 * POST /pathology/notifications/save-token
 * Lab app calls this after login to save FCM token
 * Body: { token: "FCM_TOKEN_FROM_FIREBASE" }
 */
router.post('/save-token', pathologyAuth, async (req, res) => {
  try {
    const { token } = req.body;
    const labId = req.user.id.toString();

    if (!token) {
      return res.status(400).json({ success: false, message: 'FCM token is required' });
    }

    const result = await saveFCMToken(labId, token, 'pathology');
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /pathology/notifications/remove-token
 * Lab app calls this on logout to remove FCM token
 * Body: { token: "FCM_TOKEN" }
 */
router.post('/remove-token', pathologyAuth, async (req, res) => {
  try {
    const { token } = req.body;
    const labId = req.user.id.toString();

    if (!token) {
      return res.status(400).json({ success: false, message: 'FCM token is required' });
    }

    const result = await removeFCMToken(labId, token, 'pathology');
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /pathology/notifications/get-tokens
 * Get all saved FCM tokens for this lab
 */
router.get('/get-tokens', pathologyAuth, async (req, res) => {
  try {
    const labId = req.user.id.toString();
    const result = await getUserFCMTokens(labId, 'pathology');
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
