import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import MediaEvent from "./model/mediaEvent.model.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, ".env") });

const uploadsMediaDir = path.join(__dirname, "uploads", "media");
if (!fs.existsSync(uploadsMediaDir)) {
  fs.mkdirSync(uploadsMediaDir, { recursive: true });
}

// Copy card images from website
const websiteAssetsDir = path.resolve(__dirname, "..", "PATHOLOGY_WEBSITE", "public", "assets", "media-event");

const initialMediaCards = [
  {
    title: "Photo Gallery",
    category: "Media",
    categoryKey: "media",
    description: "Explore our latest moments from events, activities and achievements.",
    metaText: "6 Photos", // Dynamic! Not 120!
    buttonText: "View Gallery",
    sourceImage: "card-1-photo-gallery.jpg",
    order: 1,
    gallery: [
      {
        title: "Labo India Diagnostic Facilities",
        caption: "Main pathology center and automated diagnostic laboratories",
        local: "uploads/media/card-1-photo-gallery.jpg",
      },
      {
        title: "Annual Healthcare Leadership Summit",
        caption: "Leadership meet with clinical pathologists & partners",
        local: "uploads/media/card-2-our-events.jpg",
      },
      {
        title: "Official Media & Press Announcement",
        caption: "Launch of express home sample collection initiative",
        local: "uploads/media/card-3-press-releases.jpg",
      },
      {
        title: "Digital Pathology & Social Network",
        caption: "Connected digital healthcare and reporting infrastructure",
        local: "uploads/media/card-4-follow-us.jpg",
      },
      {
        title: "Molecular Diagnostics Center",
        caption: "State-of-the-art sample processing automation",
        local: "uploads/tutorials/banner-2-track-sample.png",
      },
      {
        title: "Healthcare Awareness & Checkup Drive",
        caption: "Community screening camp for early detection",
        local: "uploads/presentations/pres-5-healthcare-awareness.png",
      },
    ],
    items: [],
  },
  {
    title: "Our Events",
    category: "Event",
    categoryKey: "event",
    description: "Discover upcoming and past events organized by Labo India.",
    metaText: "4 Events",
    buttonText: "View Events",
    sourceImage: "card-2-our-events.jpg",
    order: 2,
    gallery: [
      {
        title: "National Pathology & Diagnostic Conclave 2025",
        caption: "Conclave venue and keynote stage",
        local: "uploads/media/card-2-our-events.jpg",
      },
    ],
    items: [
      {
        title: "National Pathology & Diagnostic Conclave 2025",
        date: "November 15, 2025",
        location: "Vigyan Bhawan, New Delhi",
        status: "Upcoming",
        desc: "Keynote sessions on next-gen diagnostic automation and AI in clinical pathology.",
      },
      {
        title: "Digital Health & Smart Labs Symposium",
        date: "December 05, 2025",
        location: "Jio World Convention Centre, Mumbai",
        status: "Upcoming",
        desc: "Connecting 500+ lab partners, pathologists, and healthcare technology innovators.",
      },
      {
        title: "Free Preventive Health Checkup Drive",
        date: "October 10, 2025",
        location: "Community Health Center, Lucknow",
        status: "Completed",
        desc: "Over 2,500 citizens screened for preventive pathology markers and lifestyle indicators.",
      },
      {
        title: "Annual Lab Partner Excellence Awards",
        date: "September 22, 2025",
        location: "ITC Gardenia, Bengaluru",
        status: "Completed",
        desc: "Celebrating excellence and dedication across our nationwide partner laboratories.",
      },
    ],
  },
  {
    title: "Press Releases",
    category: "Press Note",
    categoryKey: "press",
    description: "Read our official press releases and media updates.",
    metaText: "4 Press Notes",
    buttonText: "View Press Notes",
    sourceImage: "card-3-press-releases.jpg",
    order: 3,
    gallery: [
      {
        title: "National Media Coverage",
        caption: "Leading business dailies cover Labo India network",
        local: "uploads/media/card-3-press-releases.jpg",
      },
    ],
    items: [
      {
        title: "Labo India Expands AI-Driven Diagnostic Network Across 200+ Cities",
        source: "The Economic Times",
        date: "October 20, 2025",
        snippet: "Accelerating report turnaround times with connected lab automation and digital pathology integration.",
      },
      {
        title: "Labo India Launches 2-Hour Express Home Sample Collection in Metros",
        source: "Healthcare Asia News",
        date: "October 08, 2025",
        snippet: "State-of-the-art cold-chain logistics ensures zero sample degradation and maximum test accuracy.",
      },
      {
        title: "Strategic Alliance Announced with Leading Multi-Specialty Hospital Chains",
        source: "Business Standard",
        date: "September 15, 2025",
        snippet: "Seamless API integration connects hospital EHR systems directly with Labo India processing hubs.",
      },
      {
        title: "Labo India Recognized as Fastest-Growing Health-Tech Brand of the Year",
        source: "Pharma & MedTech Review",
        date: "August 30, 2025",
        snippet: "Recognizing outstanding growth, digital innovation, and patient trust across urban and rural markets.",
      },
    ],
  },
  {
    title: "Follow Us",
    category: "Social Media",
    categoryKey: "social",
    description: "Connect with us on social media for the latest updates, health tips and more.",
    metaText: "5 Channels",
    buttonText: "Follow Us",
    sourceImage: "card-4-follow-us.jpg",
    order: 4,
    gallery: [
      {
        title: "Social Media Channels",
        caption: "Connect with our health community online",
        local: "uploads/media/card-4-follow-us.jpg",
      },
    ],
    items: [
      {
        title: "YouTube",
        handle: "@laboindia",
        desc: "Video tutorials, lab tours, and health awareness guides.",
        color: "#FF0000",
        url: "https://www.youtube.com/@laboindia",
        icon: "FaYoutube",
      },
      {
        title: "Instagram",
        handle: "@laboindia.official",
        desc: "Daily health tips, team updates, and event highlights.",
        color: "#E1306C",
        url: "https://www.instagram.com/",
        icon: "FaInstagram",
      },
      {
        title: "Facebook",
        handle: "Labo India Official",
        desc: "Community discussions, patient stories, and health drives.",
        color: "#1877F2",
        url: "https://www.facebook.com/",
        icon: "FaFacebook",
      },
      {
        title: "LinkedIn",
        handle: "Labo India Healthcare",
        desc: "Corporate updates, career opportunities, and partner network.",
        color: "#0A66C2",
        url: "https://www.linkedin.com/",
        icon: "FaLinkedin",
      },
      {
        title: "X (Twitter)",
        handle: "@LaboIndia",
        desc: "Real-time updates, health news, and announcements.",
        color: "#000000",
        url: "https://twitter.com/",
        icon: "FaTwitter",
      },
    ],
  },
];

