import dotenv from 'dotenv';
dotenv.config();
import connectDB from '../config/db.js';
import Registration from '../model/registration.model.js';

async function check() {
  await connectDB();
  const all = await Registration.find({}).limit(5).select('labName phone approvalStatus status walletBalance');
  console.log('Sample registrations in DB:', all);
  const ro45 = await Registration.find({ labName: { $regex: /RO/i } });
  console.log('RO labs:', ro45);
  process.exit(0);
}

check();
