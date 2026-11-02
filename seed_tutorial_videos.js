import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import TutorialVideo from "./model/tutorialVideo.model.js";

const sampleVideos = [
  {
    title: "How to Book a Test on Labo India?",
    category: "Patient Guide",
    description: "Step-by-step guide to booking your pathology test with doorstep sample collection.",
    thumbnail: { local: "uploads/tutorials/banner-1-book-test.png", cloudinary: "" },
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    youtubeId: "dQw4w9WgXcQ",
    duration: "04:32",
    date: "Oct 25, 2025",
    views: "12.5K Views",
    status: true,
    sortOrder: 1,
  },
  {
    title: "How to Track Your Sample?",
    category: "Patient Guide",
    description: "Learn how to track phlebotomist assignment and real-time lab processing status.",
    thumbnail: { local: "uploads/tutorials/banner-2-track-sample.png", cloudinary: "" },
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    youtubeId: "dQw4w9WgXcQ",
    duration: "03:50",
    date: "Oct 24, 2025",
    views: "10.2K Views",
    status: true,
    sortOrder: 2,
  },
  {
    title: "How to Download Reports?",
    category: "Patient Guide",
    description: "Fast download of digitally signed medical test reports on web and mobile.",
    thumbnail: { local: "uploads/tutorials/banner-3-download-reports.png", cloudinary: "" },
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    youtubeId: "dQw4w9WgXcQ",
    duration: "03:15",
    date: "Oct 22, 2025",
    views: "8.7K Views",
    status: true,
    sortOrder: 3,
  },
  {
    title: "Lab Partner Dashboard Overview",
    category: "Lab Partner Guide",
    description: "Complete walkthrough of the Lab partner portal, order processing, and earnings.",
    thumbnail: { local: "uploads/tutorials/banner-4-partner-dashboard.png", cloudinary: "" },
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    youtubeId: "dQw4w9WgXcQ",
    duration: "05:20",
    date: "Oct 20, 2025",
    views: "6.9K Views",
    status: true,
    sortOrder: 4,
  },
  {
    title: "How to Manage Bookings?",
    category: "Lab Partner Guide",
    description: "Handling patient test orders, scheduling phlebotomist visits, and updating status.",
    thumbnail: { local: "uploads/tutorials/banner-5-manage-bookings.png", cloudinary: "" },
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    youtubeId: "dQw4w9WgXcQ",
    duration: "04:48",
    date: "Oct 18, 2025",
    views: "7.3K Views",
    status: true,
    sortOrder: 5,
  },
  {
    title: "How to Upload Reports on Labo India?",
    category: "Lab Partner Guide",
    description: "Securely upload PDF diagnostic test reports directly to patients and the portal.",
    thumbnail: { local: "uploads/tutorials/banner-6-upload-reports.png", cloudinary: "" },
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    youtubeId: "dQw4w9WgXcQ",
    duration: "03:22",
    date: "Oct 16, 2025",
    views: "5.6K Views",
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
    await mongoose.connect(uri);
    console.log("Connected to MongoDB for seeding.");

    for (const vid of sampleVideos) {
      const exists = await TutorialVideo.findOne({ title: vid.title });
      if (!exists) {
        await TutorialVideo.create(vid);
        console.log(`+ Created: ${vid.title}`);
      } else {
        console.log(`= Already exists: ${vid.title}`);
      }
    }

    console.log("Seeding completed successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Seeding error:", err.message);
    process.exit(1);
  }
}

seed();
