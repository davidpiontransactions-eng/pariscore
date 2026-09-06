const { chromium } = require('/home/ubuntu/pariscore/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  
  const errors = [];
  page.on('pageerror', err => errors.push(err.message.substring(0, 200)));
  
  console.log('=== Rankings Tab Verification ===');
  
  // 1. Go to football tab
  await page.goto('https://pariscore.fr/?sport=football', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  
  // 2. Click on "Classements" tab
  const classementsTab = page.locator('[role="tab"]:has-text("Classements")');
  const tabCount = await classementsTab.count();
  console.log('[1] Classements tab found:', tabCount > 0 ? 'YES' : 'NO');
  
  if (tabCount > 0) {
    await classementsTab.first().click();
    await page.waitForTimeout(5000);
    
    // 3. Check for team names (should show standings table)
    const teamNames = await page.locator('text=PSG').count();
    const monaco = await page.locator('text=Monaco').count();
    const marseille = await page.locator('text=Marseille').count();
    console.log('[2] PSG visible:', teamNames > 0 ? 'YES' : 'NO');
    console.log('[3] Monaco visible:', monaco > 0 ? 'YES' : 'NO');
    console.log('[4] Marseille visible:', marseille > 0 ? 'YES' : 'NO');
    
    // 4. Check for standings table headers
    const ptsHeader = await page.locator('th:has-text("Pts")').count();
    const ppgHeader = await page.locator('th:has-text("PPG")').count();
    console.log('[5] Pts column:', ptsHeader > 0 ? 'YES' : 'NO');
    console.log('[6] PPG column:', ppgHeader > 0 ? 'YES' : 'NO');
    
    // 5. Check for league summary
    const teamsCount = await page.locator('text=18 équipes').count();
    console.log('[7] League summary (18 équipes):', teamsCount > 0 ? 'YES' : 'NO');
    
    // 6. Check for error boundary
    const errorBoundary = await page.locator('text=Erreur temporaire').count();
    console.log('[8] Error boundary:', errorBoundary === 0 ? 'PASS (not triggered)' : 'FAIL');
    
    // 7. Screenshot
    await page.screenshot({ path: '/tmp/rankings-verify.png', fullPage: false });
    console.log('[9] Screenshot saved');
  }
  
  // 8. Page errors
  console.log('[10] Page errors:', errors.length, errors.length === 0 ? 'PASS' : 'WARN');
  if (errors.length > 0) console.log('  Errors:', JSON.stringify(errors.slice(0, 3)));
  
  console.log('\n=== DONE ===');
  await browser.close();
})();
