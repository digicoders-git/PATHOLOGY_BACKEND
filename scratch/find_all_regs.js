import dotenv from 'dotenv';
dotenv.config();
import connectDB from '../config/db.js';
import mongoose from 'mongoose';

async function check() {
  await connectDB();
  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();
  console.log('Collections:', collections.map(c => c.name));

  const regs = await db.collection('registrations').find({ phone: { $regex: /7905774843/ } }).toArray();
  console.log('Reg with phone 7905774843:', regs);

  const allRegs = await db.collection('registrations').find({}).toArray();
  console.log(`Total registrations in collection: ${allRegs.length}`);
  for (const r of allRegs) {
    console.log(`- ${r._id}: ${r.labName} | ${r.phone} | approval: ${r.approvalStatus} | wallet: ${r.walletBalance} | created: ${r.createdAt}`);
  }

  process.exit(0);
}

check();
