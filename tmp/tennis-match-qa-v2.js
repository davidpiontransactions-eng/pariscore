const { chromium } = require('/home/ubuntu/pariscore/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message.substring(0, 200)));
  
  await page.goto('https://pariscore.fr/?sport=tennis', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(4000);
  
  // Click Top 10 tab
  const top10Btn = await page.locator('button:has-text("Top 10")').first();
  await top10Btn.click();
  await page.waitForTimeout(15000);
  
  // 1. Cards
  const cards = await page.locator('[data-tennis-player]').count();
  console.log('[1] Top 10 cards:', cards);
  
  // 2. Extract match data from each card
  const playerData = await page.evaluate(() => {
    const els = document.querySelectorAll('[data-tennis-player]');
    return Array.from(els).map(el => {
      const text = el.textContent || '';
      const hasVs = text.includes('vs');
      const hasOdds = /\d+\.\d{2}/.test(text);
      const hasDate = /sept|août|oct|nov|déc|janv|févr|mars|avr|mai|juin|juil/.test(text);
      const hasTime = /\d{1,2}:\d{2}/.test(text);
      return {
        rank: el.getAttribute('data-tennis-player'),
        hasVs, hasOdds, hasDate, hasTime,
        textSnippet: text.substring(0, 150)
      };
    });
  });
  
  let withMatch = 0;
  let withOdds = 0;
  for (const p of playerData) {
    if (p.hasVs) withMatch++;
    if (p.hasOdds) withOdds++;
  }
  console.log('[2] Players with next match:', withMatch + '/' + cards);
  console.log('[3] Players with odds:', withOdds + '/' + cards);
  
  // Print first 3
  for (const p of playerData.slice(0, 3)) {
    console.log(`  #${p.rank}: vs=${p.hasVs} odds=${p.hasOdds} date=${p.hasDate} time=${p.hasTime}`);
    console.log(`    "${p.textSnippet}"`);
  }
  
  // 4. Click first card → modal
  if (cards > 0) {
    await page.locator('[data-tennis-player]').first().click();
    await page.waitForTimeout(2500);
    
    const modal = await page.locator('.fixed.inset-0.z-50').count();
    console.log('[4] Modal:', modal > 0 ? 'OPEN' : 'CLOSED');
    
    if (modal > 0) {
      const modalText = await page.locator('.fixed.inset-0.z-50').first().innerText();
      console.log('[5] Modal has "Prochain match":', modalText.includes('Prochain match'));
      console.log('[6] Modal has "vs":', modalText.includes('vs'));
      console.log('[7] Modal has odds:', /\d+\.\d{2}/.test(modalText));
      console.log('[8] Modal has date:', /\d{1,2}:\d{2}/.test(modalText));
      
      // Screenshot modal
      await page.screenshot({ path: '/tmp/tennis-modal-final.png', fullPage: false });
      
      // Close modal
      await page.locator('.fixed.inset-0.z-50 button').first().click();
      await page.waitForTimeout(500);
    }
  }
  
  // 9. Screenshot view
  await page.screenshot({ path: '/tmp/tennis-top10-final.png', fullPage: false });
  
  // 10. Page errors
  const realErrors = pageErrors.filter(e => !e.includes('404') && !e.includes('Content-Security'));
  console.log('[9] Page errors:', realErrors.length, realErrors.length === 0 ? 'PASS' : realErrors.slice(0, 3));
  
  console.log('\n=== QA COMPLETE ===');
  await browser.close();
})();
