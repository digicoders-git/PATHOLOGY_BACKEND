import mongoose from "mongoose";

const parentSchema = new mongoose.Schema({
  name:{
    type: String,
  },

  status: {
    type: Boolean,
    default: true,
  }
    
}, { timestamps: true })

export default mongoose.model("Parent", parentSchema);