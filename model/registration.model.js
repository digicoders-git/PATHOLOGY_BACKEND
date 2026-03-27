import mongoose from "mongoose";

const registrationSchema = new mongoose.Schema(
  {
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Parent",
    },
    labName: {
      type: String,
      required: true,
    },
    labType: {
      type: String,
    },
    establishmentYear: {
      type: Number,
    },
    registrationNumber: {
      type: String,
    },
    labLogo: {
      type: String,
    },
    labBanner: {
      type: String,
    },
    description: {
      type: String,
    },


    fullAddress: {
      type: String,
    },
    areaName: {
      type: String,
    },
    city: {
      type: String,
    },
    state: {
      type: String,
    },
    pincode: {
      type: String,
    },
    latitude: {
      type: Number,
    },
    longitude: {
      type: Number,
    },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: [0, 0],
      },
    },


    phone: {
      type: String,
      required: true,
      unique: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
    },
    whatsapp: {
      type: String,
    },


    ownerName: {
      type: String,
      required: true,
    },
    ownerPhone: {
      type: String,
    },
    ownerEmail: {
      type: String,
    },


    selectedTests: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "TestService",
      },
    ],
    homeCollection: {
      type: Boolean,
      default: false,
    },
    is24x7: {
      type: Boolean,
      default: false,
    },
    emergency: {
      type: Boolean,
      default: false,
    },
    ambulanceService: {
      type: Boolean,
      default: false,
    },

    Certification: [
      {
        name: String,
        file: String,
      },
    ],


    openTime: {
      type: String,
    },
    closeTime: {
      type: String,
    },
    weeklyOff: {
      type: String,
    },


    upiId: {
      type: String,
    },
    bankName: {
      type: String,
    },
    accountNumber: {
      type: String,
    },
    ifscCode: {
      type: String,
    },
    pathologyDocs: {
      type: String,
    },

    status: {
      type: Boolean,
      default: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    source: {
      type: String,
      enum: ["website", "admin"],
      default: "website",
    },
  },
  { timestamps: true }
);

registrationSchema.index({ location: "2dsphere" });

export default mongoose.model("Registration", registrationSchema);
