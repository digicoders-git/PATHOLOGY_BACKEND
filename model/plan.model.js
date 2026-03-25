import mongoose from "mongoose";

const planSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  price: {
    type: Number,
    required: true
  },
  totalPrice: {
    type: Number,
    default: 0
  },
  priceLabel: {
    type: String,
    default: "per month", // e.g. "per BuyLead" or "per year"
    trim: true
  },
  badgeText: {
    type: String,
    trim: true
  },
  features: [{
    type: String,
    trim: true
  }],
  status: {
    type: Boolean,
    default: true
  },
  isPopular: {
    type: Boolean,
    default: false
  },
  displayOrder: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

const Plan = mongoose.model("Plan", planSchema);
export default Plan;
