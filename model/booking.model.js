import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
    },
    registration: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Registration",
      required: true,
    },
    tests: [
      {
        test: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "TestService",
        },
        mrp: Number,
        price: Number,
      },
    ],
    totalMrp: {
      type: Number,
      default: 0,
    },
    totalDiscount: {
      type: Number,
      default: 0,
    },
    finalAmount: {
      type: Number,
      default: 0,
    },
    bookingDate: {
      type: Date,
      default: Date.now,
    },
    scheduledDate: {
      type: Date,
    },
    sampleCollectionType: {
      type: String,
      enum: ["Home", "Lab"],
      default: "Lab",
    },
    address: {
      type: String, // Home collection address
    },
    status: {
      type: String,
      enum: [
        "Pending",
        "Confirmed",
        "Sample Collection Pending",
        "Sample Collected",
        "Sample Rejected",
        "Sample Received",
        "Processing",
        "Result Ready",
        "Under Review",
        "Report Generated",
        "Approved",
        "Completed",
        "Cancelled"
      ],
      default: "Pending",
    },
    reportFile: {
      type: String, // Path to the PDF report
    },
    reportUploadedAt: {
      type: Date,
    },
    paymentStatus: {
      type: String,
      enum: ["Pending", "Paid", "Failed"],
      default: "Pending",
    },
    paymentMethod: {
      type: String,
      enum: ["COD", "Online"],
      default: "COD",
    },
    notes: {
      type: String,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Booking", bookingSchema);
