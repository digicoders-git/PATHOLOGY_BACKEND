import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';
dotenv.config();

async function updateOffers() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);
  try {
    await client.connect();
    // From my previous script, I found that the collections were in the `pathology` database
    const db = client.db('pathology');
    
    const pricings = await db.collection('labtestpricings').find({}).limit(10).toArray();
    console.log(`Found ${pricings.length} pricings to update.`);
    
    if (pricings.length === 0) {
      console.log("No lab pricings found to update!");
      return;
    }
    
    for (let i = 0; i < pricings.length; i++) {
      const p = pricings[i];
      const basePrice = parseFloat(p.price) || 2000;
      
      let updateDoc = {};
      
      // Alternate between percentage discount and flat discount
      if (i % 2 === 0) {
        // Percentage discount (e.g. 50% off)
        const percent = 50;
        const discountPrice = basePrice - (basePrice * percent / 100);
        updateDoc = {
          discountPercent: percent.toString(),
          discountPrice: discountPrice.toString(),
          price: basePrice.toString() // Ensure price is set
        };
      } else {
        // Flat discount (e.g. 500 Rs off)
        const amountOff = 500;
        const discountPrice = basePrice > amountOff ? basePrice - amountOff : basePrice / 2;
        updateDoc = {
          discountPercent: "0",
          discountPrice: discountPrice.toString(),
          price: basePrice.toString()
        };
      }
      
      await db.collection('labtestpricings').updateOne(
        { _id: p._id },
        { $set: updateDoc }
      );
      
      // Get the test name for printing
      const test = await db.collection('testservices').findOne({ _id: p.test });
      const testName = test ? test.title : p.test.toString();
      
      console.log(`Updated Test: ${testName}`);
      console.log(` -> Base Price: ${updateDoc.price}, Final Price: ${updateDoc.discountPrice}, % OFF: ${updateDoc.discountPercent}`);
    }
    
    console.log("Successfully updated 10 tests with offers!");
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.close();
  }
}
updateOffers().catch(console.dir);
