import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';

async function run() {
  const uri = process.env.MONGODB_URI;
  await mongoose.connect(uri);
  
  const ids = [
    "6a0e9aefa13457a02be69c84",
    "6a0e9a79a13457a02be69c70",
    "6a0e98cea13457a02be69c46",
    "6a0e98bfa13457a02be69c3f"
  ];

  const db = mongoose.connection.db;

  for (const id of ids) {
    const booking = await db.collection('bookings').findOne({ _id: new mongoose.Types.ObjectId(id) });
    if (booking) {
      console.log(`\nBooking ID: ${booking._id}`);
      console.log(`Saved Registration ID: ${booking.registration}`);
      
      const lab = await db.collection('registrations').findOne({ _id: booking.registration });
      if (lab) {
        console.log(`Lab Name in DB: ${lab.labName}, City: ${lab.city}`);
      } else {
        console.log(`Lab with ID ${booking.registration} not found in registrations collection.`);
      }
    } else {
      console.log(`Booking ${id} not found.`);
    }
  }

  await mongoose.disconnect();
}

run().catch(console.error);
