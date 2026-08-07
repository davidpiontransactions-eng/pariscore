/**
 * Sonde QA — identifie les éléments qui débordent horizontalement à 412px
 * (le test Playwright "pas de débordement horizontal" échoue en prod).
 * Affiche la chaîne d'ancêtres de chaque élément coupable pour localiser
 * le composant source, et sauve un screenshot.
 *
 * Usage : node scripts/qa-overflow-probe.js [url]
 */
const { chromium } = require("@playwright/test");

const URL = process.argv[2] || "https://pariscore.fr";
// Viewport Pixel 7 explicite (412x915) — celui de l'APK en WebView.
const CTX = {
  viewport: { width: 412, height: 915 },
  isMobile: true,
  hasTouch: true,
  userAgent:
    "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36",
};

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...CTX });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 25000 });
  // L'app peut rediriger côté client (locale / thème) : attendre la stabilisation.
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2500);

  let report = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      report = await page.evaluate(() => {
        const vw = window.innerWidth;
        const docW = document.documentElement.scrollWidth;
        const label = (el) => {
          const id = el.id ? `#${el.id}` : "";
          const cls =
            typeof el.className === "string" && el.className
              ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".")
              : "";
          return el.tagName.toLowerCase() + id + cls;
        };
        const chain = (el) => {
          const parts = [];
          let n = el;
          for (let i = 0; i < 7 && n && n.tagName !== "BODY"; i++) {
            parts.push(label(n));
            n = n.parentElement;
          }
          return parts.join(" < ");
        };
        const offenders = [];
        document.querySelectorAll("body *").forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.right > vw + 1) {
            offenders.push({
              sel: label(el),
              right: Math.round(r.right),
              width: Math.round(r.width),
              overflowBy: Math.round(r.right - vw),
              chain: chain(el),
            });
          }
        });
        // Top 8 par overflow décroissant, dédupliqués par sélecteur
        const seen = new Set();
        const top = offenders
          .sort((a, b) => b.overflowBy - a.overflowBy)
          .filter((o) => (seen.has(o.sel) ? false : (seen.add(o.sel), true)))
          .slice(0, 8);
        return { vw, docW, count: offenders.length, top };
      });
      break;
    } catch (e) {
      if (attempt === 3) throw e;
      // Contexte détruit par une navigation : attendre et réessayer.
      await page.waitForTimeout(2500);
    }
  }

  await page
    .screenshot({ path: "docs/mobile/qa-overflow-412.png" })
    .catch(() => {});

  console.log(`URL             : ${URL}`);
  console.log(`viewport        : ${report.vw}px`);
  console.log(
    `scrollWidth doc : ${report.docW}px (overflow global: ${report.docW - report.vw}px)`,
  );
  console.log(`éléments qui débordent : ${report.count}`);
  console.log(`screenshot      : docs/mobile/qa-overflow-412.png`);
  for (const o of report.top) {
    console.log(
      `\n  - ${o.sel}  right=${o.right}px width=${o.width}px (+${o.overflowBy}px)`,
    );
    console.log(`    chaîne: ${o.chain}`);
  }
  await browser.close();
})().catch((e) => {
  console.error("ERREUR sonde:", e.message);
  process.exit(1);
});
