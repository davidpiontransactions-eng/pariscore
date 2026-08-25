/* Sonde debug Insights v2 — isole l'exception du moteur ins2 */
const { chromium } = require('@playwright/test');
(async () => {
  const base = process.argv[2] || 'http://localhost:3210';
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1366, height: 850 } });
  const logs = [];
  page.on('pageerror', e => logs.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type().toUpperCase() + ': ' + m.text().slice(0, 300)); });
  await page.goto(base + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => typeof openInsights === 'function', null, { timeout: 60000 });
  await page.evaluate(() => { try { if (typeof loadMatches === 'function' && (!Array.isArray(allMatches) || allMatches.length === 0)) loadMatches(); } catch (_) {} });
  await page.waitForFunction(() => {
    try { return Array.isArray(allMatches) && allMatches.length > 0; } catch (_) { return false; }
  }, null, { timeout: 90000 });
  const r = await page.evaluate(async () => {
    const out = {};
    out.hasFn = {
      preRender: typeof ins2PreRender,
      zone: typeof insShowZone,
      verdict: typeof ins2RenderVerdict,
      compute: typeof ins2ComputeVerdict,
      barsRow: typeof _ins2BarsRow
    };
    const m = allMatches.find(x => x && !x._isLive) || allMatches[0];
    out.matchId = m && m.id;
    out.poissonKeys = m && m.poisson ? Object.keys(m.poisson).slice(0, 8) : null;
    out.fair = m && m.fair || null;
    try { ins2PreRender(m); out.preRender = 'OK'; } catch (e) { out.preRender = 'THROW: ' + e.message; }
    try { insShowZone('analyse'); out.showZone = 'OK'; } catch (e) { out.showZone = 'THROW: ' + e.message; }
    try {
      const p = openInsights(m.id);
      if (p && p.catch) p.catch(e => { window.__insErr = String(e && e.message || e); });
      out.openInsights = 'launched';
    } catch (e) { out.openInsights = 'SYNC THROW: ' + e.message; }
    await new Promise(r2 => setTimeout(r2, 6000));
    out.insErr = window.__insErr || null;
    out.dom = {
      modalOpen: document.getElementById('insights-modal').classList.contains('open'),
      zones: document.querySelectorAll('#ins2-zonebar .ins2-zone').length,
      barsHtmlLen: (document.getElementById('ins2-bars') || {}).innerHTML?.length || 0,
      barsHasBarline: !!document.querySelector('#ins2-bars .ins2-barline'),
      teams: (document.getElementById('ins-teams') || {}).textContent
    };
    return out;
  });
  console.log(JSON.stringify({ r, logs: logs.slice(0, 15) }, null, 2));
  await browser.close();
})();
