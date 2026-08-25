/**
 * Sonde QA — widget dashboard « Matchs en direct » (section tennis broadcast).
 * Screenshots .context/live-tennis-{desktop,mobile}.png
 */
const BASE = process.argv[2] || "http://localhost:3000";

let chromium;
try { ({ chromium } = require("playwright")); }
catch { ({ chromium } = require("@playwright/test")); }

async function shoot(browser, width, label) {
  const page = await browser.newPage({ viewport: { width, height: 1200 } });
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(5_000);
  const consent = page.locator("button", { hasText: /accept|accepter/i }).first();
  if (await consent.isVisible().catch(() => false)) { await consent.click().catch(() => {}); }

  // Retire le badge debug A/B qui chevauche la bottom-nav en mobile
  await page.evaluate(() => {
    document.querySelector('[aria-label="A/B test debug badge"]')?.remove();
    document.querySelectorAll('[role="region"][aria-label*="A/B"]').forEach((e) => e.remove());
  });

  // Ouvre la vue Live via la bottom-nav mobile
  const navLive = page.locator('nav[aria-label="Navigation principale"] button', { hasText: "Live" }).first();
  if (!(await navLive.isVisible().catch(() => false))) {
    console.log(`[${label}] bottom nav Live introuvable`);
    await page.screenshot({ path: `.context/live-tennis-${label}-fail.png` });
    await page.close();
    return;
  }
  await navLive.click();
  await page.waitForTimeout(4_000);

  const h2 = page.locator("h2", { hasText: /matchs en direct/i });
  console.log(`[${label}] vue Live ouverte:`, await h2.isVisible().catch(() => false));
  const cards = page.locator("article");
  console.log(`[${label}] cartes match:`, await cards.count());
  const firstTournament = page.locator("h4").first();
  if (await firstTournament.isVisible().catch(() => false)) {
    console.log(`[${label}] 1er tournoi:`, JSON.stringify(await firstTournament.innerText()));
  }
  await page.screenshot({ path: `.context/live-tennis-${label}.png` });
  console.log(`[${label}] screenshot ok | erreurs console:`, JSON.stringify(errors.slice(0, 4)));
  await page.close();
}

(async () => {
  const browser = await chromium.launch();
  await shoot(browser, 400, "mobile");
  await browser.close();
})().catch((e) => { console.error("PROBE FAIL:", e.message); process.exit(1); });
