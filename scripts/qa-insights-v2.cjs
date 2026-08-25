/* QA Insights v2 « Brief Match » — ouvre un match prematch et capture le modal v2.
 * Usage : node scripts/qa-insights-v2.cjs [baseUrl]
 * Sortie : .context/qa-insights-v2-{desktop,mobile}.png + résumé JSON stdout.
 */
const path = require('path');
const fs = require('fs');
const { chromium } = require('@playwright/test');

(async () => {
  const base = process.argv[2] || 'http://localhost:3210';
  const outDir = path.join(__dirname, '..', '.context');
  fs.mkdirSync(outDir, { recursive: true });
  const results = { base, steps: [], errors: [] };

  const browser = await chromium.launch();
  try {
    for (const mode of ['desktop', 'mobile']) {
      const ctxOpts = mode === 'desktop'
        ? { viewport: { width: 1366, height: 850 } }
        : { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };
      const ctx = await browser.newContext(ctxOpts);
      const page = await ctx.newPage();
      page.on('pageerror', e => results.errors.push(`[${mode}] pageerror: ${e.message}`));
      page.on('console', msg => { if (msg.type() === 'error') results.errors.push(`[${mode}] console: ${msg.text().slice(0, 200)}`); });

      await page.goto(base + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
      // Attendre le chargement des matchs côté client (global allMatches alimenté par /api/v1/matches)
      await page.waitForFunction(() => typeof openInsights === 'function', null, { timeout: 60000 });
      await page.evaluate(() => { try { if (typeof loadMatches === 'function' && (!Array.isArray(allMatches) || allMatches.length === 0)) loadMatches(); } catch (_) {} });
      await page.waitForFunction(() => {
        try { return Array.isArray(allMatches) && allMatches.length > 0; } catch (_) { return false; }
      }, null, { timeout: 90000 });
      const mid = await page.evaluate(() => {
        const pick = allMatches.find(x => x && !x._isLive && x.odds && x.odds.home != null)
          || allMatches.find(x => x && !x._isLive)
          || allMatches[0];
        return pick ? pick.id : null;
      });
      results.steps.push(`${mode}: carte prematch trouvée, matchId=${mid}`);
      if (!mid) throw new Error('matchId introuvable sur la première carte');

      await page.evaluate(id => openInsights(id), mid);
      await page.waitForSelector('#insights-modal.open', { timeout: 20000 });
      // Verdict rendu (barres ou note d'indisponibilité) et zone Analyse active
      await page.waitForFunction(() => {
        const b = document.getElementById('ins2-bars');
        const z = document.getElementById('ins2-zonebar');
        return b && z && z.children.length >= 5 &&
          (b.querySelector('.ins2-barline') || b.querySelector('.ins2-empty-mini'));
      }, { timeout: 25000 });
      // Enrichissement post-fetch : laisser au plus 10 s (facts/story/formline)
      await page.waitForTimeout(10000);
      const state = await page.evaluate(() => ({
        teams: (document.getElementById('ins-teams') || {}).textContent || '',
        zones: document.querySelectorAll('#ins2-zonebar .ins2-zone').length,
        subtabs: document.querySelectorAll('#ins2-subtabs .ins-tab').length,
        bars: !!document.querySelector('#ins2-bars .ins2-barline'),
        edge: !!document.querySelector('#ins2-edgerow.has'),
        conf: ((document.getElementById('ins2-conf') || {}).textContent || '').trim(),
        facts: document.querySelectorAll('#ins2-facts .ins2-fact').length,
        story: !!document.getElementById('ins2-story')?.innerHTML.trim(),
        formdots: document.querySelectorAll('#ins2-formline .ins2-fdot').length,
        chips: document.querySelectorAll('#ins2-chips .ins2-chip').length,
        spark: document.getElementById('ins2-spark')?.style.display !== 'none',
        countdown: ((document.getElementById('ins2-countdown') || {}).textContent || '').trim()
      }));
      results[mode] = state;

      const panel = page.locator('#insights-panel');
      await panel.screenshot({ path: path.join(outDir, `qa-insights-v2-${mode}.png`) });
      results.steps.push(`${mode}: capture → qa-insights-v2-${mode}.png`);
      await ctx.close();
    }
    results.ok = true;
  } catch (e) {
    results.ok = false;
    results.fatal = e.message;
  } finally {
    await browser.close();
  }
  console.log(JSON.stringify(results, null, 2));
})();
