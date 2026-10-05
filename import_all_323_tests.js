import mongoose from 'mongoose';
import xlsx from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LIVE_URI = 'mongodb+srv://digicodersdevelopment_db_user:jb4LPBjkqCzzYvdY@cluster0.5bhvhge.mongodb.net/pathologyLive?appName=Cluster0';
const EXCEL_PATH = path.resolve(__dirname, '../Medical_Tests_With_Description.xlsx');

import TestService from './model/testService.model.js';
import Category from './model/category.model.js';

// Package schema for 'packages' collection
const packageSchema = new mongoose.Schema({
  packageName: { type: String, required: true },
  description: { type: String, default: '' },
  category: { type: String, default: '' },
  image: { type: String, default: null },
  tests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'TestService' }],
  actualPrice: { type: Number, default: 0 },
  discountPrice: { type: Number, default: 0 },
  status: { type: Boolean, default: true },
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

const PackageModel = mongoose.models.Package || mongoose.model('Package', packageSchema, 'packages');

async function importAll323Tests() {
  try {
    console.log(' Connecting to Live MongoDB (pathologyLive)...');
    await mongoose.connect(LIVE_URI);
    console.log(' Connected to Live MongoDB successfully!\n');

    // Read Excel
    console.log(` Reading Excel file: ${EXCEL_PATH}`);
    const wb = xlsx.readFile(EXCEL_PATH);

    // Build Category Map
    const allCategories = await Category.find({});
    const categoryMap = {};
    allCategories.forEach(c => {
      categoryMap[c.name.trim().toLowerCase()] = c._id;
    });

    const parsePriceRange = (val) => {
      if (typeof val === 'number') return { mrp: val, price: val };
      if (!val) return { mrp: 0, price: 0 };
      const str = String(val).trim();
      if (str.includes('-')) {
        const parts = str.split('-').map(s => parseFloat(s.replace(/[^0-9.]/g, ''))).filter(n => !isNaN(n));
        if (parts.length >= 2) {
          const lower = Math.min(...parts);
          const higher = Math.max(...parts);
          return { mrp: higher, price: lower };
        }
      }
      const num = parseFloat(str.replace(/[^0-9.]/g, '')) || 0;
      return { mrp: num, price: num };
    };

    const getTestMetadata = (name, row) => {
      const isFasting = (row['Fasting'] || '').toLowerCase().includes('yes');
      const sampleType = row['Sample Type'] || '';
      const method = row['Method'] || '';
      const normalRange = row['Normal Range'] || '-';
      const units = row['Units'] || '-';
      const tat = row['TAT'] || 'Same day';
      const rec = row['Recommended For'] || 'Routine';
      const homeColl = (row['Home Collection'] || 'Yes').toLowerCase().includes('yes');

      let fastingHours = 0;
      let precautionsBefore = [];
      let precautionsDuring = '';
      let precautionsAfter = [];
      let instructionText = homeColl ? 'Home collection available.' : 'Conducted at lab facility.';

      if (isFasting) {
        fastingHours = 8;
        precautionsBefore = [
          'Overnight fasting of 8-10 hours is required before sample collection.',
          'You may drink plain water, but avoid tea, coffee, and breakfast before test.',
          'Avoid heavy meals and alcohol 24 hours prior to the test.'
        ];
        precautionsDuring = 'Blood sample collected from vein after overnight fasting.';
        precautionsAfter = ['You may have normal food and beverages immediately after blood collection.'];
      } else if (sampleType.toLowerCase() === 'blood') {
        precautionsBefore = ['No special dietary restrictions required.', 'Stay hydrated normally before blood draw.'];
        precautionsDuring = 'A trained phlebotomist collects a small blood sample from a vein in your arm.';
        precautionsAfter = ['Apply gentle pressure on the puncture site for a few minutes.'];
      } else if (sampleType.toLowerCase() === 'urine') {
        precautionsBefore = ['Collect the first morning mid-stream urine sample.', 'Use the sterile container provided.'];
        precautionsDuring = 'Clean genital area before collecting mid-stream sample.';
        precautionsAfter = ['Cap the container tightly and submit to the lab within 1-2 hours.'];
      } else if (sampleType.toLowerCase() === 'imaging') {
        precautionsBefore = [
          'Wear comfortable, loose-fitting clothing without metal zippers or buttons.',
          'Remove jewelry, hairpins, watches, and metallic items.',
          'Inform the technician if you might be pregnant.'
        ];
        precautionsDuring = 'Follow instructions from the radiologist to remain still while imaging.';
        precautionsAfter = ['Normal activities can be resumed immediately.'];
      }

      const overview = `
        <div class="test-overview">
          <p>${row['Short Description'] || ''}</p>
          <h4>Test Details:</h4>
          <ul>
            <li><strong>Method:</strong> ${method}</li>
            <li><strong>Sample:</strong> ${sampleType}</li>
            <li><strong>Normal Range:</strong> ${normalRange} ${units !== '-' ? units : ''}</li>
            <li><strong>Turnaround Time (TAT):</strong> ${tat}</li>
            <li><strong>Recommended For:</strong> ${rec}</li>
            <li><strong>Home Collection:</strong> ${homeColl ? 'Available' : 'Lab Visit Required'}</li>
          </ul>
        </div>
      `.trim();

      const testComponents = [];
      if (normalRange && normalRange !== '-') {
        testComponents.push({
          name: row['Abbreviation'] && row['Abbreviation'] !== '-' ? row['Abbreviation'] : name,
          detail: `Normal Range: ${normalRange} ${units !== '-' ? units : ''}`.trim()
        });
      }

      return {
        fasting_required: isFasting,
        fasting_hours: fastingHours,
        precautions_before: precautionsBefore,
        precautions_during: precautionsDuring,
        precautions_after: precautionsAfter,
        instruction_text: instructionText,
        overview,
        test_components: testComponents
      };
    };

    // Clear previous tests so we insert all 323 rows cleanly
    console.log(' Resetting existing testservices collection...');
    await TestService.deleteMany({});
    console.log(' Cleared previous testservices.');

    const docsToInsert = [];

    // 1. Pathology Tests (240 rows)
    const pathSheet = xlsx.utils.sheet_to_json(wb.Sheets['Pathology Tests']);
    console.log(`\n Preparing ${pathSheet.length} Pathology tests...`);
    for (const row of pathSheet) {
      const name = (row['Test Name'] || '').trim();
      const catKey = (row['Test Category'] || 'Hematology').toLowerCase().trim();
      const category_id = categoryMap[catKey] || categoryMap['hematology'];
      const { mrp, price } = parsePriceRange(row['Price (INR)']);
      const meta = getTestMetadata(name, row);
      const testCode = row['Abbreviation'] && row['Abbreviation'] !== '-' ? row['Abbreviation'] : name.replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase();

      docsToInsert.push({
        title: name,
        test_code: testCode,
        category_id,
        mrp,
        price,
        sample_type: row['Sample Type'] || 'Blood',
        report_time: row['TAT'] || 'Same day',
        short_description: row['Short Description'] || '',
        overview: meta.overview,
        test_method: row['Method'] || '',
        purpose: [row['Purpose'] || 'General health'],
        test_components: meta.test_components,
        fasting_required: meta.fasting_required,
        fasting_hours: meta.fasting_hours,
        precautions_before: meta.precautions_before,
        precautions_during: meta.precautions_during,
        precautions_after: meta.precautions_after,
        instruction_text: meta.instruction_text,
        status: true,
        is_featured: ['Complete Blood Count', 'Liver Function Test', 'Kidney Function Test', 'HbA1c'].includes(name)
      });
    }

    // 2. Radiology Tests (80 rows)
    const radSheet = xlsx.utils.sheet_to_json(wb.Sheets['Radiology Tests']);
    console.log(` Preparing ${radSheet.length} Radiology tests...`);
    const radCatId = categoryMap['radiology'];
    for (const row of radSheet) {
      const name = (row['Test Name'] || '').trim();
      const { mrp, price } = parsePriceRange(row['Price (INR)']);
      const meta = getTestMetadata(name, row);
      const testCode = row['Abbreviation'] && row['Abbreviation'] !== '-' ? row['Abbreviation'] : name.replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase();

      docsToInsert.push({
        title: name,
        test_code: testCode,
        category_id: radCatId,
        mrp,
        price,
        sample_type: row['Sample Type'] || 'Imaging',
        report_time: row['TAT'] || 'Same day',
        short_description: row['Short Description'] || '',
        overview: meta.overview,
        test_method: row['Method'] || 'Imaging',
        purpose: [row['Purpose'] || 'Diagnostic Imaging'],
        test_components: meta.test_components,
        fasting_required: meta.fasting_required,
        fasting_hours: meta.fasting_hours,
        precautions_before: meta.precautions_before,
        precautions_during: meta.precautions_during,
        precautions_after: meta.precautions_after,
        instruction_text: meta.instruction_text,
        status: true,
        is_featured: ['X-Ray Chest', 'Ultrasound'].includes(name)
      });
    }

    // 3. Health Packages (3 rows)
    const pkgSheet = xlsx.utils.sheet_to_json(wb.Sheets['Health Packages']);
    console.log(` Preparing ${pkgSheet.length} Health Packages...`);
    const pkgCatId = categoryMap['health packages'];
    for (const row of pkgSheet) {
      const name = (row['Package Name'] || '').trim();
      const includesStr = row['Includes Tests'] || '';
      const recFor = row['Recommended For'] || 'General';
      const priceNum = parseFloat(row['Price (INR)']) || 999;
      const mrpNum = Math.round(priceNum * 1.6);

      const shortDesc = `${name} includes: ${includesStr}. Recommended for ${recFor}.`;
      const overview = `
        <div class="package-overview">
          <p>${shortDesc}</p>
          <h4>Included Tests:</h4>
          <p>${includesStr}</p>
          <h4>Recommended For:</h4>
          <p>${recFor}</p>
        </div>
      `.trim();

      docsToInsert.push({
        title: name,
        test_code: `PKG-${name.replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase()}`,
        category_id: pkgCatId,
        mrp: mrpNum,
        price: priceNum,
        sample_type: 'Blood & Urine',
        report_time: '24 Hours',
        short_description: shortDesc,
        overview,
        purpose: [recFor, 'Health Package'],
        status: true,
        is_featured: true,
        instruction_text: 'Home collection available for all included tests.',
        precautions_before: ['Overnight fasting of 8-10 hours may be required for blood sugar and organ panels.']
      });
    }

    console.log(`\n Inserting all ${docsToInsert.length} documents into live database in batch...`);
    const inserted = await TestService.insertMany(docsToInsert);
    console.log(` Successfully inserted ${inserted.length} tests into TestService!`);

    // Sync packages collection
    for (const row of pkgSheet) {
      const name = (row['Package Name'] || '').trim();
      const includesStr = row['Includes Tests'] || '';
      const priceNum = parseFloat(row['Price (INR)']) || 999;
      const mrpNum = Math.round(priceNum * 1.6);
      const shortDesc = `${name} includes: ${includesStr}.`;

      await PackageModel.findOneAndUpdate(
        { packageName: { $regex: new RegExp(`^${name}$`, 'i') } },
        {
          packageName: name,
          description: shortDesc,
          category: 'Health Packages',
          actualPrice: mrpNum,
          discountPrice: priceNum,
          status: true,
          isDeleted: false
        },
        { upsert: true, new: true }
      );
    }

    // Verify
    const finalCount = await TestService.countDocuments();
    console.log(`\n======================================================`);
    console.log(` TOTAL VERIFIED DOCUMENTS IN LIVE DATABASE: ${finalCount}`);
    console.log(`======================================================`);

    const categoryBreakdown = await TestService.aggregate([
      {
        $lookup: {
          from: 'categories',
          localField: 'category_id',
          foreignField: '_id',
          as: 'category'
        }
      },
      { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$category.name',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    console.log('Category-wise breakdown in Live Database:');
    console.table(categoryBreakdown.map(c => ({
      Category: c._id || 'Unassigned',
      TotalTests: c.count
    })));

    await mongoose.disconnect();
    console.log(' Disconnected from Live MongoDB.');

  } catch (error) {
    console.error(' Error:', error);
    process.exit(1);
  }
}

importAll323Tests();
