import https from 'https';

https.get('https://pathology-backend-live.onrender.com/registrations/get?limit=1000', (resp) => {
  let data = '';

  resp.on('data', (chunk) => {
    data += chunk;
  });

  resp.on('end', () => {
    try {
      const json = JSON.parse(data);
      const labs = json.data;
      console.log(`Fetched ${labs.length} labs from live API.\n`);
      
      let offerFound = false;
      labs.forEach(lab => {
        if (lab.testPricing && lab.testPricing.length > 0) {
          lab.testPricing.forEach(pricing => {
            const dp = parseFloat(pricing.discountPercent) || 0;
            const mrp = parseFloat(pricing.price) || 0;
            const finalPrice = parseFloat(pricing.discountPrice) || 0;
            
            if (dp > 0 || (mrp > finalPrice && finalPrice > 0)) {
               offerFound = true;
               const testTitle = pricing.test ? pricing.test.title : 'Unknown Test';
               console.log(`- Lab: ${lab.name}`);
               console.log(`  Test: ${testTitle}`);
               console.log(`  MRP: ${mrp}₹ | Final: ${finalPrice}₹ | % OFF: ${dp}%`);
               console.log('--------------------------------------------------');
            }
          });
        }
        
        if (lab.selectedTests && lab.selectedTests.length > 0) {
           lab.selectedTests.forEach(test => {
              const hasPricing = lab.testPricing && lab.testPricing.some(p => p.test && p.test._id === test._id);
              if (!hasPricing) {
                  const mrp = parseFloat(test.mrp) || 0;
                  const finalPrice = parseFloat(test.price) || 0;
                  if (mrp > finalPrice && finalPrice > 0) {
                      offerFound = true;
                      console.log(`- Lab: ${lab.name}`);
                      console.log(`  Test: ${test.title} (from selectedTests)`);
                      console.log(`  MRP: ${mrp}₹ | Final: ${finalPrice}₹`);
                      console.log('--------------------------------------------------');
                  }
              }
           });
        }
      });
      
      if (!offerFound) {
         console.log("No tests with offers found on the live API.");
      }
    } catch (e) {
      console.log("Error parsing JSON:", e.message);
    }
  });

}).on("error", (err) => {
  console.log("Error: " + err.message);
});
