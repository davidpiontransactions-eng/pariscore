/**
 * Sonde QA prod — moteur Markov live (section « Set en cours »).
 * Vérifie que les barres Over 7,5 / Under 12,5 s'affichent avec des
 * valeurs plausibles (%) sur https://pariscore.fr, onglet Tennis > Live.
 *
 * Usage : bun run scripts/qa-markov-live-probe.ts
 */
import { chromium } from "@playwright/test";

const BASE = process.env.QA_BASE_URL ?? "https://pariscore.fr";
const OUT = ".context/qa-markov-live-prod.png";

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto(`${BASE}/?view=live`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3000);

  // Onglet Tennis si présent (la home démarre sur Football).
  const tennisTab = page.locator('button:has-text("Tennis")').first();
  if (await tennisTab.isVisible().catch(() => false)) {
    await tennisTab.click();
    await page.waitForTimeout(2000);
  }

  // Revenir sur le sous-onglet live si besoin.
  const liveBtn = page.locator('button:has-text("Live"), a:has-text("Live")').first();
  if (await liveBtn.isVisible().catch(() => false)) {
    await liveBtn.click();
  }

  // Attendre le poll live (8s) + hydratation.
  await page.waitForTimeout(12000);

  // Chercher la section « Set en cours ».
  const sections = page.locator('text="Set en cours"');
  const nb = await sections.count();

  console.log(`[QA] sections « Set en cours » trouvées : ${nb}`);

  let ok = false;
  if (nb > 0) {
    // Lire les valeurs % des barres Over 7,5 / Under 12,5 du premier bloc.
    const card = sections.first().locator("xpath=ancestor::div[1]");
    const text = await card.innerText().catch(() => "");
    const percents = [...text.matchAll(/(\d{1,3})%/g)].map((m) => Number(m[1]));
    const plausible = percents.every((p) => p >= 0 && p <= 100);
    console.log(`[QA] valeurs % lues : ${percents.join(", ") || "(aucune)"} — plausibles: ${plausible}`);
    ok = plausible && percents.length >= 2;

    // Un vrai pourcentage live ne doit pas rester au fallback 50 partout.
    const allFifty = percents.length > 0 && percents.every((p) => p === 50);
    if (allFifty) console.log("[WARN] toutes les valeurs = 50% (fallback ? vérifier contexte live)");
  } else {
    console.log("[WARN] aucune section « Set en cours » visible — vérifier qu'un match est bien en cours et prématch résolu.");
  }

  await page.screenshot({ path: OUT, fullPage: false });
  console.log(`[QA] screenshot → ${OUT}`);
  console.log(ok ? "[QA] RESULT: PASS" : "[QA] RESULT: À VÉRIFIER MANUELLEMENT");

  await browser.close();
}

main().catch((e) => {
  console.error("[QA] ERREUR:", e);
  process.exit(1);
});
