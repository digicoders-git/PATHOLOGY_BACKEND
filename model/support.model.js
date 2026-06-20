import mongoose from "mongoose";

const supportSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: false,
    },
    labId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Registration",
      required: false,
    },
    userType: {
      type: String,
      enum: ["Patient", "Lab"],
      required: true,
      default: "Patient",
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["Open", "In Progress", "Resolved", "Closed"],
      default: "Open",
    },
    adminReply: {
      type: String,
      default: "",
    }
  },
  { timestamps: true }
);

export default mongoose.model("Support", supportSchema);
