// scripts/qa-visual-audit.js - Visual QA against LIVE production (pariscore.fr)
// Usage: node scripts/qa-visual-audit.js [baseUrl] [outDir]
// ASCII-only. Uses @playwright/test bundled chromium.

const path = require('path');
const fs = require('fs');

const BASE = process.argv[2] || 'https://pariscore.fr';
const OUT = process.argv[3] || path.join(__dirname, '..', '.context', 'visual-audit-' + new Date().toISOString().slice(0, 10));
const BUST = '?v=audit-' + Date.now();

let results = [];
const report = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log((ok ? 'PASS' : 'FAIL') + ' | ' + name + (detail ? ' | ' + detail : ''));
};

(async () => {
  const { chromium } = require('@playwright/test');
  fs.mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) errors.push('console: ' + m.text()); });

  // --- Load home (cache-busted to bypass SW) ---
  try {
    await page.goto(BASE + BUST, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(3500);
  } catch (e) {
    report('home-load', false, e.message.slice(0, 120));
    await browser.close();
    return;
  }
  report('home-load', true, 'title=' + (await page.title()));

  // --- 1. CSS tokens resolved ---
  const tokens = await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    const pick = (n) => cs.getPropertyValue(n).trim();
    const bodyBg = getComputedStyle(document.body).backgroundColor;
    return {
      accent: pick('--accent'), accentForeground: pick('--accent-foreground'),
      background: pick('--background'), bgDeep: pick('--bg-deep'),
      bodyBg, motionFast: pick('--motion-fast'), motionMed: pick('--motion-med'),
      easeStandard: pick('--ease-standard'),
      sportAmbient: document.querySelectorAll('.sport-ambient, [class*="sport-ambient"]').length,
      archivo: pick('--font-sans') || pick('--font-display'),
      archivoVar: pick('--font-archivo'),
      bodyFont: getComputedStyle(document.body).fontFamily,
    };
  });
  const accentOk = /#00e676|#00e6|rgb\(0, ?230, ?118\)|oklch|lab\(\s*7[0-9](\.\d+)?%\s*-\d/i.test(tokens.accent) && !/lab\(\s*\d{1,2}(\.\d+)?%\s*0\s*0\)/.test(tokens.accent);
  report('token-accent', accentOk, '--accent=' + tokens.accent);
  report('token-bg-deep', tokens.bgDeep.toLowerCase() === '#0a0e17' || tokens.bodyBg.toLowerCase() === '#0a0e17', '--bg-deep=' + tokens.bgDeep + ' body=' + tokens.bodyBg);
  report('token-motion', tokens.motionFast !== '' || tokens.motionMed !== '', '--motion-fast=' + tokens.motionFast + ' --motion-med=' + tokens.motionMed);
  report('ambient-sections', tokens.sportAmbient > 0, tokens.sportAmbient + ' .sport-ambient elements');
  const bodyFontUsed = await page.evaluate(() => {
    const fonts = new Set();
    document.querySelectorAll('body *').forEach(el => {
      const f = getComputedStyle(el).fontFamily;
      if (/geist|archivo/i.test(f)) fonts.add(/archivo/i.test(f) ? 'archivo' : 'geist');
    });
    return { hasGeist: fonts.has('geist'), hasArchivo: fonts.has('archivo'), all: [...fonts] };
  });
  report('font-sans', bodyFontUsed.hasGeist || bodyFontUsed.hasArchivo, 'DOM fonts=' + bodyFontUsed.all.join(','));

  // --- 2. Keyframes in loaded CSS (fetch globals) ---
  const cssChecks = await page.evaluate(async () => {
    const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map(l => l.href);
    let css = '';
    for (const href of links) {
      try { const r = await fetch(href); css += await r.text(); } catch (e) {}
    }
    const has = (k) => css.includes(k);
    return { links: links.length, pulseSoft: has('pulse-soft'), aurora: has('aurora'), glowPulse: has('glow-pulse'), motionTokens: has('--motion-fast'), scrollbarThin: has('scrollbar-thin') };
  });
  report('css-keyframes-pulse-soft', cssChecks.pulseSoft, cssChecks.links + ' css files');
  report('css-keyframes-aurora', cssChecks.aurora, '');
  report('css-motion-tokens', cssChecks.motionTokens, '');

  // --- 3. Min font size on home (11px policy) ---
  const fontStats = await page.evaluate(() => {
    const s = new Set();
    document.querySelectorAll('*').forEach(el => {
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (fs > 0) s.add(fs);
    });
    const sizes = Array.from(s).sort((a, b) => a - b);
    const sub11 = sizes.filter(x => x < 11);
    const sub10 = sizes.filter(x => x < 10);
    return { min: sizes[0], sizes: sizes.slice(0, 8), sub11: sub11.length, sub10: sub10.length };
  });
  report('font-min-11px', fontStats.min >= 11, 'min=' + fontStats.min + 'px sub11=' + fontStats.sub11 + ' sub10=' + fontStats.sub10);

  // --- 4. Horizontal overflow desktop ---
  const overD = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  report('overflow-desktop', overD.sw <= overD.iw, 'scrollWidth=' + overD.sw + ' innerWidth=' + overD.iw);

  // --- 5. Hero: emoji vs lucide icons ---
  const hero = await page.evaluate(() => {
    const h = document.querySelector('main h1, [class*="hero"] h1, header + main h1');
    const svgs = document.querySelectorAll('main svg.lucide, main svg[class*="lucide"]').length;
    const emojis = (document.querySelector('main')?.innerHTML.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu) || []).length;
    return { svgs, emojis, h1: h ? h.textContent.trim().slice(0, 60) : null };
  });
  report('hero-lucide-icons', hero.svgs >= 3, 'lucide svg=' + hero.svgs + ' emojis=' + hero.emojis);

  // --- 6. Screenshot desktop home ---
  await page.screenshot({ path: path.join(OUT, 'home-desktop.png'), fullPage: false });
  report('shot-home-desktop', true, '');

  // --- 7. Football page (tabs) ---
  try {
    await page.goto(BASE + '/football' + BUST, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(OUT, 'football-desktop.png'), fullPage: false });
    const liveCards = await page.locator('text=/live/i').count();
    report('football-page', true, 'live-text-elements=' + liveCards);
  } catch (e) {
    report('football-page', false, e.message.slice(0, 100));
  }

  // --- 8. Mobile 375px ---
  const mctx = await browser.newContext({ viewport: { width: 375, height: 812 }, locale: 'fr-FR', isMobile: true, hasTouch: true });
  const mp = await mctx.newPage();
  mp.on('pageerror', (e) => errors.push('mobile pageerror: ' + e.message));
  try {
    await mp.goto(BASE + BUST, { waitUntil: "domcontentloaded", timeout: 60000 });
    const overM = await mp.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
    report('overflow-mobile-375', overM.sw <= overM.iw, 'scrollWidth=' + overM.sw + ' innerWidth=' + overM.iw);
    await mp.screenshot({ path: path.join(OUT, 'home-mobile.png'), fullPage: false });
    report('shot-home-mobile', true, '');
    const bn = await mp.locator('nav').count();
    report('mobile-nav', bn >= 1, 'navs=' + bn);
  } catch (e) {
    report('mobile-375', false, e.message.slice(0, 100));
  }
  await mctx.close();

  // --- 9. SW cache version ---
  try {
    const sw = await page.evaluate(async () => {
      const r = await fetch('/sw.js', { cache: 'no-store' });
      const t = await r.text();
      const m = t.match(/CACHE_VERSION\s*=\s*["']([^"']+)["']/);
      return m ? m[1] : 'not-found';
    });
    report('sw-cache-version', /v6/.test(sw), 'CACHE_VERSION=' + sw);
  } catch (e) {
    report('sw-cache-version', false, e.message.slice(0, 80));
  }

  // --- 10. JS errors ---
  const uniqueErrors = Array.from(new Set(errors)).slice(0, 6);
  report('no-js-errors', uniqueErrors.length === 0, uniqueErrors.join(' || ') || 'clean');

  await browser.close();

  // --- Summary ---
  const pass = results.filter(r => r.ok).length;
  console.log('\n=== SUMMARY: ' + pass + '/' + results.length + ' PASS ===');
  console.log('Screenshots in: ' + OUT);
  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify({ base: BASE, date: new Date().toISOString(), results, screenshots: ['home-desktop.png', 'football-desktop.png', 'home-mobile.png'] }, null, 2));
  process.exit(pass === results.length ? 0 : 1);
})().catch(e => { console.error('FATAL', e); process.exit(1); });