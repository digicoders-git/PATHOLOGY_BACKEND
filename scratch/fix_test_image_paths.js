import dotenv from 'dotenv';
dotenv.config();
import connectDB from '../config/db.js';
import TestService from '../model/testService.model.js';

await connectDB();

const tests = await TestService.find({ 'image.local': { $regex: '^https?://' } });
console.log(`Found ${tests.length} tests with full URL in image.local`);

let fixed = 0;
for (const test of tests) {
  const local = test.image?.local || '';
  if (local.startsWith('http')) {
    try {
      const url = new URL(local);
      const relativePath = url.pathname.replace(/^\//, ''); // remove leading slash
      test.image = { local: relativePath, cloudinary: test.image?.cloudinary || '' };
      await test.save();
      console.log(`Fixed: ${test.title} → ${relativePath}`);
      fixed++;
    } catch (e) {
      console.error(`Failed for ${test.title}: ${e.message}`);
    }
  }
}

console.log(`\nDone. Fixed ${fixed}/${tests.length} records.`);
process.exit(0);
