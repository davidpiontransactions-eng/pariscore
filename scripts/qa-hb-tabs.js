/**
 * Micro-sonde : état réel du carrousel d'onglets du pop-up handball.
 * Mesure scrollLeft / scrollWidth / clientWidth et la position de l'onglet actif.
 *
 * Usage : node scripts/qa-hb-tabs.js [url] [width]
 */
const { chromium } = require("@playwright/test");
const fs = require("node:fs");

const URL = process.argv[2] || "https://pariscore.fr/?sport=handball";
const WIDTH = parseInt(process.argv[3] || "430", 10);

(async () => {
  const out = [];
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: WIDTH, height: 932 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(3500);
  const n = await page.locator('[aria-label^="Analyse du match"]').count();
  out.push(`matchs: ${n}`);
  await page.locator('[aria-label^="Analyse du match"]').first().click();
  await page.waitForTimeout(3000);

  const r = await page.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"]');
    // Le PREMIER tablist dans l'ordre du document est celui des onglets du
    // pop-up ; les suivants sont ceux des cartes (ex. HandballTeamStatsTable).
    const tl = dlg && dlg.querySelector('[role="tablist"]');
    if (!tl) return { error: "pas de tablist" };
    const cs = getComputedStyle(tl);
    const tabs = Array.from(tl.querySelectorAll('[role="tab"]'));
    return {
      scrollLeft: tl.scrollLeft,
      scrollWidth: tl.scrollWidth,
      clientWidth: tl.clientWidth,
      overflowX: cs.overflowX,
      scrollSnapType: cs.scrollSnapType,
      scrollBehavior: cs.scrollBehavior,
      scrollPaddingLeft: cs.scrollPaddingLeft,
      tabs: tabs.map((t) => {
        const b = t.getBoundingClientRect();
        return {
          label: (t.textContent || "").trim().slice(0, 14),
          active: t.getAttribute("data-state") === "active",
          left: Math.round(b.left),
          right: Math.round(b.right),
          w: Math.round(b.width),
          fullyVisible: b.left >= -0.5 && b.right <= window.innerWidth + 0.5,
        };
      }),
    };
  });
  out.push(JSON.stringify(r, null, 2));
  fs.writeFileSync("logs/qa-hb-tabs.txt", out.join("\n"));
  await browser.close();
})().catch((e) => {
  fs.writeFileSync("logs/qa-hb-tabs.txt", `ERREUR: ${e.stack}\n`);
  process.exit(1);
});