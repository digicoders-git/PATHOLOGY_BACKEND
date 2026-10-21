import dotenv from 'dotenv';
dotenv.config();
import connectDB from '../config/db.js';
import Registration from '../model/registration.model.js';
import WalletTransaction from '../model/walletTransaction.model.js';

async function fix() {
  await connectDB();
  const pendingLabs = await Registration.find({ approvalStatus: { $in: ['pending', 'hold', 'rejected'] } });
  console.log(`Found ${pendingLabs.length} unapproved labs.`);

  for (const lab of pendingLabs) {
    if (lab.walletBalance > 0) {
      console.log(`Resetting walletBalance from ${lab.walletBalance} to 0 for unapproved lab: ${lab.labName} (${lab.phone})`);
      lab.walletBalance = 0;
      await lab.save();
      // Remove any prematurely created welcome bonus transactions
      await WalletTransaction.deleteMany({
        labId: lab._id,
        description: { $regex: /Welcome Bonus/i }
      });
    }
  }

  console.log('Done!');
  process.exit(0);
}

fix();
