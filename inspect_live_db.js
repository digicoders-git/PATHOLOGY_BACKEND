import mongoose from 'mongoose';

const LIVE_URI = 'mongodb+srv://digicodersdevelopment_db_user:jb4LPBjkqCzzYvdY@cluster0.5bhvhge.mongodb.net/pathologyLive?appName=Cluster0';

async function checkLiveDB() {
  try {
    console.log('Connecting to Live MongoDB...');
    await mongoose.connect(LIVE_URI);
    console.log('Connected successfully!');

    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    console.log('\n--- Collections in pathologyLive ---');
    for (const col of collections) {
      const count = await db.collection(col.name).countDocuments();
      console.log(`- ${col.name}: ${count} docs`);
    }

    // Check categories
    console.log('\n--- Categories ---');
    const categories = await db.collection('categories').find({}).toArray();
    console.log(`Found ${categories.length} categories:`);
    categories.forEach(c => console.log(`  ID: ${c._id}, Name: "${c.name}", Status: ${c.status}`));

    // Check testservices
    console.log('\n--- TestServices ---');
    const testCount = await db.collection('testservices').countDocuments();
    console.log(`Total testservices: ${testCount}`);
    if (testCount > 0) {
      const sample = await db.collection('testservices').findOne({});
      console.log('Sample testservice:');
      console.log(JSON.stringify(sample, null, 2));
    }

    await mongoose.disconnect();
    console.log('\nDisconnected.');
  } catch (err) {
    console.error('Error connecting to live DB:', err);
    process.exit(1);
  }
}

checkLiveDB();
