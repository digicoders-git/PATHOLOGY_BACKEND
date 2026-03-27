import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: {
      type: String,
      enum: ["booking", "registration", "patient", "slot", "system"],
      default: "system",
    },
    isRead: { type: Boolean, default: false },
    link: { type: String, default: "" }, // optional redirect path
    refId: { type: mongoose.Schema.Types.ObjectId, default: null }, // related doc id
  },
  { timestamps: true }
);

export default mongoose.model("Notification", notificationSchema);
