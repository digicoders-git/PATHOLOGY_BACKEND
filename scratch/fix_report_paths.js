/**
 * fix_report_paths.js
 * Fixes broken reportFile paths in DB that contain full server paths like:
 *   /www/wwwroot/PATHOLOGY_BACKEND/uploads/reports/testReport-xxx.pdf
 * Converts them to correct URLs like:
 *   https://api.laboindia.com/uploads/reports/testReport-xxx.pdf
 *
 * Run: node scratch/fix_report_paths.js
 */

import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!MONGO_URI) { console.error('No MONGODB_URI in .env'); process.exit(1); }

await mongoose.connect(MONGO_URI);
console.log('Connected to DB');

const Booking = mongoose.model('Booking', new mongoose.Schema({ reportFile: String }, { strict: false }));
const TestBooking = mongoose.model('TestBooking', new mongoose.Schema({ reportFile: String }, { strict: false }));

function fixPath(reportFile) {
  if (!reportFile || reportFile.startsWith('https://api.laboindia.com/uploads/')) return null; // already correct
  const normalized = reportFile.replace(/\\/g, '/');
  const idx = normalized.indexOf('/uploads/');
  if (idx === -1) return null; // can't fix
  return `https://api.laboindia.com${normalized.slice(idx)}`;
}

let fixed = 0;

// Fix Booking collection
const bookings = await Booking.find({ reportFile: { $exists: true, $ne: '', $ne: null } });
for (const b of bookings) {
  const newPath = fixPath(b.reportFile);
  if (newPath) {
    await Booking.updateOne({ _id: b._id }, { $set: { reportFile: newPath } });
    console.log(`[Booking] Fixed: ${b.reportFile} → ${newPath}`);
    fixed++;
  }
}

// Fix TestBooking collection
const testBookings = await TestBooking.find({ reportFile: { $exists: true, $ne: '', $ne: null } });
for (const b of testBookings) {
  const newPath = fixPath(b.reportFile);
  if (newPath) {
    await TestBooking.updateOne({ _id: b._id }, { $set: { reportFile: newPath } });
    console.log(`[TestBooking] Fixed: ${b.reportFile} → ${newPath}`);
    fixed++;
  }
}

console.log(`\nDone! Fixed ${fixed} records.`);
await mongoose.disconnect();
