import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);
  try {
    await client.connect();
    
    // List databases
    const adminDb = client.db().admin();
    const dbsInfo = await adminDb.listDatabases();
    console.log("Databases:");
    for (const db of dbsInfo.databases) {
      console.log(` - ${db.name} (sizeOnDisk: ${db.sizeOnDisk})`);
      if (db.name !== 'admin' && db.name !== 'local') {
          const dbInstance = client.db(db.name);
          const cols = await dbInstance.listCollections().toArray();
          console.log(`   Collections: ${cols.map(c=>c.name).join(', ')}`);
          
          if (cols.some(c => c.name === 'testservices' || c.name === 'labtestpricings')) {
             const tests = await dbInstance.collection('testservices').find({}).toArray();
             const pricings = await dbInstance.collection('labtestpricings').find({}).toArray();
             console.log(`   -> Found ${tests.length} tests, ${pricings.length} pricings in ${db.name}`);
             
             // print offers
             for (const p of pricings) {
                const dp = parseFloat(p.discountPercent) || 0;
                const price = parseFloat(p.price) || 0;
                const dPrice = parseFloat(p.discountPrice) || 0;
                if (dp > 0 || (price > dPrice && dPrice > 0)) {
                   const tName = p.test; // Just ID for now
                   console.log(`      * Lab Pricing Offer: Test ${tName} | MRP: ${price} | Final: ${dPrice} | % OFF: ${dp}`);
                }
             }
          }
      }
    }
  } finally {
    await client.close();
  }
}
check().catch(console.dir);
