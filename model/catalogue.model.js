import mongoose from "mongoose";

const catalogueSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Catalogue title is required"],
      trim: true,
    },
    subtitle: {
      type: String,
      trim: true,
      default: "",
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    cover: {
      local: {
        type: String,
        default: "",
      },
      cloudinary: {
        type: String,
        default: "",
      },
    },
    file: {
      local: {
        type: String,
        default: "",
      },
      cloudinary: {
        type: String,
        default: "",
      },
    },
    fileSize: {
      type: String,
      trim: true,
      default: "",
    },
    pages: {
      type: String,
      trim: true,
      default: "24",
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

catalogueSchema.index({ status: 1, order: 1, createdAt: -1 });
catalogueSchema.index({ title: "text", description: "text" });

const Catalogue = mongoose.models.Catalogue || mongoose.model("Catalogue", catalogueSchema);

export default Catalogue;
