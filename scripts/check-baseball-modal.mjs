/**
 * Check modal Baseball — section Vainqueur (moneyline) + absence de
 * predictionBlockedReason. Usage: node scripts/check-baseball-modal.mjs [url]
 */
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "https://pariscore.fr";
const log = (m) => console.log(m);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text()}`); });

await page.goto(base, { waitUntil: "networkidle", timeout: 60000 });
log(`URL: ${page.url()}`);

const baseballTab = page.locator("button, [role=tab], a").filter({ hasText: /^Baseball$|MLB|KBO/i }).first();
if (await baseballTab.count()) {
  await baseballTab.click();
  await page.waitForTimeout(2500);
  log(`Tab: ${(await baseballTab.textContent()).trim()}`);
}

// Première card avec chips O/U → clic "Analyse complète"
const ouChip = page.locator("text=/O\\/U \\d+\\.\\d/").first();
await ouChip.waitFor({ timeout: 30000 });
const analyzeBtn = page.locator("button", { hasText: "Analyse complète" }).first();
await analyzeBtn.click();
await page.waitForTimeout(2500);

// Vérifications modal
const modal = page.locator("[role=dialog], [class*=modal], [class*=Modal]").first();
const hasModal = (await modal.count()) > 0;
log(`\nModal détectée: ${hasModal}`);

const bodyText = await page.evaluate(() => document.body.innerText);
const hasMoneyline = /Vainqueur du match|Moneyline/i.test(bodyText);
const hasBlocked = /Stats saison d'un lanceur|ne prédit que sur des données/i.test(bodyText);
const hasTotal = /O\/U|Over|Under/i.test(bodyText);

log(`Section Vainqueur/Moneyline présente: ${hasMoneyline}`);
log(`predictionBlockedReason affiché (RÉGRESSION?): ${hasBlocked}`);
log(`Section Total (O/U) présente: ${hasTotal}`);

const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
await page.screenshot({ path: `baseball-modal-${ts}.png`, fullPage: false });

if (errors.length) {
  log("\n--- Erreurs console/page ---");
  errors.slice(0, 10).forEach((e) => log(`  ${e}`));
}

const ok = hasModal && hasMoneyline && !hasBlocked && hasTotal;
log(`\nVERDICT: ${ok ? "OK — modal complète (moneyline + O/U, aucun blocage)" : "WARN — voir captures"}`);
log(`Screenshot: baseball-modal-${ts}.png`);
await browser.close();
process.exit(ok ? 0 : 2);