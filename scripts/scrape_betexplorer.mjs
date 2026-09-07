#!/usr/bin/env node
/**
 * scrape_betexplorer.mjs
 *
 * Scraper BetExplorer pour les dropping odds et les streaks d'équipes.
 * Utilise Playwright pour le rendu JS.
 *
 * Usage:
 *   node scripts/scrape_betexplorer.mjs                    # dropping odds du jour
 *   node scripts/scrape_betexplorer.mjs --streaks          # streaks top ligues
 *   node scripts/scrape_betexplorer.mjs --period=24h       # fenêtre de temps
 *
 * Sortie: data/betexplorer_dropping.json / data/betexplorer_streaks.json
 */

import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const OUT_DIR = join(import.meta.dirname, "..", "data");
const PERIOD = process.argv.find((a) => a.startsWith("--period="))?.split("=")[1] || "24h";
const MODE = process.argv.includes("--streaks") ? "streaks" : "dropping";

// Top ligues à scraper pour les streaks
const TOP_LEAGUES = [
  { country: "england", league: "premier-league", name: "Premier League" },
  { country: "spain", league: "la-liga", name: "La Liga" },
  { country: "germany", league: "bundesliga", name: "Bundesliga" },
  { country: "italy", league: "serie-a", name: "Serie A" },
  { country: "france", league: "ligue-1", name: "Ligue 1" },
  { country: "netherlands", league: "eredivisie", name: "Eredivisie" },
  { country: "portugal", league: "liga-portugal", name: "Liga Portugal" },
  { country: "turkey", league: "super-lig", name: "Super Lig" },
];

async function scrapeDroppingOdds(page) {
  console.log("[BetExplorer] Scraping dropping odds...");
  const url = `https://www.betexplorer.com/football/dropping-odds/?period=${PERIOD}&matches=today&droppers=30`;

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(3000);

    // Vérifier si on est sur une page valide
    if (page.url().includes("/block") || page.url().includes("captcha")) {
      console.log("  ❌ Bloqué / captcha");
      return [];
    }

    const matches = await page.evaluate(() => {
      const results = [];
      let currentLeague = "";

      // Parcourir toutes les lignes (headers + matchs)
      const rows = document.querySelectorAll(
        '[class*="dropping"], table tr, [class*="match-row"], [class*="event-row"]'
      );

      for (const row of rows) {
        // Header de ligue
        const leagueEl = row.querySelector('[class*="league"], [class*="tournament"], th[colspan]');
        if (leagueEl) {
          currentLeague = leagueEl.textContent?.trim() || "";
          continue;
        }

        // Ligne de match
        const cells = row.querySelectorAll("td");
        if (cells.length < 3) continue;

        const time = cells[0]?.textContent?.trim() || "";
        const homeEl = row.querySelector('[class*="home"], [class*="team1"]');
        const awayEl = row.querySelector('[class*="away"], [class*="team2"]');
        const home = homeEl?.textContent?.trim() || cells[1]?.textContent?.trim() || "";
        const away = awayEl?.textContent?.trim() || cells[2]?.textContent?.trim() || "";

        if (!home || !away) continue;

        // Cotes en baisse
        const dropCells = row.querySelectorAll('[class*="drop"], [class*="shorten"]');
        const drops = [];
        for (const dc of dropCells) {
          const text = dc.textContent?.trim();
          if (text) drops.push(text);
        }

        // Pourcentage de bookmakers
        const pctEl = row.querySelector('[class*="pct"], [class*="percent"]');
        const dropPct = parseFloat(pctEl?.textContent?.replace("%", "") || "0");

        if (home && away) {
          results.push({
            league: currentLeague,
            time,
            home,
            away,
            dropPct,
            drops,
          });
        }
      }

      return results;
    });

    console.log(`  ✅ ${matches.length} matchs avec dropping odds`);
    return matches;
  } catch (err) {
    console.log(`  ❌ Erreur: ${err.message}`);
    return [];
  }
}

async function scrapeTeamStreaks(page, league) {
  const url = `https://www.betexplorer.com/football/${league.country}/${league.league}/standings/`;

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.waitForTimeout(2000);

    if (page.url().includes("/block")) {
      return null;
    }

    const standings = await page.evaluate(() => {
      const teams = [];
      const rows = document.querySelectorAll(
        'table.standing tbody tr, [class*="standing"] tr'
      );

      for (const row of rows) {
        const cells = row.querySelectorAll("td");
        if (cells.length < 5) continue;

        const rank = parseInt(cells[0]?.textContent?.trim() || "0");
        const teamEl = row.querySelector('[class*="team"], a');
        const team = teamEl?.textContent?.trim() || cells[1]?.textContent?.trim() || "";
        const played = parseInt(cells[2]?.textContent?.trim() || "0");
        const wins = parseInt(cells[3]?.textContent?.trim() || "0");
        const draws = parseInt(cells[4]?.textContent?.trim() || "0");
        const losses = parseInt(cells[5]?.textContent?.trim() || "0");
        const gf = parseInt(cells[6]?.textContent?.trim() || "0");
        const ga = parseInt(cells[7]?.textContent?.trim() || "0");
        const gd = parseInt(cells[8]?.textContent?.trim() || "0");
        const pts = parseInt(cells[9]?.textContent?.trim() || "0");

        if (team && played > 0) {
          teams.push({
            rank,
            team,
            played,
            wins,
            draws,
            losses,
            goalsFor: gf,
            goalsAgainst: ga,
            goalDifference: gd,
            points: pts,
            winPct: played > 0 ? (wins / played) * 100 : 0,
            bttsPct: 0, // will be computed from match data
          });
        }
      }

      return teams;
    });

    return {
      league: league.name,
      country: league.country,
      slug: league.league,
      teams: standings || [],
    };
  } catch (err) {
    console.log(`  ❌ ${league.name}: ${err.message}`);
    return null;
  }
}

async function main() {
  console.log(`[BetExplorer] Mode: ${MODE}, Période: ${PERIOD}`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  const scrapedAt = new Date().toISOString();

  if (MODE === "dropping") {
    const matches = await scrapeDroppingOdds(page);
    const output = {
      scraped_at: scrapedAt,
      source: "betexplorer",
      period: PERIOD,
      total: matches.length,
      matches,
    };
    mkdirSync(OUT_DIR, { recursive: true });
    const file = join(OUT_DIR, "betexplorer_dropping.json");
    writeFileSync(file, JSON.stringify(output, null, 2), "utf-8");
    console.log(`\n[BetExplorer] ✅ ${matches.length} dropping odds → ${file}`);
  } else {
    const leagues = [];
    for (const league of TOP_LEAGUES) {
      console.log(`[BetExplorer] ${league.name}...`);
      const data = await scrapeTeamStreaks(page, league);
      if (data) {
        leagues.push(data);
        console.log(`  ✅ ${data.teams.length} équipes`);
      }
      await page.waitForTimeout(1500);
    }
    const output = {
      scraped_at: scrapedAt,
      source: "betexplorer",
      total_leagues: leagues.length,
      total_teams: leagues.reduce((s, l) => s + l.teams.length, 0),
      leagues,
    };
    mkdirSync(OUT_DIR, { recursive: true });
    const file = join(OUT_DIR, "betexplorer_streaks.json");
    writeFileSync(file, JSON.stringify(output, null, 2), "utf-8");
    console.log(`\n[BetExplorer] ✅ ${leagues.length} ligues → ${file}`);
  }

  await browser.close();
}

main().catch((err) => {
  console.error("[BetExplorer] Erreur fatale:", err.message);
  process.exit(1);
});
