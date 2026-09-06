const { chromium } = require('/home/ubuntu/pariscore/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', err => errors.push(err.message.substring(0, 200)));
  
  await page.goto('https://pariscore.fr/?sport=tennis', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(4000);
  
  // Click Top 10
  await page.locator('button:has-text("Top 10")').first().click();
  await page.waitForTimeout(15000);
  
  // 1. Table rows
  const rows = await page.locator('[class*="grid"][class*="grid-cols"]').count();
  console.log('[1] Table rows (grid elements):', rows);
  
  // 2. Player names in table
  const names = await page.locator('[class*="truncate"][class*="font-semibold"]').allInnerTexts();
  console.log('[2] Players:', names.length, names.slice(0, 5));
  
  // 3. Elo values
  const eloVals = await page.locator('[class*="font-mono"][class*="text-zinc-300"]').allInnerTexts();
  console.log('[3] Elo values:', eloVals.slice(0, 5));
  
  // 4. Score values (look for 2-digit numbers)
  const scores = await page.locator('[class*="font-bold"][class*="font-mono"]').allInnerTexts();
  console.log('[4] Scores:', scores.slice(0, 5));
  
  // 5. Win prob values
  const winProbs = await page.locator('[class*="text-right"][class*="font-semibold"]').allInnerTexts();
  console.log('[5] Win probs:', winProbs.slice(0, 5));
  
  // 6. Best player (green highlight)
  const bestRow = await page.locator('.bg-emerald-500\\/\\[0\\.04\\]').count();
  console.log('[6] Green highlighted rows:', bestRow);
  
  // 7. Click first row → modal
  const firstRow = await page.locator('[class*="cursor-pointer"][class*="grid-cols"]').first();
  if (await firstRow.count() > 0) {
    await firstRow.click();
    await page.waitForTimeout(2000);
    
    const modal = await page.locator('.fixed.inset-0.z-50').count();
    console.log('[7] Modal:', modal > 0 ? 'OPEN' : 'CLOSED');
    
    if (modal > 0) {
      const modalText = await page.locator('.fixed.inset-0.z-50').first().innerText();
      console.log('[8] Modal has score:', modalText.includes('Score'));
      console.log('[9] Modal has vs:', modalText.includes('vs'));
      console.log('[10] Modal has PROCHAIN MATCH:', modalText.includes('PROCHAIN MATCH'));
      
      await page.screenshot({ path: '/tmp/tennis-table-modal.png', fullPage: false });
      await page.locator('.fixed.inset-0.z-50 button').first().click();
      await page.waitForTimeout(500);
    }
  }
  
  // 11. Screenshot
  await page.screenshot({ path: '/tmp/tennis-table-final.png', fullPage: false });
  
  // 12. Page errors
  const realErrors = errors.filter(e => !e.includes('404') && !e.includes('Content-Security'));
  console.log('[11] Page errors:', realErrors.length, realErrors.length === 0 ? 'PASS' : realErrors.slice(0, 3));
  
  console.log('\n=== QA COMPLETE ===');
  await browser.close();
})();
