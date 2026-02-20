import mongoose from "mongoose";

const labSlotSchema = new mongoose.Schema(
  {
    labId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Registration",
      required: true,
    },
    date: {
      type: String, // String format YYYY-MM-DD for easier filtering
      required: true,
    },
    startTime: {
      type: String, // format HH:MM
      required: true,
    },
    endTime: {
      type: String, // format HH:MM
      required: true,
    },
    isBooked: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Compound index to quickly find slots for a lab on a date
labSlotSchema.index({ labId: 1, date: 1 });

export default mongoose.model("LabSlot", labSlotSchema);
