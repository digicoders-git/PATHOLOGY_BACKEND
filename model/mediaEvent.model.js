import mongoose from "mongoose";

const galleryImageSchema = new mongoose.Schema(
  {
    local: { type: String, default: "" },
    cloudinary: { type: String, default: "" },
    title: { type: String, trim: true, default: "" },
    caption: { type: String, trim: true, default: "" },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const mediaEventItemSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true, default: "" },
    category: { type: String, trim: true, default: "" },
    image: {
      local: { type: String, default: "" },
      cloudinary: { type: String, default: "" },
    },
    imageUrl: { type: String, trim: true, default: "" },
    date: { type: String, trim: true, default: "" },
    location: { type: String, trim: true, default: "" },
    status: { type: String, trim: true, default: "" },
    source: { type: String, trim: true, default: "" },
    snippet: { type: String, trim: true, default: "" },
    url: { type: String, trim: true, default: "" },
    icon: { type: String, trim: true, default: "" },
    color: { type: String, trim: true, default: "" },
    handle: { type: String, trim: true, default: "" },
    desc: { type: String, trim: true, default: "" },
  },
  { _id: true }
);

const mediaEventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Media / Event title is required"],
      trim: true,
    },
    subtitle: {
      type: String,
      trim: true,
      default: "",
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      trim: true,
      default: "Media",
    },
    categoryKey: {
      type: String,
      trim: true,
      default: "media",
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    metaText: {
      type: String,
      trim: true,
      default: "",
    },
    buttonText: {
      type: String,
      trim: true,
      default: "View Details",
    },
    image: {
      local: {
        type: String,
        default: "",
      },
      cloudinary: {
        type: String,
        default: "",
      },
    },
    gallery: {
      type: [galleryImageSchema],
      default: [],
    },
    items: {
      type: [mediaEventItemSchema],
      default: [],
    },
    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

mediaEventSchema.index({ status: 1, order: 1, createdAt: -1 });
mediaEventSchema.index({ category: 1, categoryKey: 1 });
mediaEventSchema.index({ title: "text", description: "text" });

const MediaEvent =
  mongoose.models.MediaEvent || mongoose.model("MediaEvent", mediaEventSchema);

export default MediaEvent;
