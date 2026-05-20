import mongoose from "mongoose";

const packageSchema = new mongoose.Schema(
  {
    packageName: { type: String, required: true },
    description: { type: String, default: "" },
    price: { type: Number, required: true },
    durationDays: { type: Number, required: true },   // plan validity in days
    durationType: {
      type: String,
      enum: ["weekly", "monthly", "yearly", "custom"],
      default: "monthly",
    },

    // Free bookings before plan purchase
    freeBookingsLimit: { type: Number, default: 0 },

    // Booking limits per period after plan purchase (0 = unlimited)
    weeklyBookingLimit: { type: Number, default: 0 },
    monthlyBookingLimit: { type: Number, default: 0 },
    yearlyBookingLimit: { type: Number, default: 0 },

    benefits: [{ type: String, trim: true }],
    isPopular: { type: Boolean, default: false },
    badgeText: { type: String, default: "" },
    status: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    displayOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model("Package", packageSchema);
