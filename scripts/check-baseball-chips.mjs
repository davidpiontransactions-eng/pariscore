/**
 * Check visuel Baseball — chips O/U + Winner visibles (fix statsAvailable).
 * Usage: node scripts/check-baseball-chips.mjs [url]
 */
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "https://pariscore.fr";
const out = [];
const log = (m) => { out.push(m); console.log(m); };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text()}`); });

await page.goto(base, { waitUntil: "networkidle", timeout: 60000 });
log(`URL: ${page.url()}`);

// Onglet Baseball — clic sur l'onglet nommé Baseball/MLB
const baseballTab = page.locator("button, [role=tab], a").filter({ hasText: /^Baseball$|MLB|KBO/i }).first();
if (await baseballTab.count()) {
  await baseballTab.click();
  await page.waitForTimeout(2500);
  log(`Tab clicked: ${(await baseballTab.textContent()).trim()}`);
} else {
  log("WARN: onglet Baseball non trouvé — tentative directe");
}

// Attente des cards
await page.waitForTimeout(3000);

// Collecte des cards baseball
const cards = page.locator("[data-testid], [class*=card], article").filter({ hasText: /MLB|KBO|Yankees|Dodgers|Red Sox/i });
log(`Cards repérées: ~${Math.max(1, await cards.count())}`);

// Extraction des chips O/U et Winner sur toute la page
const chipData = await page.evaluate(() => {
  const results = [];
  const walk = (el) => {
    const text = el.textContent || "";
    if (/O\/U|Over|Under|Winner|Attendu|Total/i.test(text) && el.children.length <= 8) {
      results.push(text.replace(/\s+/g, " ").trim().slice(0, 160));
    }
    for (const c of el.children) walk(c);
  };
  walk(document.body);
  return results.slice(0, 40);
});

const ouChips = chipData.filter((t) => /O\/U|Over|Under|Attendu|Total/i.test(t));
const winnerChips = chipData.filter((t) => /Winner/i.test(t));
log(`\n--- Chips O/U trouvées: ${ouChips.length} ---`);
ouChips.slice(0, 8).forEach((c) => log(`  • ${c}`));
log(`\n--- Chips Winner trouvées: ${winnerChips.length} ---`);
winnerChips.slice(0, 8).forEach((c) => log(`  • ${c}`));

// Verdict
const ok = ouChips.length >= 2 && winnerChips.length >= 1;
log(`\nVERDICT: ${ok ? "OK — chips O/U + Winner visibles" : "WARN — chips manquants, voir captures"}`);

// Screenshots
const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
await page.screenshot({ path: `baseball-chips-${ts}.png`, fullPage: false });
const bbSection = page.locator("text=Baseball").last();
if (await bbSection.count()) {
  try { await bbSection.scrollIntoViewIfNeeded(); await page.waitForTimeout(500); } catch {}
}
await page.screenshot({ path: `baseball-section-${ts}.png`, fullPage: true });

if (errors.length) {
  log("\n--- Erreurs console/page ---");
  errors.slice(0, 10).forEach((e) => log(`  ${e}`));
}
log(`\nScreenshots: baseball-chips-${ts}.png, baseball-section-${ts}.png`);
await browser.close();
process.exit(ok ? 0 : 2);