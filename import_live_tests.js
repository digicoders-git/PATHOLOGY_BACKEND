import mongoose from 'mongoose';
import xlsx from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LIVE_URI = 'mongodb+srv://digicodersdevelopment_db_user:jb4LPBjkqCzzYvdY@cluster0.5bhvhge.mongodb.net/pathologyLive?appName=Cluster0';
const EXCEL_PATH = path.resolve(__dirname, '../Medical_Tests_With_Description.xlsx');

// ── Models ───────────────────────────────────────────────────────────────────
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

async function importTests() {
  try {
    console.log(' Connecting to Live MongoDB (pathologyLive)...');
    await mongoose.connect(LIVE_URI);
    console.log(' Connected to Live MongoDB successfully!\n');

    // 1. Read Excel file
    console.log(` Reading Excel file from: ${EXCEL_PATH}`);
    const wb = xlsx.readFile(EXCEL_PATH);
    console.log(` Sheets found: ${wb.SheetNames.join(', ')}\n`);

    // 2. Ensure Categories exist in DB
    console.log(' Verifying and ensuring categories exist in live DB...');
    const requiredCategories = [
      { name: 'Hematology', description: 'Blood cell counts and hematologic disease testing' },
      { name: 'Biochemistry', description: 'Chemical and metabolic testing, organ functions' },
      { name: 'Diabetes', description: 'Blood sugar and diabetes management' },
      { name: 'Hormone', description: 'Endocrine and hormone profile testing' },
      { name: 'Serology', description: 'Antibody and antigen viral screening' },
      { name: 'Microbiology', description: 'Infectious diseases and bacterial/viral diagnostics' },
      { name: 'Urine', description: 'Urinalysis and renal/metabolic screening' },
      { name: 'Radiology', description: 'Imaging services including X-Ray, CT Scan, MRI, Ultrasound' },
      { name: 'Health Packages', description: 'Comprehensive multi-test health checkup packages' }
    ];

    const categoryMap = {}; // name (lowercase) -> ObjectId
    for (const catDef of requiredCategories) {
      let cat = await Category.findOne({ name: { $regex: new RegExp(`^${catDef.name.trim()}$`, 'i') } });
      if (!cat) {
        cat = await Category.create({
          name: catDef.name,
          description: catDef.description,
          status: true
        });
        console.log(`   Created new category: "${cat.name}" (ID: ${cat._id})`);
      } else {
        console.log(`   Found existing category: "${cat.name}" (ID: ${cat._id})`);
      }
      categoryMap[catDef.name.toLowerCase()] = cat._id;
    }

    // Also support trailing space category in live DB: "Endocrinology "
    const existingEndo = await Category.findOne({ name: /Endocrinology/i });
    if (existingEndo) {
      categoryMap['endocrinology'] = existingEndo._id;
    }

    // 3. Extract Unique Tests from Pathology Tests Sheet
    console.log('\n Processing Pathology Tests sheet...');
    const pathSheet = xlsx.utils.sheet_to_json(wb.Sheets['Pathology Tests']);
    const uniquePathologyMap = new Map();
    for (const row of pathSheet) {
      const name = (row['Test Name'] || '').trim();
      if (name && !uniquePathologyMap.has(name)) {
        uniquePathologyMap.set(name, row);
      }
    }
    console.log(`   Found ${pathSheet.length} total rows -> ${uniquePathologyMap.size} unique pathology tests.`);

    // 4. Extract Unique Tests from Radiology Tests Sheet
    console.log('\n Processing Radiology Tests sheet...');
    const radSheet = xlsx.utils.sheet_to_json(wb.Sheets['Radiology Tests']);
    const uniqueRadiologyMap = new Map();
    for (const row of radSheet) {
      const name = (row['Test Name'] || '').trim();
      if (name && !uniqueRadiologyMap.has(name)) {
        uniqueRadiologyMap.set(name, row);
      }
    }
    console.log(`   Found ${radSheet.length} total rows -> ${uniqueRadiologyMap.size} unique radiology tests.`);

    // 5. Extract Packages from Health Packages Sheet
    console.log('\n Processing Health Packages sheet...');
    const pkgSheet = xlsx.utils.sheet_to_json(wb.Sheets['Health Packages']);
    console.log(`   Found ${pkgSheet.length} health packages.`);

    // Helper: Parse price range like "200-500"
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

    // Helper: Precaution and instructions metadata
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

      // Rich HTML overview
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

    const savedTestsMap = new Map(); // test name -> doc._id

    // 6. Import Pathology Tests
    console.log('\n Importing unique Pathology Tests into TestService...');
    for (const [name, row] of uniquePathologyMap.entries()) {
      const catKey = (row['Test Category'] || 'Hematology').toLowerCase().trim();
      const category_id = categoryMap[catKey] || categoryMap['hematology'];
      const { mrp, price } = parsePriceRange(row['Price (INR)']);
      const meta = getTestMetadata(name, row);
      const testCode = row['Abbreviation'] && row['Abbreviation'] !== '-' ? row['Abbreviation'] : name.replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase();

      const testData = {
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
      };

      const doc = await TestService.findOneAndUpdate(
        { title: name },
        testData,
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      savedTestsMap.set(name, doc._id);
      console.log(`   Imported Pathology Test: "${doc.title}" [₹${doc.price} / MRP ₹${doc.mrp}] (ID: ${doc._id})`);
    }

    // 7. Import Radiology Tests
    console.log('\n Importing unique Radiology Tests into TestService...');
    for (const [name, row] of uniqueRadiologyMap.entries()) {
      const category_id = categoryMap['radiology'];
      const { mrp, price } = parsePriceRange(row['Price (INR)']);
      const meta = getTestMetadata(name, row);
      const testCode = row['Abbreviation'] && row['Abbreviation'] !== '-' ? row['Abbreviation'] : name.replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase();

      const testData = {
        title: name,
        test_code: testCode,
        category_id,
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
      };

      const doc = await TestService.findOneAndUpdate(
        { title: name },
        testData,
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      savedTestsMap.set(name, doc._id);
      console.log(`   Imported Radiology Test: "${doc.title}" [₹${doc.price} / MRP ₹${doc.mrp}] (ID: ${doc._id})`);
    }

    // 8. Import Health Packages
    console.log('\n Importing Health Packages into TestService and Packages collection...');
    const packageCategory_id = categoryMap['health packages'];

    for (const row of pkgSheet) {
      const name = (row['Package Name'] || '').trim();
      const includesStr = row['Includes Tests'] || '';
      const recFor = row['Recommended For'] || 'General';
      const priceNum = parseFloat(row['Price (INR)']) || 999;
      const mrpNum = Math.round(priceNum * 1.6); // Reasonable standard MRP discount representation

      // Find linked test IDs based on abbreviation or name
      const includedTokens = includesStr.split(',').map(s => s.trim().toLowerCase());
      const linkedTestIds = [];
      for (const [tName, tId] of savedTestsMap.entries()) {
        const lowerName = tName.toLowerCase();
        if (
          includedTokens.some(tok => lowerName.includes(tok) || (tok === 'cbc' && lowerName.includes('blood count')) || (tok === 'lft' && lowerName.includes('liver')) || (tok === 'kft' && lowerName.includes('kidney')) || (tok === 'fasting sugar' && lowerName.includes('diabetes')))
        ) {
          linkedTestIds.push(tId);
        }
      }

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

      // Upsert into TestService (so it appears everywhere in test catalog and bookings)
      const serviceDoc = await TestService.findOneAndUpdate(
        { title: name },
        {
          title: name,
          test_code: `PKG-${name.replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase()}`,
          category_id: packageCategory_id,
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
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      console.log(`   Imported Package to TestService: "${serviceDoc.title}" [₹${serviceDoc.price}] (ID: ${serviceDoc._id})`);

      // Upsert into 'packages' collection
      await PackageModel.findOneAndUpdate(
        { packageName: { $regex: new RegExp(`^${name}$`, 'i') } },
        {
          packageName: name,
          description: shortDesc,
          category: 'Health Packages',
          tests: linkedTestIds,
          actualPrice: mrpNum,
          discountPrice: priceNum,
          status: true,
          isDeleted: false
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      console.log(`   Synced Package to 'packages' collection: "${name}" (${linkedTestIds.length} linked tests)`);
    }

    // 9. Final Verification
    console.log('\n======================================================');
    console.log(' VERIFYING IMPORT RESULTS ON LIVE DATABASE');
    console.log('======================================================');

    const totalTests = await TestService.countDocuments();
    const allTests = await TestService.find({}).populate('category_id', 'name').select('title test_code price mrp category_id is_featured sample_type');
    console.log(` Total TestService documents in live database: ${totalTests}`);
    console.table(allTests.map(t => ({
      Title: t.title,
      Code: t.test_code,
      Category: t.category_id?.name || 'N/A',
      Price: `₹${t.price}`,
      MRP: `₹${t.mrp}`,
      Featured: t.is_featured ? 'Yes' : 'No',
      Sample: t.sample_type
    })));

    const totalPackages = await PackageModel.countDocuments();
    console.log(`\n Total Package documents in live database: ${totalPackages}`);

    console.log('\n ALL TESTS AND PACKAGES SUCCESSFULLY IMPORTED TO LIVE DATABASE!');
    await mongoose.disconnect();
    console.log(' Disconnected from Live MongoDB.');

  } catch (error) {
    console.error(' Critical Error during import:', error);
    process.exit(1);
  }
}

importTests();
