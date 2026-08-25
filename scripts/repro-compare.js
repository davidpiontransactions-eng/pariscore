/** Compare le nb de cartes rendues par sous-onglet (live vs prematch) + avec/sans sélection. */
const BASE = process.argv[2] || "http://localhost:3000";
let chromium;
try { ({ chromium } = require("playwright")); }
catch { ({ chromium } = require("@playwright/test")); }

async function open(browser, url) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForFunction(() => !!window.__ssStore, null, { timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(7_000);
  return page;
}

(async () => {
  const browser = await chromium.launch();

  // A) vue live SANS sélection
  let p = await open(browser, `${BASE}/?sport=tennis&view=live`);
  console.log("A) live, sans sélection   → cartes:", await p.locator("main article").count());
  await p.close();

  // B) vue live AVEC sélection du 1er live
  p = await open(browser, `${BASE}/?sport=tennis&view=live`);
  const target = await p.evaluate(async () => {
    const r = await fetch("/api/tennis/live");
    const j = await r.json();
    const m = (j.matches || []).find((x) => x.isLive && x.playerA?.name);
    return m ? { id: String(m.id), name: m.playerA.name } : null;
  });
  console.log("B) cible:", JSON.stringify(target));
  if (target) {
    await p.evaluate((id) => window.__ssStore.setState({ selectedMatchIds: [id] }), target.id);
    await p.waitForTimeout(3_000);
    console.log("B) live, avec sélection   → cartes:", await p.locator("main article").count());
    const st = await p.evaluate(() => window.__ssStore.getState().selectedMatchIds);
    console.log("B) store sel:", JSON.stringify(st));
  }
  await p.close();

  // C) vue prematch AVEC sélection d'un PREMATCH
  p = await open(browser, `${BASE}/?sport=tennis&view=prematch`);
  const pre = await p.evaluate(async () => {
    const r = await fetch("/api/tennis/prematch");
    const j = await r.json();
    const m = (j.matches || []).find((x) => x.playerA?.name);
    return m ? { id: String(m.id), name: m.playerA.name } : null;
  });
  console.log("C) cible prematch:", JSON.stringify(pre));
  if (pre) {
    await p.evaluate((id) => window.__ssStore.setState({ selectedMatchIds: [id] }), pre.id);
    await p.waitForTimeout(3_000);
    console.log("C) prematch, avec sélect. → cartes:", await p.locator("main article").count());
  }
  await browser.close();
})().catch((e) => { console.error("FAIL:", e); process.exit(1); });
