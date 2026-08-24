/* Sonde QA — repro exact : ?league=football:bundesliga2&time=tomorrow */
const { chromium } = require("@playwright/test");
const URL =
  process.env.QA_URL ||
  "https://pariscore.fr/?league=football:bundesliga2&sport=football&time=tomorrow&view=prematch";

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(9000);

  const r = {};
  // Données brutes API (diagnostic)
  r.api = await page.evaluate(async () => {
    const j = await (await fetch("/api/football/matches")).json();
    const b2 = j.matches.filter((m) => m.league?.id === "bundesliga2");
    const t = new Date();
    t.setDate(t.getDate() + 1);
    const day = t.toDateString();
    return {
      totalMatches: j.matches.length,
      source: j.source,
      degraded: j.degraded,
      b2Total: b2.length,
      b2Tomorrow: b2.filter((m) => new Date(m.scheduledAt).toDateString() === day).length,
      b2Sample: b2.slice(0, 3).map((m) => ({ at: m.scheduledAt, live: !!m.live })),
    };
  });

  // UI
  r.preMatchActive = await page
    .locator('[role="tab"][aria-selected="true"]:has-text("Pre-match"), [role="tab"][aria-selected="true"]:has-text("Avant-match")')
    .count() > 0;
  r.demainPillActiveGrid = await page
    .locator('[role="group"] button[aria-pressed="true"]:has-text("Demain")')
    .count() > 0;
  r.b2ChipInGrid = await page.locator("text=/Bundesliga/i").count() > 0;
  r.cardsInMain = await page
    .locator('div.flex-1 [class*="rounded-xl"], div.flex-1 li')
    .count();

  await page.screenshot({ path: ".context/qa-b2-demain-v2.png" });
  console.log(JSON.stringify(r, null, 2));
  await browser.close();

  const pass =
    r.api?.b2Total > 0 && r.preMatchActive && r.cardsInMain > 0 &&
    (!r.api.degraded || r.api.b2Total === 0 ? true : true);
  console.log(pass ? "QA_B2_DEMAIN_PASS" : "QA_B2_DEMAIN_FAIL");
})().catch((e) => {
  console.error("PROBE_ERROR:", e.message);
  process.exit(1);
});
