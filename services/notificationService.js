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

// Send notification to specific user by userId
export const sendNotificationToUser = async (userId, title, body, data = {}, role = 'pathology') => {
  try {
    const { tokens } = await getUserFCMTokens(userId, role);
    if (!tokens || tokens.length === 0) {
      console.log(`No FCM tokens for user ${userId}`);
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

// Send to list of tokens
const sendToTokens = async (tokens, title, body, data = {}) => {
  const message = {
    notification: { title, body },
    data: stringifyData(data)
  };

  const results = [];
  for (const token of tokens) {
    try {
      const response = await messaging.send({ ...message, token });
      results.push({ token, success: true, messageId: response });
    } catch (error) {
      console.error(`Error sending to token ${token}:`, error.message);
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
