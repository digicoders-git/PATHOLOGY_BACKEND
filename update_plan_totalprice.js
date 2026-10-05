import mongoose from 'mongoose';

const LIVE_URI = 'mongodb+srv://digicodersdevelopment_db_user:jb4LPBjkqCzzYvdY@cluster0.5bhvhge.mongodb.net/pathologyLive?appName=Cluster0';

async function updateLivePlans() {
  try {
    await mongoose.connect(LIVE_URI);
    const db = mongoose.connection.db;

    await db.collection('plans').updateOne({ name: /MONTHLY PLAN/i }, { $set: { totalPrice: 2000 } });
    await db.collection('plans').updateOne({ name: /QUARTERLY PLAN/i }, { $set: { totalPrice: 6000 } });
    await db.collection('plans').updateOne({ name: /ANNUAL PLAN/i }, { $set: { totalPrice: 24000 } });

    const updated = await db.collection('plans').find({}).toArray();
    console.log('Updated pathologyLive plans:');
    updated.forEach(p => {
      console.log(`- ${p.name}: Price ₹${p.price} | Total ₹${p.totalPrice} | Badge: "${p.badgeText}"`);
    });

    await mongoose.disconnect();
    console.log('Done!');
  } catch (err) {
    console.error(err);
  }
}

updateLivePlans();
