const { chromium } = require('/home/ubuntu/pariscore/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  
  await page.goto('https://pariscore.fr/?sport=football', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  
  // Click Classements
  await page.locator('[role="tab"]:has-text("Classements")').first().click();
  await page.waitForTimeout(5000);
  
  // Dump DOM content around rankings
  const body = await page.locator('main').innerHTML();
  // Get first 3000 chars
  console.log('=== DOM (first 3000 chars) ===');
  console.log(body.substring(0, 3000));
  console.log('\n=== DOM (next 3000 chars) ===');
  console.log(body.substring(3000, 6000));
  
  // Check for spinner
  const spinner = await page.locator('[class*="animate-spin"]').count();
  console.log('\n=== Spinners:', spinner);
  
  // Check for any text in main
  const mainText = await page.locator('main').innerText();
  console.log('\n=== Inner text (first 1000) ===');
  console.log(mainText.substring(0, 1000));
  
  await browser.close();
})();
