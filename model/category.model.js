import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  description: {
    type: String,
    default: '',
  },
  status: {
    type: Boolean,
    default: true,
  },
  image: {
    local: { type: String, default: "" },
    cloudinary: { type: String, default: "" }
  }
}, { timestamps: true });

const Category = mongoose.model('Category', categorySchema);
export default Category;
