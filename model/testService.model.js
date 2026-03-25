import mongoose from 'mongoose';

const testServiceSchema = new mongoose.Schema({
  // ── Core Info ─────────────────────────────────────────────────────────────
  title: {
    type: String,
    required: true,
  },
  test_code: {
    type: String,
    default: ""
  },
  status: {
    type: Boolean,
    default: true,
  },
  is_featured: {
    type: Boolean,
    default: false,
  },
  category_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    default: null
  },
  image: {
    local:      { type: String, default: "" },
    cloudinary: { type: String, default: "" }
  },

  // ── Pricing ───────────────────────────────────────────────────────────────
  mrp:   { type: Number, default: 0 },
  price: { type: Number, default: 0 },

  // ── Logistics ─────────────────────────────────────────────────────────────
  sample_type:  { type: String, default: "" },
  report_time:  { type: String, default: "" },

  // ── Description ───────────────────────────────────────────────────────────
  short_description: { type: String, default: "" },   // plain text, 1-2 lines
  overview:          { type: String, default: "" },   // HTML from rich text editor

  // ── Purpose (array of strings) ────────────────────────────────────────────
  purpose: [{ type: String }],

  // ── Test Components ───────────────────────────────────────────────────────
  test_components: [
    {
      name:   { type: String, default: "" },   // E.g. ALT
      detail: { type: String, default: "" }    // E.g. Detects liver cell damage
    }
  ],

  // ── Test Method ───────────────────────────────────────────────────────────
  test_method: { type: String, default: "" },

  // ── Fasting ───────────────────────────────────────────────────────────────
  fasting_required: { type: Boolean, default: false },
  fasting_hours:    { type: Number,  default: 0 },

  // ── Precautions ───────────────────────────────────────────────────────────
  precautions_before: [{ type: String }],   // array of strings
  precautions_during: { type: String, default: "" },
  precautions_after:  [{ type: String }],   // array of strings

  // ── Legacy / Patient Instructions ─────────────────────────────────────────
  instruction_text: { type: String, default: "" },
  instructions: [
    {
      title:       { type: String, default: "" },
      description: { type: String, default: "" }
    }
  ],

}, { timestamps: true });

// Indexes for performance
testServiceSchema.index({ category_id: 1 });
testServiceSchema.index({ status: 1 });
testServiceSchema.index({ is_featured: 1 });
testServiceSchema.index({ title: 'text', test_code: 'text' });

const TestService = mongoose.model('TestService', testServiceSchema);
export default TestService;
