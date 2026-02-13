import mongoose from 'mongoose'

const adminSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  profilePhoto: {
    type: String,
    default: ""
  },
  password: {
    type: String,
    required: true
  }
}, { timestamps: true })

const Admin = mongoose.model('Admin', adminSchema)
export default Admin