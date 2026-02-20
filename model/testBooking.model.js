import mongoose from "mongoose";

const testBookingSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
    },
    labTestPricingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LabTestPricing",
      required: true,
    },
    labId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Registration",
      required: true,
    },
    bookingDate: {
      type: String, // String format YYYY-MM-DD
      required: true,
    },
    slotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LabSlot",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ["Pending", "Paid", "Failed"],
      default: "Pending",
    },
    bookingStatus: {
      type: String,
      enum: ["Pending", "Confirmed", "Completed", "Cancelled"],
      default: "Pending",
    },
    reportStatus: {
      type: String,
      enum: ["Pending", "Processing", "Uploaded", "NA"],
      default: "Pending",
    },
    paymentMode: {
      type: String,
      enum: ["Online", "Cash on Collection"],
      required: true,
    },
    bookingId: {
      type: String,
      unique: true,
    },
    reportFile: {
      type: String,
      default: "",
    }
  },
  { timestamps: true }
);

// Pre-save hook to generate a unique booking ID if not provided
testBookingSchema.pre("save", async function () {
  if (!this.bookingId) {
    const date = new Date();
    const prefix = "BK" + date.getFullYear().toString().slice(-2) + (date.getMonth() + 1).toString().padStart(2, '0');
    const random = Math.floor(1000 + Math.random() * 9000);
    this.bookingId = prefix + random;
  }
});

export default mongoose.model("TestBooking", testBookingSchema);
