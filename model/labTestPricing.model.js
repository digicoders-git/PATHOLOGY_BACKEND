import mongoose from "mongoose";

const labTestPricingSchema = new mongoose.Schema(
  {
    registration: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Registration",
      required: true,
    },
    test: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TestService",
      required: true,
    },
    price: {
      type: String,
    },
    discountPrice: {
      type: String,
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Registration",
      required: true,
    },
    status: {
      type: Boolean,
      default: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

export default mongoose.model("LabTestPricing", labTestPricingSchema);
