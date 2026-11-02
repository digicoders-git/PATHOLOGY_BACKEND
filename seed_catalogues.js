import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import Catalogue from "./model/catalogue.model.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, ".env") });

const uploadsCataloguesDir = path.join(__dirname, "uploads", "catalogues");
if (!fs.existsSync(uploadsCataloguesDir)) {
  fs.mkdirSync(uploadsCataloguesDir, { recursive: true });
}

// Copy cover images from PATHOLOGY_WEBSITE/public/assets/catalogue/
const websiteAssetsDir = path.resolve(__dirname, "..", "PATHOLOGY_WEBSITE", "public", "assets", "catalogue");

const initialCatalogues = [
  {
    title: "General Catalogue",
    subtitle: "Complete product range and services overview.",
    description: "Complete product range and services overview.",
    fileSize: "8 MB",
    pages: "24",
    order: 1,
    sourceImage: "cat-1-general.png",
  },
  {
    title: "Pathology Test Guide",
    subtitle: "Detailed guide for various pathology tests.",
    description: "Detailed guide for various pathology tests.",
    fileSize: "5 MB",
    pages: "32",
    order: 2,
    sourceImage: "cat-2-pathology-test-guide.png",
  },
  {
    title: "Lab Partner Brochure",
    subtitle: "Partner with us for growth and success.",
    description: "Partner with us for growth and success.",
    fileSize: "3 MB",
    pages: "16",
    order: 3,
    sourceImage: "cat-3-lab-partner.png",
  },
  {
    title: "Mobile App Guide",
    subtitle: "Learn how to use our mobile app.",
    description: "Learn how to use our mobile app.",
    fileSize: "2 MB",
    pages: "14",
    order: 4,
    sourceImage: "cat-4-mobile-app.png",
  },
  {
    title: "Product Brochure",
    subtitle: "Explore our advanced pathology solutions.",
    description: "Explore our advanced pathology solutions.",
    fileSize: "4 MB",
    pages: "20",
    order: 5,
    sourceImage: "cat-5-product-brochure.png",
  },
  {
    title: "Corporate Profile",
    subtitle: "Know more about Labo India.",
    description: "Know more about Labo India.",
    fileSize: "6 MB",
    pages: "28",
    order: 6,
    sourceImage: "cat-6-corporate-profile.png",
  },
];

async function seed() {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error("MONGO_URI not found in .env");
    }

    console.log("Connecting to MongoDB...");
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB!");

    // Copy assets if source exists
    for (const item of initialCatalogues) {
      const srcPath = path.join(websiteAssetsDir, item.sourceImage);
      const destPath = path.join(uploadsCataloguesDir, item.sourceImage);
      if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
        console.log(`Copied: ${item.sourceImage} -> uploads/catalogues/`);
      } else {
        console.warn(`Source not found: ${srcPath}`);
      }
    }

    console.log("Upserting catalogues...");
    for (const item of initialCatalogues) {
      const coverPath = `uploads/catalogues/${item.sourceImage}`;
      const filter = { title: item.title };
      const update = {
        $set: {
          title: item.title,
          subtitle: item.subtitle,
          description: item.description,
          fileSize: item.fileSize,
          pages: item.pages,
          order: item.order,
          status: "Active",
          cover: {
            local: coverPath,
            cloudinary: "",
          },
        },
      };
      await Catalogue.findOneAndUpdate(filter, update, { upsert: true, new: true });
      console.log(`Seeded catalogue: ${item.title}`);
    }

    const count = await Catalogue.countDocuments();
    console.log(`Total catalogues in database: ${count}`);

    await mongoose.disconnect();
    console.log("Done!");
    process.exit(0);
  } catch (err) {
    console.error("Seed error:", err);
    process.exit(1);
  }
}

seed();
