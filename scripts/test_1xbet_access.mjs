#!/usr/bin/env node
/**
 * test_1xbet_access.mjs
 *
 * Test d'accès à 1xbet depuis le VPS via Playwright.
 * Vérifie si on peut charger la page snooker et extraire les cotes.
 *
 * Usage: node scripts/test_1xbet_access.mjs
 */

import { chromium } from "playwright";

const DOMAINS = [
  { name: "1xbet.com", url: "https://1xbet.com/en/line/snooker" },
  { name: "1xbet.kz", url: "https://1xbet.kz/en/line/snooker" },
  { name: "1x-bet.fr", url: "https://1x-bet.fr/en/line/snooker" },
];

async function testDomain(browser, { name, url }) {
  console.log(`\n[${name}] Test: ${url}`);
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  try {
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
    console.log(`  Status: ${response?.status()}`);
    console.log(`  URL finale: ${page.url()}`);

    // Vérifier si on est redirigé vers /block
    if (page.url().includes("/block")) {
      console.log(`  ❌ REDIRIGÉ VERS /block — IP bloquée`);
      await context.close();
      return null;
    }

    // Attendre le chargement JS
    await page.waitForTimeout(5000);

    // Vérifier le titre
    const title = await page.title();
    console.log(`  Titre: ${title}`);

    // Chercher des éléments de cotes
    const oddsCount = await page.locator('[class*="bet"], [class*="odds"], [class*="coef"]').count();
    console.log(`  Éléments odds trouvés: ${oddsCount}`);

    // Extraire les données de match si présentes
    const matchData = await page.evaluate(() => {
      const matches = [];
      // Sélecteurs potentiels pour 1xbet
      const rows = document.querySelectorAll('[class*="sport-event"], [class*="event-row"], [class*="match"], [class*="game"]');
      for (const row of Array.from(rows).slice(0, 5)) {
        const text = row.textContent?.trim().substring(0, 100);
        if (text) matches.push(text);
      }
      return matches;
    });

    if (matchData.length > 0) {
      console.log(`  Matchs trouvés: ${matchData.length}`);
      matchData.forEach((m, i) => console.log(`    ${i + 1}. ${m}`));
    } else {
      // Prendre un screenshot pour debug
      await page.screenshot({ path: `/tmp/1xbet_${name.replace(/\./g, "_")}.png` });
      console.log(`  Screenshot sauvé: /tmp/1xbet_${name.replace(/\./g, "_")}.png`);
    }

    // Tenter de trouver l'API interne (Network tab)
    const cookies = await context.cookies();
    console.log(`  Cookies: ${cookies.length}`);

  } catch (err) {
    console.log(`  ❌ Erreur: ${err.message}`);
  }

  await context.close();
  return null;
}

async function main() {
  console.log("Test d'accès 1xbet depuis le VPS (Playwright)...");
  const browser = await chromium.launch({ headless: true });

  for (const domain of DOMAINS) {
    await testDomain(browser, domain);
  }

  await browser.close();
  console.log("\n✅ Tests terminés");
}

main().catch(console.error);
