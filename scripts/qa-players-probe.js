/* Sonde QA — buteurs/passeurs + drapeaux + table compacte + régressions */
const { chromium } = require("@playwright/test");
const BASE = process.env.QA_BASE_URL || "https://pariscore.fr";

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(4000);
  await page.locator('button span.text-sm.font-semibold', { hasText: /^Football$/ }).click();
  await page.waitForTimeout(6000);

  const r = {};
  const rank = page.locator('section[aria-label="Classements championnat"]');
  await rank.scrollIntoViewIfNeeded().catch(() => {});
  await rank.locator('[role="group"][aria-label="Vue"] button:has-text("Buteurs")').click();
  await page.waitForTimeout(4000);

  // Panel joueurs
  r.scorerRows = await rank.locator("ol li").count();
  r.scorerHasNameAndTotal =
    (await rank.locator("ol li").first().locator("text=/\\d+$/").count()) > 0;
  r.understatFooter = await rank.locator("text=source Understat").count();
  // Drapeaux dans le select championnats
  await rank.locator('[data-slot="select-trigger"][aria-label="Championnat"]').click();
  await page.waitForTimeout(500);
  r.flagImgsInMenu = await page.locator('[role="listbox"] img').count();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  // Retour Équipes : table compacte + régression marché/L5
  await rank.locator('[role="group"][aria-label="Vue"] button:has-text("Équipes")').click();
  await page.waitForTimeout(2500);
  r.compactTeamCol = (await rank.locator('td.w-\\[104px\\]').count()) > 0;
  await rank.locator('[data-slot="select-trigger"][aria-label="Marché statistique"]').click();
  await page.waitForTimeout(400);
  r.marketOptions = await page.locator('[role="option"]').count();
  await page.keyboard.press("Escape");

  // Top5 : plancher cotes toujours actif
  const top5 = page.locator('section[aria-label="Top 5 matchs par stratégie"]');
  await top5.scrollIntoViewIfNeeded().catch(() => {});
  await top5.locator('[data-slot="select-trigger"]').first().click();
  await page.waitForTimeout(400);
  const opt = page.locator('[role="option"]:has-text("Under 3,5")');
  if ((await opt.count()) > 0) {
    await opt.click();
    await page.waitForTimeout(1000);
    const probs = await top5.locator(":text-matches('/Réussite estimée/: [0-9]+/')").allTextContents().catch(() => []);
    const nums = probs.map((t) => parseInt((t.match(/([0-9]+)\s*%/) || [])[1] ?? "-1", 10)).filter((n) => n >= 0);
    r.under35Probs = nums;
    r.floorOk = nums.length === 0 || Math.max(...nums) < 87;
  }
  await rank.screenshot({ path: ".context/qa-classements-final.png" }).catch(() => {});

  console.log(JSON.stringify(r, null, 2));
  await browser.close();

  const pass =
    r.scorerRows >= 8 && r.understatFooter > 0 && r.flagImgsInMenu >= 10 &&
    r.compactTeamCol && r.marketOptions >= 10 && r.floorOk === true;
  console.log(pass ? "QA_PLAYERS_PASS" : "QA_PLAYERS_FAIL");
})().catch((e) => {
  console.error("PROBE_ERROR:", e.message);
  process.exit(1);
});
