import mongoose from "mongoose";

const patientNotificationSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ["booking_status", "report_ready", "payment", "offer", "system"],
      default: "system",
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    relatedBookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TestBooking",
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.model("PatientNotification", patientNotificationSchema);
