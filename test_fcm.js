import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/Pathology_App');

    const Patient = (await import('./model/patient/patient.model.js')).default;
    const { sendNotificationToUser } = await import('./services/notificationService.js');

    const patients = await Patient.find({ 'fcmTokens.0': { $exists: true } });
    
    if (patients.length === 0) {
      console.log("No patients with FCM tokens found.");
      process.exit(0);
    }

    console.log(`Found ${patients.length} patients with FCM tokens. Testing with the first one: ${patients[0].name || patients[0].mobile}`);

    const result = await sendNotificationToUser(
      patients[0]._id.toString(),
      '🧪 Test Notification',
      'If you see this, the FCM token is working properly!',
      { type: 'test' },
      'patient'
    );

    console.log("Notification Result:", result);
  } catch (error) {
    console.error("Error:", error);
  } finally {
    process.exit(0);
  }
}

run();
