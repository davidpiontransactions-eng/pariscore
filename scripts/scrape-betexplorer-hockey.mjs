#!/usr/bin/env node
/**
 * scrape-betexplorer-hockey.mjs
 *
 * Scraper BetExplorer pour les matchs de hockey en pré-match (1X2 odds).
 * Utilise Playwright avec gestion de l'âge/consentement WAF.
 *
 * Usage:
 *   node scripts/scrape-betexplorer-hockey.mjs                    # tous les ligues
 *   node scripts/scrape-betexplorer-hockey.mjs --league=khl    # KHL seulement
 *   node scripts/scrape-betexplorer-hockey.mjs --league=nhl    # NHL seulement
 *   node scripts/scrape-betexplorer-hockey.mjs --league=magnus # Ligue Magnus seulement
 *
 * Sortie: data/hockey_prematch_betexplorer.json (merge API prematch)
 */

import { chromium } from "playwright";
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "fs";
import { join } from "path";

const OUT_FILE = join(import.meta.dirname, "..", "data", "hockey_prematch_betexplorer.json");

// League mappings: BetExplorer slug → display name & Annabet serieId
const LEAGUES = [
  { id: "nhl", name: "NHL", country: "united-states", league: "nhl", annonce: "NHL" },
  { id: "khl", name: "KHL", country: "russia", league: "khl", annonce: "KHL" },
  { id: "magnus", name: "Ligue Magnus", country: "france", league: "ligue-magnus", annonce: "Ligue Magnus" },
];

// Filtre par ligne de commande
const args = process.argv.slice(2);
const leagueFilter = args.find((a) => a.startsWith("--league="))?.split("=")[1];
const onlyLeagues = leagueFilter ? LEAGUES.filter((l) => l.id === leagueFilter) : LEAGUES;