async function seed() {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error("MONGO_URI not found in .env");
    }

    console.log("Connecting to MongoDB Atlas...");
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB!");

    // Copy assets if source exists
    for (const card of initialMediaCards) {
      const srcPath = path.join(websiteAssetsDir, card.sourceImage);
      const destPath = path.join(uploadsMediaDir, card.sourceImage);
      if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
        console.log(`Copied: ${card.sourceImage} -> uploads/media/`);
      }
    }

    console.log("Upserting Media & Event cards with dynamic gallery...");
    for (const card of initialMediaCards) {
      const imgPath = `uploads/media/${card.sourceImage}`;
      const filter = { title: card.title };
      const dynamicMeta = card.gallery && card.gallery.length > 0 ? `${card.gallery.length} Photos` : card.metaText;
      const update = {
        $set: {
          title: card.title,
          category: card.category,
          categoryKey: card.categoryKey,
          description: card.description,
          metaText: dynamicMeta,
          buttonText: card.buttonText,
          order: card.order,
          status: "Active",
          image: {
            local: imgPath,
            cloudinary: "",
          },
          gallery: card.gallery,
          items: card.items,
        },
      };
      await MediaEvent.findOneAndUpdate(filter, update, { upsert: true, new: true });
      console.log(`Seeded card: ${card.title} with ${card.gallery.length} gallery images! (meta: ${dynamicMeta})`);
    }

    const count = await MediaEvent.countDocuments();
    console.log(`Total Media & Event records in database: ${count}`);

    await mongoose.disconnect();
    console.log("Done!");
    process.exit(0);
  } catch (err) {
    console.error("Seed error:", err);
    process.exit(1);
  }
}

seed();
