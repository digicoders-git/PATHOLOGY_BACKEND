import mongoose from "mongoose";

const tutorialVideoSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    category: {
      type: String,
      required: true,
      trim: true,
      default: "Patient Guide",
    },
    description: { type: String, trim: true, default: "" },
    videoUrl: { type: String, trim: true, default: "" },
    youtubeId: { type: String, trim: true, default: "" },
    thumbnail: {
      local: { type: String, default: "" },
      cloudinary: { type: String, default: "" },
    },
    duration: { type: String, trim: true, default: "03:30" },
    date: { type: String, trim: true, default: "" },
    views: { type: String, trim: true, default: "1.2K Views" },
    status: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model("TutorialVideo", tutorialVideoSchema);
