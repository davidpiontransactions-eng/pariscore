/* Sonde QA — vue Live agrégée (mobile bottom-nav) */
const { chromium } = require("@playwright/test");
const BASE = process.env.QA_BASE_URL || "https://pariscore.fr";

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(4000);
  await page.evaluate(() => document.querySelectorAll('[role="dialog"]').forEach((d) => d.remove()));
  await page.locator('nav[aria-label="Navigation principale"] button:has-text("Live")').click();
  await page.waitForTimeout(6000);

  const r = {};
  r.heading = (await page.locator('h2:has-text("Matchs en direct")').count()) > 0;
  r.footballSection = await page.locator('h3:has-text("Football")').count();
  r.tennisSection = await page.locator('h3:has-text("Tennis")').count();
  r.emptyState = await page.locator("text=Aucun match en direct").count();
  r.minuteBadges = await page.locator("li span.font-mono.text-red-300, li >> text=/^MT$|^\\d+'$/").count();
  r.scoreSamples = await page
    .locator("li span.font-mono.font-bold.tabular-nums")
    .allTextContents()
    .then((a) => a.slice(0, 5))
    .catch(() => []);
  r.analysisButtons = await page.locator('button:has-text("Analyse tennis"), button:has-text("Analyse football")').count();
  r.errors = errors.slice(0, 5);
  await page.screenshot({ path: ".context/qa-live-view.png" });
  console.log(JSON.stringify(r, null, 2));
  await browser.close();

  const pass =
    r.heading &&
    (r.footballSection + r.tennisSection + r.emptyState >= 1) &&
    r.analysisButtons === 2 &&
    r.errors.length === 0;
  console.log(pass ? "QA_LIVE_PASS" : "QA_LIVE_FAIL");
})().catch((e) => {
  console.error("PROBE_ERROR:", e.message);
  process.exit(1);
});
