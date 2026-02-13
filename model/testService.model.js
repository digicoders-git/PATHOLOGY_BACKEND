import mongoose from 'mongoose';

const testServiceSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  status: {
    type: Boolean,
    default: true,
  }
}, { timestamps: true });

const TestService = mongoose.model('TestService', testServiceSchema);
export default TestService;
