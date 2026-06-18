import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: 'userType'
    },
    userType: {
      type: String,
      required: true,
      enum: ['Patient', 'Registration'] // Patient or Lab
    },
    amount: {
      type: Number,
      required: true,
    },
    type: {
      type: String,
      required: true,
      enum: ['credit', 'debit'], // credit (refund/add money), debit (booking deduction)
    },
    status: {
      type: String,
      required: true,
      enum: ['pending', 'success', 'failed', 'refunded'],
      default: 'pending'
    },
    paymentMode: {
      type: String,
      default: 'Online'
    },
    description: {
      type: String,
    },
    relatedBooking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TestBooking',
      default: null
    },
    razorpayPaymentId: {
      type: String,
      default: null
    },
    razorpayOrderId: {
      type: String,
      default: null
    }
  },
  { timestamps: true }
);

export default mongoose.model("Transaction", transactionSchema);
