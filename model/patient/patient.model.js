import mongoose from "mongoose";

const patientSchema = new mongoose.Schema(
  {
    mobile: {
      type: String,
      required: true,
      unique: true,
    },
    name: {
      type: String,
      default: "",
    },
    email: {
      type: String,
      default: "",
      validate: {
        validator: function (v) {
          if (!v) return true;
          return /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(v);
        },
        message: "Please enter a valid email address."
      }
    },
    gender: {
      type: String,
      default: ""
    },
    age: {
      type: Number,
      default: 0,
      min: [0, "Age cannot be negative"]
    },
    address: {
      type: String,
      default: ""
    },
    profileImage: {
      type: String,
      default: ""
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Patient", patientSchema);
