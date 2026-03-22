import mongoose from 'mongoose';

const subcategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  category_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true,
  },
  description: {
    type: String,
    default: '',
  },
  status: {
    type: Boolean,
    default: true,
  }
}, { timestamps: true });

// Ensure unique subcategory name within the same category
subcategorySchema.index({ name: 1, category_id: 1 }, { unique: true });

const Subcategory = mongoose.model('Subcategory', subcategorySchema);
export default Subcategory;
