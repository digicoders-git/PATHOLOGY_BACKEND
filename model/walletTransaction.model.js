import mongoose from "mongoose";

const walletTransactionSchema = new mongoose.Schema(
  {
    labId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Registration",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    type: {
      type: String,
      enum: ["credit", "debit"],
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    relatedBookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TestBooking",
    },
    status: {
      type: String,
      enum: ["pending", "success", "failed"],
      default: "success",
    },
  },
  { timestamps: true }
);

export default mongoose.model("WalletTransaction", walletTransactionSchema);
