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
    city: {
      type: String,
    },
    state: {
      type: String,
    },
    pincode: {
      type: String,
    },


    phone: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
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

    test: [
      {
        name: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "TestService",
        },
        price: String,
        discountPrice: String,
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
    source: {
      type: String,
      enum: ["website", "admin"],
      default: "website",
    },
  },
  { timestamps: true }
);

export default mongoose.model("Registration", registrationSchema);
