import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

async function run() {
  const uri = process.env.MONGODB_URI;
  await mongoose.connect(uri);
  
  const db = mongoose.connection.db;
  const admin = await db.collection('admins').findOne({});
  
  if (admin) {
    console.log(`Found Admin Email: ${admin.email}`);
    
    // Change password to 123456
    const hashedPassword = await bcrypt.hash('123456', 10);
    await db.collection('admins').updateOne({ _id: admin._id }, { $set: { password: hashedPassword } });
    
    console.log(`Password reset to: 123456`);
  } else {
    console.log("No admin found in the database. Creating one...");
    const hashedPassword = await bcrypt.hash('123456', 10);
    await db.collection('admins').insertOne({
        name: "Admin",
        email: "admin@gmail.com",
        password: hashedPassword
    });
    console.log(`Created Admin. Email: admin@gmail.com, Password: 123456`);
  }

  await mongoose.disconnect();
}

run().catch(console.error);
