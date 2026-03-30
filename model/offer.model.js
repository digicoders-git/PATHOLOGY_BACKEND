import mongoose from "mongoose";

const offerSchema = new mongoose.Schema(
  {
    // If set → lab owner's offer, if null → admin offer
    labId: { type: mongoose.Schema.Types.ObjectId, ref: "Registration", default: null, index: true },
    title: { type: String, required: true, trim: true },
    subtitle: { type: String, trim: true, default: "" },
    description: { type: String, default: "" },
    couponCode: { type: String, trim: true, default: "" },
    discountPercent: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    offerType: {
      type: String,
      enum: ["banner", "popup", "slider"],
      default: "slider",
    },
    image: {
      local: { type: String, default: "" },
      cloudinary: { type: String, default: "" },
    },
    link: { type: String, default: "" },
    bgColor: { type: String, default: "#ffffff" },
    textColor: { type: String, default: "#000000" },
    validFrom: { type: Date, default: null },
    validTo: { type: Date, default: null },
    status: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model("Offer", offerSchema);
