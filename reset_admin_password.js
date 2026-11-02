import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, ".env") });
dotenv.config();

async function resetPassword() {
  const targetEmail = "admin@gmail.com";
  const newPassword = "admin123";

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI not found in .env");
    process.exit(1);
  }

  try {
    console.log("Connecting to MongoDB Atlas...");
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
    console.log("Connected to MongoDB!");

    const db = mongoose.connection.db;
    const admin = await db.collection("admins").findOne({
      email: { $regex: new RegExp(`^${targetEmail}$`, "i") },
    });

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    if (admin) {
      console.log(`Found Admin: ID ${admin._id}, Email: ${admin.email}`);
      await db.collection("admins").updateOne(
        { _id: admin._id },
        { $set: { password: hashedPassword, email: targetEmail } }
      );
      console.log(`SUCCESS: Password for ${targetEmail} updated to "${newPassword}"!`);
    } else {
      console.log(`Admin ${targetEmail} not found. Creating new admin user...`);
      await db.collection("admins").insertOne({
        name: "Super Admin",
        email: targetEmail,
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log(`SUCCESS: Created new Admin (${targetEmail}) with password "${newPassword}"!`);
    }

    await mongoose.disconnect();
    console.log("Done.");
    process.exit(0);
  } catch (err) {
    console.error("Error resetting password:", err.message);
    process.exit(1);
  }
}

resetPassword();
