import mongoose from "mongoose";

const labNotificationSchema = new mongoose.Schema(
  {
    labId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Registration", 
      required: true 
    },
    title: { type: String, required: true },
    body: { type: String, required: true },
    type: {
      type: String,
      enum: ["SUPPORT", "BOOKING", "SYSTEM", "WALLET", "OFFER"],
      default: "SYSTEM",
    },
    isRead: { type: Boolean, default: false },
    refId: { type: mongoose.Schema.Types.ObjectId, default: null }, // related doc id
  },
  { timestamps: true }
);

export default mongoose.model("LabNotification", labNotificationSchema);
