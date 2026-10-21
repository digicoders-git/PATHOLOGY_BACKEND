import { messaging } from '../config/firebase.js';
import Admin from '../model/admin.models.js';
import Registration from '../model/registration.model.js';
import Patient from '../model/patient/patient.model.js';

// Determine which MongoDB model to use based on role
const getModel = (role) => {
  if (role === 'admin') return Admin;
  if (role === 'patient') return Patient;
  return Registration;
};

// Save FCM token to MongoDB
export const saveFCMToken = async (userId, token, role = 'pathology') => {
  try {
    const Model = getModel(role);
    await Model.findByIdAndUpdate(
      userId,
      { $addToSet: { fcmTokens: token } },
      { new: true }
    );
    return { success: true, message: 'FCM token saved' };
  } catch (error) {
    console.error('Error saving FCM token:', error);
    return { success: false, message: error.message };
  }
};

// Remove FCM token from MongoDB
export const removeFCMToken = async (userId, token, role = 'pathology') => {
  try {
    const Model = getModel(role);
    await Model.findByIdAndUpdate(
      userId,
      { $pull: { fcmTokens: token } }
    );
    return { success: true, message: 'FCM token removed' };
  } catch (error) {
    console.error('Error removing FCM token:', error);
    return { success: false, message: error.message };
  }
};

// Get FCM tokens from MongoDB
export const getUserFCMTokens = async (userId, role = 'pathology') => {
  try {
    const Model = getModel(role);
    const user = await Model.findById(userId).select('fcmTokens');
    if (!user) return { success: false, message: 'User not found', tokens: [] };
    return { success: true, tokens: user.fcmTokens || [] };
  } catch (error) {
    console.error('Error getting FCM tokens:', error);
    return { success: false, message: error.message, tokens: [] };
  }
};

// Send notification to specific user by userId or tokens
export const sendNotificationToUser = async (userOrTokens, title, body, data = {}, role = 'pathology') => {
  try {
    let tokens = [];
    let userId = null;

    // Support object parameters if passed as 2nd arg: (user, { title, body, data })
    if (typeof title === 'object' && title !== null && !body) {
      const opts = title;
      body = opts.body || opts.message || '';
      data = opts.data || {};
      role = opts.role || role;
      title = opts.title || '';
    }

    // Ensure all notification messages include official Team Labo India signature
    if (body && typeof body === 'string' && !body.includes('Team Labo India')) {
      body = `${body.trim()}\n\n— Team Labo India`;
    }
    data = { ...data, team: 'Team Labo India' };

    if (Array.isArray(userOrTokens)) {
      tokens = userOrTokens;
    } else if (typeof userOrTokens === 'string' && userOrTokens.length > 30 && !userOrTokens.match(/^[0-9a-fA-F]{24}$/)) {
      tokens = [userOrTokens];
    } else {
      userId = userOrTokens;
      const res = await getUserFCMTokens(userId, role);
      tokens = res.tokens || [];
    }

    if (userId && role === 'pathology') {
      try {
        const LabNotification = (await import('../model/labNotification.model.js')).default;
        await LabNotification.create({
          labId: userId,
          title,
          body,
          type: data.type || 'SYSTEM',
          refId: data.queryId || data.bookingId || data.offerId || null
        });
      } catch (err) {
        console.log('Failed to save LabNotification:', err.message);
      }
    }

    if (!tokens || tokens.length === 0) {
      console.log(`No FCM tokens found for target:`, userOrTokens);
      return { success: false, message: 'No FCM tokens found' };
    }
    return await sendToTokens(tokens, title, body, data);
  } catch (error) {
    console.error('Error sending notification to user:', error);
    return { success: false, message: error.message };
  }
};

// Send notification to all admins
export const sendNotificationToAdmins = async (title, body, data = {}) => {
  try {
    const admins = await Admin.find({}, 'fcmTokens');
    const tokens = admins.flatMap(a => a.fcmTokens || []);
    if (tokens.length === 0) {
      console.log('No admin FCM tokens found');
      return { success: false, message: 'No admin FCM tokens found' };
    }
    return await sendToTokens(tokens, title, body, data);
  } catch (error) {
    console.error('Error sending notification to admins:', error);
    return { success: false, message: error.message };
  }
};

// Send notification to all patients
export const sendNotificationToAllPatients = async (title, body, data = {}) => {
  try {
    const patients = await Patient.find({}, 'fcmTokens');
    const tokens = patients.flatMap(p => p.fcmTokens || []);
    if (tokens.length === 0) {
      console.log('No patient FCM tokens found');
      return { success: false, message: 'No patient FCM tokens found' };
    }
    return await sendToTokens(tokens, title, body, data);
  } catch (error) {
    console.error('Error sending notification to patients:', error);
    return { success: false, message: error.message };
  }
};

// Send to list of tokens
export const sendToTokens = async (tokens, title, body, data = {}) => {
  if (!tokens || tokens.length === 0) return { success: false, message: 'No tokens provided' };

  // Filter valid unique token strings
  const validTokens = [...new Set(tokens.filter(t => typeof t === 'string' && t.trim().length > 0))];
  if (validTokens.length === 0) return { success: false, message: 'No valid tokens' };

  const message = {
    notification: { title, body },
    data: stringifyData({
      ...data,
      title,
      body,
    }),
    android: {
      priority: 'high',
      notification: {
        sound: 'default',
        channelId: 'pathology_lab_notifications',
        priority: 'high',
        defaultSound: true,
        defaultVibrateTimings: true,
      }
    },
    apns: {
      headers: {
        'apns-priority': '10',
      },
      payload: {
        aps: {
          sound: 'default',
          alert: { title, body },
          contentAvailable: true,
        }
      }
    }
  };

  const results = [];
  for (const token of validTokens) {
    try {
      const response = await messaging.send({ ...message, token });
      console.log(`[FCM SUCCESS] Sent to ${token.substring(0, 15)}... MsgId: ${response}`);
      results.push({ token, success: true, messageId: response });
    } catch (error) {
      console.error(`[FCM ERROR] Failed for token ${token.substring(0, 15)}...:`, error.message);
      results.push({ token, success: false, error: error.message });
    }
  }
  return { success: true, message: 'Notifications sent', results };
};

// Send notification to topic
export const sendNotificationToTopic = async (topic, title, body, data = {}) => {
  try {
    const response = await messaging.send({
      notification: { title, body },
      data: stringifyData(data),
      topic
    });
    console.log('Notification sent to topic:', response);
    return { success: true, message: 'Notification sent to topic', messageId: response };
  } catch (error) {
    console.error('Error sending notification to topic:', error);
    return { success: false, message: error.message };
  }
};

// Subscribe tokens to topic
export const subscribeToTopic = async (tokens, topic) => {
  try {
    const response = await messaging.subscribeToTopic(tokens, topic);
    console.log(`Subscribed to topic ${topic}:`, response);
    return { success: true, message: 'Subscribed to topic' };
  } catch (error) {
    console.error('Error subscribing to topic:', error);
    return { success: false, message: error.message };
  }
};

// Unsubscribe tokens from topic
export const unsubscribeFromTopic = async (tokens, topic) => {
  try {
    const response = await messaging.unsubscribeFromTopic(tokens, topic);
    return { success: true, message: 'Unsubscribed from topic' };
  } catch (error) {
    console.error('Error unsubscribing from topic:', error);
    return { success: false, message: error.message };
  }
};

// FCM data values must all be strings
const stringifyData = (data) => {
  const result = {};
  for (const [key, value] of Object.entries(data || {})) {
    result[key] = value !== null && value !== undefined ? String(value) : '';
  }
  return result;
};
