const { chromium } = require('/home/ubuntu/pariscore/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  
  const errors = [];
  page.on('pageerror', err => errors.push(err.message.substring(0, 200)));
  
  console.log('=== Tennis Bug Fix Verification ===');
  
  // 1. Default "today" view
  await page.goto('https://pariscore.fr/?sport=tennis', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(5000);
  const todayCards = await page.locator('article').count();
  console.log('[1] Today view cards:', todayCards, todayCards > 0 ? 'PASS' : 'FAIL');
  
  // 2. Switch to Live
  await page.locator('[role="tab"]:has-text("Live")').last().click();
  await page.waitForTimeout(3000);
  const liveCards = await page.locator('article').count();
  console.log('[2] Live view cards:', liveCards, liveCards > 0 ? 'PASS' : 'FAIL');
  
  // 3. Switch back to Today
  await page.locator('[role="tab"]:has-text("Aujourd")').last().click();
  await page.waitForTimeout(3000);
  const backToToday = await page.locator('article').count();
  console.log('[3] Back to today:', backToToday, backToToday > 0 ? 'PASS' : 'FAIL');
  
  // 4. Check Notifications error is gone
  const notifErrors = errors.filter(e => e.includes('Notifications'));
  console.log('[4] Notifications errors:', notifErrors.length, notifErrors.length === 0 ? 'PASS' : 'FAIL');
  
  // 5. Check footer.responsible error is gone
  const footerErrors = errors.filter(e => e.includes('footer.responsible'));
  console.log('[5] footer.responsible errors:', footerErrors.length, footerErrors.length === 0 ? 'PASS' : 'FAIL');
  
  // 6. Error boundary NOT triggered
  const errorBoundary = await page.locator('text=Erreur temporaire').count();
  console.log('[6] Error boundary:', errorBoundary, errorBoundary === 0 ? 'PASS' : 'FAIL');
  
  // 7. Screenshot
  await page.screenshot({ path: '/tmp/tennis-verify.png', fullPage: false });
  
  // 8. Any page errors
  console.log('[7] Page errors:', errors.length, errors.length === 0 ? 'PASS' : 'WARN');
  if (errors.length > 0) console.log('  Errors:', JSON.stringify(errors.slice(0, 5)));
  
  console.log('\n=== DONE ===');
  await browser.close();
})();
