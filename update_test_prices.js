import mongoose from 'mongoose';

const uri = "mongodb+srv://digicodersdevelopment_db_user:LsgpfZhoMejwO9Qd@cluster0.le63hap.mongodb.net/pathology?appName=Cluster0";

const testSchema = new mongoose.Schema({}, { strict: false });
const TestService = mongoose.model('TestService', testSchema, 'testservices');

async function updatePrices() {
  try {
    await mongoose.connect(uri);
    console.log("Connected to MongoDB.");

    // Update Liver Function Test (LFT)
    const res1 = await TestService.updateOne(
      { title: /Liver Function Test/i },
      { $set: { mrp: 1800, price: 1200 } }
    );
    console.log("Updated LFT:", res1);

    // Update Basic Health Checkup
    const res2 = await TestService.updateOne(
      { title: /Basic Health Checkup/i },
      { $set: { mrp: 2500, price: 1500 } }
    );
    console.log("Updated Health Checkup:", res2);

    console.log("Prices updated successfully!");
  } catch (e) {
    console.error(e);
  } finally {
    mongoose.connection.close();
  }
}

updatePrices();
