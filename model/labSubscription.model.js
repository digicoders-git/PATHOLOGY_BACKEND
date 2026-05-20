import mongoose from "mongoose";

const labSubscriptionSchema = new mongoose.Schema(
  {
    labId: { type: mongoose.Schema.Types.ObjectId, ref: "Registration", required: true, unique: true },
    packageId: { type: mongoose.Schema.Types.ObjectId, ref: "Package", default: null },
    subscriptionStatus: { type: String, enum: ["free", "active", "expired"], default: "free" },

    // Free booking tracking
    freeBookingsLimit: { type: Number, default: 0 },
    freeBookingsUsed: { type: Number, default: 0 },

    // Plan booking tracking
    weeklyBookingLimit: { type: Number, default: 0 },
    monthlyBookingLimit: { type: Number, default: 0 },
    yearlyBookingLimit: { type: Number, default: 0 },
    bookingsThisWeek: { type: Number, default: 0 },
    bookingsThisMonth: { type: Number, default: 0 },
    bookingsThisYear: { type: Number, default: 0 },
    totalBookingsAccepted: { type: Number, default: 0 },

    // Plan validity
    planStartDate: { type: Date, default: null },
    planEndDate: { type: Date, default: null },

    // Period reset tracking
    weekResetAt: { type: Date, default: null },
    monthResetAt: { type: Date, default: null },
    yearResetAt: { type: Date, default: null },

    // Payment info
    razorpayOrderId: { type: String, default: "" },
    razorpayPaymentId: { type: String, default: "" },
    lastPaymentAmount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model("LabSubscription", labSubscriptionSchema);
