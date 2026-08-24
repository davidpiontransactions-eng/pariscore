/* Sonde QA — sidebar élargie + top5 interactif + classements + vues nav */
const { chromium } = require("@playwright/test");
const BASE = process.env.QA_BASE_URL || "https://pariscore.fr";

(async () => {
  const browser = await chromium.launch();

  // ── Desktop : football + top5 + classements ──
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() =>
    page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 }),
  );
  await page.waitForTimeout(4000);
  await page.locator('button span.text-sm.font-semibold', { hasText: /^Football$/ }).click();
  await page.waitForTimeout(6000);

  const r = {};
  r.sidebarWidthClass = await page.locator("aside").first().getAttribute("class");

  const top5 = page.locator('section[aria-label="Top 5 matchs par stratégie"]');
  r.top5Present = (await top5.count()) > 0;
  // Probabilité affichée sur les rows probabilistes
  await top5.locator('select[aria-label="Stratégie du Top 5 matchs"], [data-slot="select-trigger"]').first().click();
  await page.waitForTimeout(400);
  await page.locator('[role="option"]:has-text("Over 1,5")').click();
  await page.waitForTimeout(800);
  r.probLineCount = await top5.locator("text=Réussite estimée").count();
  // Multi-sélection : cliquer 2 rows
  const rows = top5.locator("li button[aria-pressed]");
  r.rowCount = await rows.count();
  if (r.rowCount >= 2) {
    await rows.nth(0).click();
    await rows.nth(1).click();
    await page.waitForTimeout(500);
    r.selectionBlock = await top5.locator("text=Sélection (2)").count();
    r.cardRemoveBtns = await top5.locator('button[aria-label*="Retirer"]').count();
    // Anti-régression C1 : les cards gardent la stratégie CAPTURÉE après bascule
    await top5.locator('[data-slot="select-trigger"]').first().click();
    await page.waitForTimeout(400);
    await page.locator('[role="option"]:has-text("Double chance")').click();
    await page.waitForTimeout(800);
    r.cardKeepsCapturedStrategy =
      (await top5.locator("text=Over 1,5 buts").count()) >= 2;
  }
  await top5.screenshot({ path: ".context/qa-top5-interactive.png" }).catch(() => {});

  // Classements complet
  const rank = page.locator('section[aria-label="Classements championnat"]');
  await rank.scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(3000);
  r.rankTableRows = await rank.locator("tbody tr").count();
  r.rankHasPpmCol = await rank.locator('th[title*="Points par match"]').count();
  await rank.screenshot({ path: ".context/qa-rankings-prod.png" }).catch(() => {});
  await page.close();

  // ── Mobile : bottom nav → vraies vues ──
  const mp = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await mp.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
  await mp.waitForTimeout(4000);
  // Retire la bannière de consentement qui intercepte les clics (contexte QA)
  await mp.evaluate(() => {
    document
      .querySelector('[role="dialog"][aria-labelledby="consent-title"], [aria-describedby="consent-desc"]')
      ?.closest("div.fixed")
      ?.remove();
    document.querySelectorAll('[role="dialog"]').forEach((d) => {
      if ((d.textContent || "").match(/cookie|consent/i)) d.remove();
    });
  });
  await mp.waitForTimeout(500);
  const m = {};
  for (const [id, marker] of [
    ["Value", "Écarts entre probabilités"],
    ["Favoris", "Tes ligues suivies"],
    ["Profil", "Personnalise l'affichage"],
    ["Live", "Ouvre un sport puis bascule"],
  ]) {
    await mp.locator(`nav[aria-label="Navigation principale"] button:has-text("${id}")`).click();
    await mp.waitForTimeout(1200);
    m[id] = await mp.locator(`text=${marker}`).first().isVisible().catch(() => false);
  }
  r.mobileViews = m;
  await mp.close();

  console.log(JSON.stringify(r, null, 2));
  await browser.close();

  const pass =
    r.top5Present && r.probLineCount > 0 && r.selectionBlock === 1 &&
    r.cardKeepsCapturedStrategy &&
    r.rankTableRows >= 12 && r.rankHasPpmCol > 0 &&
    Object.values(r.mobileViews || {}).every(Boolean);
  console.log(pass ? "QA_FEATURES_PASS" : "QA_FEATURES_FAIL");
})().catch((e) => {
  console.error("PROBE_ERROR:", e.message);
  process.exit(1);
});
