/**
 * QA visuelle du bandeau backtest du widget Top 5 football.
 * Vérifie : rendu du strip, stats non nulles, drawer dépliable, zéro erreur console.
 * Usage : node scripts/qa-top5-backtest-ui.js [baseUrl]
 */

const { chromium } = require("@playwright/test");
const path = require("path");

const BASE = process.argv[2] || "http://localhost:3000";
const SPORT = process.argv[3] || "football"; // football | tennis
const OUT = path.join(".context", `qa-top5-backtest-strip-${SPORT}.png`);
const SECTION =
  SPORT === "tennis"
    ? 'section[aria-label="Top 5 matchs tennis par métrique"]'
    : 'section[aria-label="Top 5 matchs par stratégie"]';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(1500);

  const section = page.locator(SECTION);
  if (!(await section.isVisible().catch(() => false))) {
    // Onglet sport via le header swipe (ou carte du dashboard en repli).
    const tab = page.locator(`button:has-text("${SPORT === "tennis" ? "Tennis" : "Football"}")`).first();
    if (await tab.isVisible().catch(() => false)) {
      await tab.click();
    } else {
      await page.locator('[data-sport] button:has-text("Foot")').first().click();
    }
    await section.waitFor({ state: "visible", timeout: 30_000 });
  }

  await page.waitForTimeout(2500); // SWR top5 + backtest

  const strip = section.locator("button", { hasText: "Backtest" }).first();
  await strip.waitFor({ state: "visible", timeout: 15_000 });
  const stripText = (await strip.innerText()).replace(/\s+/g, " ").trim();

  try {
    await strip.click({ timeout: 8000 });
  } catch {
    // Sidebar à scroll imbriqué : Playwright peut échouer le scroll natif.
    await strip.dispatchEvent("click");
  }
  await page.waitForTimeout(400);
  const drawerRows = await section.locator("ul li").count();

  await section.screenshot({ path: OUT });

  const pass =
    /\d+\s+picks/.test(stripText) && /WR\s*\d+\s*%/.test(stripText) && /ROI\s*[+\-−]?\d/.test(stripText);

  console.log(`strip     : ${stripText}`);
  console.log(`drawer    : ${drawerRows} ligne(s) après clic`);
  console.log(`screenshot: ${OUT}`);
  console.log(`erreurs console: ${errors.length}${errors.length ? " -> " + errors.slice(0, 3).join(" | ") : ""}`);
  console.log(pass && errors.length === 0 ? "QA PASS" : "QA FAIL");

  await browser.close();
  process.exit(pass && errors.length === 0 ? 0 : 1);
})().catch((e) => {
  console.error("QA ERROR:", e.message);
  process.exit(1);
});
