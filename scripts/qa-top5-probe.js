/* Sonde QA visuelle — Top 5 Matchs (Select Shadcn) sur prod */
const { chromium } = require("@playwright/test");

const BASE = process.env.QA_BASE_URL || "https://pariscore.fr";

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 200)}`);
  });

  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(4000); // hydratation

  // Bascule sur l'onglet Football (défaut = tennis) — carte sport précise
  const footCard = page.locator('button span.text-sm.font-semibold', { hasText: /^Football$/ });
  let footballClicked = false;
  if ((await footCard.count()) > 0) {
    await footCard.click();
    footballClicked = true;
    await page.waitForTimeout(5000); // rendu sidebar football + hooks data
  }

  const section = page.locator('section[aria-label="Top 5 matchs par stratégie"]');
  const result = {
    url: page.url(),
    title: await page.title(),
    footballClicked,
    swController: await page.evaluate(() => !!navigator.serviceWorker?.controller),
    sectionPresent: (await section.count()) > 0,
    // Nouveau markup : Select Shadcn + description verte
    selectTriggerInTop5: await section.locator('[data-slot="select-trigger"]').count(),
    greenDesc: await section.locator("p.text-emerald-400").count(),
    greenDescText:
      (await section.locator("p.text-emerald-400").count()) > 0
        ? await section.locator("p.text-emerald-400").textContent()
        : null,
    l5l10Toggle: await section.locator('[role="group"] button').count(),
  };

  // Ouvre le select si présent pour capturer les options
  if (result.selectTriggerInTop5 > 0) {
    await section.locator('[data-slot="select-trigger"]').click();
    await page.waitForTimeout(600);
    result.optionsVisible = await page.locator('[role="option"]').allTextContents();
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  }

  // Sélectionne Under 3,5 buts si présent pour vérifier le wiring description
  if ((result.optionsVisible || []).some((t) => t.includes("Under 3,5"))) {
    await section.locator('[data-slot="select-trigger"]').click();
    await page.waitForTimeout(400);
    await page.locator('[role="option"]:has-text("Under 3,5")').click();
    await page.waitForTimeout(800);
    result.afterSelectDesc = await section.locator("p.text-emerald-400").textContent();
  }

  await page.screenshot({ path: ".context/qa-top5-home.png", fullPage: false });
  if (result.sectionPresent) {
    await section.screenshot({ path: ".context/qa-top5-section.png" }).catch(() => {});
  }

  result.errors = errors.slice(0, 10);
  console.log(JSON.stringify(result, null, 2));
  await browser.close();

  const pass =
    result.footballClicked &&
    result.sectionPresent &&
    result.selectTriggerInTop5 > 0 &&
    result.greenDesc > 0 &&
    (!result.afterSelectDesc || result.afterSelectDesc.includes("Under 3,5"));
  console.log(pass ? "QA_TOP5_PASS" : "QA_TOP5_FAIL");
})().catch((e) => {
  console.error("PROBE_ERROR:", e.message);
  process.exit(1);
});
