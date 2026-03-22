import mongoose from 'mongoose';

const testServiceSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  status: {
    type: Boolean,
    default: true,
  },
  category_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    default: null
  },
  image: {
    local: { type: String, default: "" },
    cloudinary: { type: String, default: "" }
  },
  // Patient Instructions / Guidelines (Optional)
  fasting_required: {
    type: Boolean,
    default: false
  },
  fasting_hours: {
    type: Number,
    default: 0
  },
  instruction_text: {
    type: String,
    default: ""
  },
  sample_type: {
    type: String,
    default: ""
  },
  report_time: {
    type: String,
    default: ""
  },
  instructions: [
    {
      title: { type: String, default: "" },
      description: { type: String, default: "" }
    }
  ],
  mrp: {
    type: Number,
    default: 0
  },
  price: {
    type: Number,
    default: 0
  },
  test_code: {
    type: String,
    default: ""
  }
}, { timestamps: true });

const TestService = mongoose.model('TestService', testServiceSchema);

// Indexing for performance
testServiceSchema.index({ category_id: 1 });

export default TestService;
