import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import Presentation from "./model/presentation.model.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, ".env") });
dotenv.config();

const samplePresentations = [
  {
    title: "Labo India Company Profile",
    description: "Know more about our vision, mission and journey.",
    category: "Company Profile",
    banner: { local: "uploads/presentations/pres-1-company-profile.png", cloudinary: "" },
    type: "PDF",
    pages: "24",
    date: "Oct 25, 2025",
    status: true,
    sortOrder: 1,
  },
  {
    title: "Become a Lab Partner",
    description: "Join our growing network of pathology labs across India.",
    category: "Lab Partner",
    banner: { local: "uploads/presentations/pres-2-lab-partner.png", cloudinary: "" },
    type: "PPT",
    pages: "18",
    date: "Oct 24, 2025",
    status: true,
    sortOrder: 2,
  },
  {
    title: "Digital Pathology Network",
    description: "Explore our digital pathology solutions and automated report workflows.",
    category: "Healthcare & Events",
    banner: { local: "uploads/presentations/pres-3-digital-pathology.png", cloudinary: "" },
    type: "PDF",
    pages: "20",
    date: "Oct 22, 2025",
    status: true,
    sortOrder: 3,
  },
  {
    title: "Our Services & Solutions",
    description: "Comprehensive pathology services, test catalogs and doctor networks.",
    category: "Company Profile",
    banner: { local: "uploads/presentations/pres-4-services-solutions.png", cloudinary: "" },
    type: "PDF",
    pages: "30",
    date: "Oct 20, 2025",
    status: true,
    sortOrder: 4,
  },
  {
    title: "Healthcare Awareness",
    description: "Learn about preventive healthcare, annual checkups and early diagnostics.",
    category: "Healthcare & Events",
    banner: { local: "uploads/presentations/pres-5-healthcare-awareness.png", cloudinary: "" },
    type: "PPT",
    pages: "15",
    date: "Oct 18, 2025",
    status: true,
    sortOrder: 5,
  },
  {
    title: "Labo India Business Overview",
    description: "Discover our market footprint, scalable growth, franchise models and roadmap.",
    category: "Company Profile",
    banner: { local: "uploads/presentations/pres-6-business-overview.png", cloudinary: "" },
    type: "PDF",
    pages: "22",
    date: "Oct 16, 2025",
    status: true,
    sortOrder: 6,
  },
];

async function seed() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI not found in environment.");
    process.exit(1);
  }

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
    console.log("Connected to MongoDB for presentation seeding.");

    for (const item of samplePresentations) {
      const exists = await Presentation.findOne({ title: item.title });
      if (!exists) {
        await Presentation.create(item);
        console.log(`+ Created: ${item.title}`);
      } else {
        console.log(`= Already exists: ${item.title}`);
      }
    }

    console.log("Presentation seeding completed successfully!");
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("Presentation seeding error:", err.message);
    process.exit(1);
  }
}

seed();
