/* Sonde QA diagnostique — pourquoi la section Top 5 absente ? */
const { chromium } = require("@playwright/test");
const BASE = process.env.QA_BASE_URL || "https://pariscore.fr";

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();

  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(4000);

  // Inventaire des candidats "Football"
  const candidates = await page.locator('button:has-text("Football")').evaluateAll((els) =>
    els.slice(0, 8).map((el, i) => ({
      i,
      txt: el.textContent?.trim().slice(0, 60),
      cls: el.className?.slice(0, 80),
      visible: !!(el.offsetWidth || el.offsetHeight),
    })),
  );

  // Clic ciblé sur la carte sport (span font-semibold texte exact)
  const diag = { candidates, clicked: false };
  try {
    await page.locator('button span.text-sm.font-semibold', { hasText: /^Football$/ }).click({ timeout: 5000 });
    diag.clicked = true;
    await page.waitForTimeout(6000);
  } catch (e) {
    diag.clickError = e.message.slice(0, 120);
  }

  diag.asideCount = await page.locator("aside").count();
  diag.sectionLabels = await page.evaluate(() =>
    [...document.querySelectorAll("section[aria-label]")].map((s) => s.getAttribute("aria-label")).slice(0, 30),
  );
  diag.top5Section = await page.locator('section[aria-label="Top 5 matchs par stratégie"]').count();
  diag.rankingsSection = await page
    .locator('section[aria-label="Classements championnat"], section[aria-label*="Classement"]')
    .count();

  await page.screenshot({ path: ".context/qa-top5-diag.png" });
  console.log(JSON.stringify(diag, null, 2));
  await browser.close();
})().catch((e) => {
  console.error("PROBE_ERROR:", e.message);
  process.exit(1);
});
