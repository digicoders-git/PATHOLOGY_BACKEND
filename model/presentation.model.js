import mongoose from "mongoose";

const presentationSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    category: {
      type: String,
      required: true,
      trim: true,
      default: "Company Profile",
    },
    banner: {
      local: { type: String, default: "" },
      cloudinary: { type: String, default: "" },
    },
    type: { type: String, trim: true, default: "PDF" }, // PDF or PPT
    pages: { type: String, trim: true, default: "20" },
    date: { type: String, trim: true, default: "" },
    fileUrl: { type: String, trim: true, default: "" },
    status: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model("Presentation", presentationSchema);
