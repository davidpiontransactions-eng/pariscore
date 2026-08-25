/* QA rendu sparkline Insights v2 — mock de /api/v1/odds-history avec série synthétique */
const { chromium } = require('@playwright/test');
(async () => {
  const base = process.argv[2] || 'http://localhost:3210';
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1366, height: 850 } });
  await page.route('**/api/v1/odds-history/*', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      success: true, matchId: 'mock', count: 4, dir: 'shortening',
      first: { ts: 1, home: 2.10 }, last: { ts: 4, home: 1.85 },
      points: [
        { ts: 1, home: 2.10, draw: 3.40, away: 3.60 },
        { ts: 2, home: 2.02, draw: 3.35, away: 3.55 },
        { ts: 3, home: 1.94, draw: 3.30, away: 3.70 },
        { ts: 4, home: 1.85, draw: 3.28, away: 3.80 }
      ]
    })
  }));
  await page.goto(base + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => typeof openInsights === 'function' && typeof ins2LoadSpark === 'function', null, { timeout: 60000 });
  const res = await page.evaluate(async () => {
    const m = { id: 'mock-1', home_team: 'Team A', away_team: 'Team B', commence_time: new Date(Date.now() + 3600e3).toISOString() };
    await ins2LoadSpark(m);
    const w = document.getElementById('ins2-spark');
    return {
      visible: w && w.style.display !== 'none',
      hasSvg: !!w.querySelector('svg'),
      label: (w.querySelector('.ins2-spark-label') || {}).textContent || '',
      color: (w.querySelector('path') || {}).getAttribute && w.querySelector('path').getAttribute('stroke')
    };
  });
  console.log(JSON.stringify(res, null, 2));
  await browser.close();
})();
