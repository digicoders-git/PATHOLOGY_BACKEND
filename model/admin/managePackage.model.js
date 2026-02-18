import mongoose from "mongoose";

const packageSchema = new mongoose.Schema(
{
  packageName: {
    type: String,
    required: true,
  },

  description: {
    type: String,
  },

  category: {
    type: String,
  },

  image: {
    type: String,
  },

  tests: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TestService",
    }
  ],

  actualPrice: {
    type: Number,
  },

  discountPrice: {
    type: Number,
  },

  status: {
    type: Boolean,
    default: true,
  },

  isDeleted: {
    type: Boolean,
    default: false,
  }
},
{ timestamps: true }
);

const Package = mongoose.model("Package", packageSchema);
export default Package;

