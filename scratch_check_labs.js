import mongoose from 'mongoose';
import Registration from './model/registration.model.js';
import dotenv from 'dotenv';
dotenv.config();

async function checkLabs() {
  await mongoose.connect(process.env.MONGODB_URI);
  const labs = await Registration.find().sort({ createdAt: -1 }).limit(5);
  console.log("Recent Labs:", labs.map(l => ({
    id: l._id,
    name: l.labName,
    parent: l.parent,
    status: l.status,
    source: l.source,
    createdAt: l.createdAt
  })));
  process.exit(0);
}
checkLabs();