async function main() {
  console.log("[BetExplorer Hockey] Scraping pré-match 1X2 odds...");
  const browser = await chromium.launch({ headless: true, args: ["--disable-blink-features=AutomationControlled"] });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    javaScriptEnabled: true,
  });
  const page = await context.newPage();
  const scrapedAt = new Date().toISOString();

  // Accepter les cookies et la vérification d'âge AVANT de naviguer
  await page.goto("https://www.betexplorer.com/", { waitUntil: "load", timeout: 30000 });

  // Gérer la bannière d'âge - attendre et cliquer
  try {
    // Attendre que la page charge et chercher les boutons
    await page.waitForSelector('text=18+, text=Accepter, button:has-text("Accept"), #wtcg-accept', {
      timeout: 5000
    });
    
    // Essayer plusieurs sélecteurs de boutons d'accept
    const acceptSelectors = [
      'text=18+',
      'text=Accepter', 
      'button:has-text("Accept")',
      'button:has-text("accepter")',
      '#wtcg-accept',
      '.cc-accept',
      'text="I accept"'
    ];
    
    for (const sel of acceptSelectors) {
      const btn = await page.$(sel);
      if (btn) {
        await btn.click();
        await page.waitForTimeout(1000);
        break;
      }
    }
  } catch (e) {
    // Ignorer - pas de bannière présente ou déjà géré
  }

  // Merge avec le fichier existant pour ne pas écraser les autres ligues
  // (--league=magnus ne doit pas supprimer nhl/khl)
  let output = {
    updatedAt: scrapedAt,
    source: "betexplorer.com (hockey next)",
    leagues: {},
  };
  try {
    if (existsSync(OUT_FILE)) {
      const prev = JSON.parse(readFileSync(OUT_FILE, "utf-8"));
      if (prev && typeof prev === "object" && prev.leagues) {
        output = { ...output, leagues: { ...prev.leagues } };
      }
    }
  } catch {
    // fichier corrompu → on repart de zéro
  }

  // S'assurer que le dossier data existe
  mkdirSync(join(import.meta.dirname, "..", "data"), { recursive: true });

  for (const league of onlyLeagues) {
    const leagueKey = league.id;
    const url = `https://www.betexplorer.com/hockey/${league.country}/${league.league}/next/`;

    console.log(`[BetExplorer Hockey] ${league.annonce} → ${url}`);

    try {
      // Naviguer vers la page hockey - attendre le chargement
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
      
      // Attendre que le tableau apparaisse
      await page.waitForSelector("table.table-main, table", { timeout: 30000 });

      // Vérifier blocage Cloudflare
      if (page.url().includes("/block") || page.url().includes("captcha")) {
        console.log(`  ❌ ${league.annonce}: bloqué par Cloudflare`);
        output.leagues[leagueKey] = {
          matches: [],
          error: "IP potentiellement bloquée par BetExplorer",
        };
        continue;
      }

      const matches = await page.evaluate((leagueId) => {
        const results = [];

        // Sélectionner les lignes de match dans le tableau
        const table = document.querySelector("table.table-main");
        if (!table) {
          console.log("  ⚠️ Tableau introuvable, tentative alternative...");
          const tables = document.querySelectorAll("table");
          if (tables.length === 0) return { matches: [], error: "Aucun tableau trouvé" };
          for (const t of tables) {
            const rows = t.querySelectorAll("tr");
            if (rows.length > 5) {
              table = t;
              break;
            }
          }
        }

        if (!table) return { matches: [], error: "Aucun tableau trouvé" };

        const rows = table.querySelectorAll("tr");
        // Skip header rows (first 2 typically)
        let startIdx = 0;
        if (rows.length > 0) {
          const firstRow = rows[0];
          const firstCell = firstRow.querySelector("td");
          if (firstCell && firstCell.textContent.trim().length === 0) {
            startIdx = 1; // skip header
          }
          if (rows.length > 1 && rows[1].querySelectorAll("td").length <= 2) {
            startIdx = 2; // skip 2 headers
          }
        }

        for (let i = startIdx; i < rows.length; i++) {
          const row = rows[i];
          const cells = row.querySelectorAll("td");
          if (cells.length < 4) continue;

          // Équipe domicile (home) - première colonne contient les noms
          const homeDiv = cells[0]?.querySelector(".table-main__participantHome");
          const awayDiv = cells[0]?.querySelector(".table-main__participantAway");

          const team1Name = homeDiv ? homeDiv.textContent.trim() : "";
          const team2Name = awayDiv ? awayDiv.textContent.trim() : "";

          if (!team1Name || !team2Name) continue;

          // Cotes 1X2 - dans les divs odds
          const oddsDivs = cells[2]?.querySelectorAll(".table-main__odds");
          let o1 = 0, ox = 0, o2 = 0;

          if (oddsDivs && oddsDivs.length >= 3) {
            o1 = parseFloat(oddsDivs[0]?.textContent?.trim() || "0");
            ox = parseFloat(oddsDivs[1]?.textContent?.trim() || "0");
            o2 = parseFloat(oddsDivs[2]?.textContent?.trim() || "0");
          } else {
            // Fallback: chercher tous les divs data-odd dans la ligne
            const allOdds = row.querySelectorAll("[data-odd]");
            const oddValues = [];
            for (const od of allOdds) {
              const val = parseFloat(od.getAttribute("data-odd") || "0");
              if (!isNaN(val)) oddValues.push(val);
            }
            if (oddValues.length >= 3) {
              [o1, ox, o2] = oddValues.slice(0, 3);
            }
          }

          // ID d'équipe - extrait de l'attribut data-team ou de l'URL
          const team1Link = cells[0]?.querySelector("a");
          const team2Link = cells[0]?.querySelectorAll("a")[1];
          const team1Id = team1Link ? parseInt(team1Link.getAttribute("data-team") || team1Link.href.match(/\/(\d+)\/?$/)?.[1] || "0") : "0";
          const team2Id = team2Link ? parseInt(team2Link.getAttribute("data-team") || team2Link.href.match(/\/(\d+)\/?$/)?.[1] || "0") : "0";

          results.push({
            team1Id: parseInt(team1Id),
            team1Name: team1Name,
            team2Id: parseInt(team2Id),
            team2Name: team2Name,
            odds1X2: { home: o1, draw: ox, away: o2 },
          });
        }

        return { matches: results };
      }, leagueKey);

      if (matches.matches.length > 0) {
        console.log(`  ✅ ${league.annonce}: ${matches.matches.length} matchs`);
      } else {
        console.log(`  ⚠️ ${league.annonce}: aucun match trouvé`);
      }

      output.leagues[leagueKey] = matches;
    } catch (err) {
      console.log(`  ❌ ${league.annonce}: ${err.message}`);
      output.leagues[leagueKey] = {
        matches: [],
        error: err.message,
      };
    }

    // Petit délai entre les ligues pour éviter le rate limiting
    await page.waitForTimeout(3000);
  }

  // Sauvegarder
  writeFileSync(OUT_FILE, JSON.stringify(output, null, 2), "utf-8");

  console.log(`\n[BetExplorer Hockey] ✅ Sauvegardé vers ${OUT_FILE}`);

  const totalMatches = Object.values(output.leagues)
    .reduce((sum, l) => sum + (l.matches ? l.matches.length : 0), 0);
  console.log(`  Total matchs: ${totalMatches}`);

  await browser.close();
}

main().catch((err) => {
  console.error("[BetExplorer Hockey] Erreur fatale:", err.message);
  process.exit(1);
});