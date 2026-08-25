/**
 * Sonde QA — visibilité de l'heure de début sur les cartes tennis (broadcast).
 * Vérifie que l'heure (HH:MM) est rendue ET dans les bornes de la carte,
 * à 2 largeurs de viewport. Screenshots : .context/card-time-{desktop,mobile}.png
 * Usage : node scripts/probe-card-time.js [baseUrl]
 */
const BASE = process.argv[2] || "http://localhost:3000";

let chromium;
try { ({ chromium } = require("playwright")); }
catch { ({ chromium } = require("@playwright/test")); }

async function checkAtWidth(browser, width, label) {
  const page = await browser.newPage({ viewport: { width, height: 1200 } });
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(6_000); // SWR arbre + données

  // Bandeau cookies éventuel → Accepter si présent
  const consent = page.locator("button", { hasText: /accept|accepter|tout accept/i }).first();
  if (await consent.isVisible().catch(() => false)) {
    await consent.click().catch(() => {});
    await page.waitForTimeout(500);
  }

  // Onglet Tennis → grille de cartes
  await page.getByRole("tab", { name: /tennis/i }).click();
  await page.waitForTimeout(7_000); // rendu des cartes broadcast

  const card = page.locator("article").filter({ hasText: /\d{1,2}:\d{2}/ }).first();
  const cardCount = await page.locator("article").count();
  if (!(await card.isVisible().catch(() => false))) {
    console.log(`[${label}] cartes: ${cardCount} — aucune carte avec heure détectée`);
    await page.close();
    return;
  }
  await card.scrollIntoViewIfNeeded();

  // Tous les spans HH:MM de la carte (heure précise + éventuels autres)
  const timeLocs = card.locator("span", { hasText: /^\s*\d{1,2}:\d{2}\s*$/ });
  const n = await timeLocs.count();
  const cardBox = await card.boundingBox();
  let visibleInBounds = 0;
  for (let i = 0; i < n; i++) {
    const el = timeLocs.nth(i);
    if (!(await el.isVisible())) continue;
    const b = await el.boundingBox();
    if (!b) continue;
    // Dans les bornes horizontales de la carte (tolérance 2px)
    if (b.x >= cardBox.x - 2 && b.x + b.width <= cardBox.x + cardBox.width + 2) visibleInBounds++;
  }
  const sample = n > 0 ? await timeLocs.first().innerText() : "—";
  console.log(`[${label}] cartes=${cardCount} | spans HH:MM=${n} | visibles+dans carte=${visibleInBounds} | exemple="${sample.trim()}"`);
  await page.screenshot({ path: `.context/card-time-${label}.png` });
  console.log(`[${label}] screenshot: .context/card-time-${label}.png`);
  await page.close();
}

(async () => {
  const browser = await chromium.launch();
  await checkAtWidth(browser, 1600, "desktop");
  await checkAtWidth(browser, 400, "mobile");
  await browser.close();
})().catch((e) => { console.error("PROBE FAIL:", e.message); process.exit(1); });
