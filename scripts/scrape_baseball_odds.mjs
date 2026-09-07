#!/usr/bin/env node
/**
 * scrape_baseball_odds.mjs
 *
 * Scraper Odds Baseball — KBO + MLB via BetExplorer
 * Stats lanceurs via MLB StatsAPI (probable pitchers)
 *
 * Usage:
 *   node scripts/scrape_baseball_odds.mjs              # tous
 *   node scripts/scrape_baseball_odds.mjs --league=KBO  # KBO uniquement
 *   node scripts/scrape_baseball_odds.mjs --league=MLB  # MLB uniquement
 *
 * Sortie: data/baseball_odds.json
 */

import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const OUT_DIR = join(import.meta.dirname, "..", "data");
const OUT_FILE = join(OUT_DIR, "baseball_odds.json");
const LEAGUE_FILTER = process.argv.find((a) => a.startsWith("--league="))?.split("=")[1];

const LEAGUES = [
  { id: "KBO", name: "KBO League", slug: "kbo-league", country: "south-korea", flag: "\u{1F1F0}\u{1F1F7}" },
  { id: "MLB", name: "MLB", slug: "mlb", country: "usa", flag: "\u{1F1FA}\u{1F1F8}" },
];

async function fetchMlbProbablePitchers(date) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 12000);
  try {
    const resp = await fetch(
      `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${date}&hydrate linescore,probablePitcher(stat(type=season))`,
      { headers: { "User-Agent": "PariScore/1.0" }, signal: ac.signal }
    );
    clearTimeout(timer);
    const data = await resp.json();
    const games = [];
    for (const game of data.dates?.[0]?.games || []) {
      const homePitcher = game.teams?.home?.probablePitcher;
      const awayPitcher = game.teams?.away?.probablePitcher;
      const homeStats = homePitcher?.stats?.[0]?.splits?.[0]?.stat;
      const awayStats = awayPitcher?.stats?.[0]?.splits?.[0]?.stat;
      games.push({
        gameId: game.gamePk,
        home: {
          team: game.teams?.home?.team?.name || "",
          teamId: game.teams?.home?.team?.id,
          pitcher: homePitcher ? {
            name: homePitcher.fullName,
            number: homePitcher.primaryNumber,
            era: homeStats?.era || null,
            whip: homeStats?.whip || null,
            kPer9: homeStats?.strikeoutsPer9Inn || null,
            ip: homeStats?.inningsPitched || null,
            wins: homeStats?.wins || 0,
            losses: homeStats?.losses || 0,
          } : null,
        },
        away: {
          team: game.teams?.away?.team?.name || "",
          teamId: game.teams?.away?.team?.id,
          pitcher: awayPitcher ? {
            name: awayPitcher.fullName,
            number: awayPitcher.primaryNumber,
            era: awayStats?.era || null,
            whip: awayStats?.whip || null,
            kPer9: awayStats?.strikeoutsPer9Inn || null,
            ip: awayStats?.inningsPitched || null,
            wins: awayStats?.wins || 0,
            losses: awayStats?.losses || 0,
          } : null,
        },
        gameTime: game.gameDate,
        status: game.status?.detailedState || "Scheduled",
      });
    }
    return games;
  } catch (err) {
    clearTimeout(timer);
    console.log(`  ❌ MLB StatsAPI: ${err.message}`);
    return [];
  }
}

async function scrapeLeagueOdds(page, league) {
  const url = `https://www.betexplorer.com/baseball/${league.slug}/`;
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.waitForTimeout(2500);

    if (page.url().includes("/block")) {
      console.log(`  \u274C ${league.id}: Bloqu\u00e9`);
      return [];
    }

    const matches = await page.evaluate((leagueId) => {
      const results = [];
      let currentSub = "";

      const rows = document.querySelectorAll("table tbody tr");
      for (const row of rows) {
        // League header
        const th = row.querySelector("th[colspan]");
        if (th) {
          currentSub = th.textContent?.trim() || "";
          continue;
        }

        const cells = row.querySelectorAll("td");
        if (cells.length < 4) continue;

        const time = cells[0]?.textContent?.trim() || "";
        const teams = cells[1]?.textContent?.trim() || "";
        const parts = teams.split(" - ");
        if (parts.length < 2) continue;

        const home = parts[0]?.trim() || "";
        const away = parts[1]?.trim() || "";

        // Odds: columns 2, 3, 4 typically
        const parseOdds = (cell) => {
          const val = parseFloat(cell?.textContent?.trim() || "");
          return val > 1 && val < 100 ? val : null;
        };

        results.push({
          league: leagueId,
          subLeague: currentSub,
          time,
          home,
          away,
          moneylineHome: parseOdds(cells[2]),
          moneylineAway: parseOdds(cells[3]),
          total: parseOdds(cells[4]) || parseOdds(cells[5]),
        });
      }
      return results;
    }, league.id);

    console.log(`  \u2705 ${league.id}: ${matches.length} matchs`);
    return matches;
  } catch (err) {
    console.log(`  \u274C ${league.id}: ${err.message}`);
    return [];
  }
}

async function main() {
  console.log(`[Baseball Odds] League: ${LEAGUE_FILTER || "ALL"}`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  const leaguesToScrape = LEAGUE_FILTER ? LEAGUES.filter((l) => l.id === LEAGUE_FILTER) : LEAGUES;
  const allMatches = [];

  for (const league of leaguesToScrape) {
    const matches = await scrapeLeagueOdds(page, league);
    allMatches.push(...matches);
    await page.waitForTimeout(1000);
  }

  // Fetch MLB probable pitchers
  const today = new Date().toISOString().slice(0, 10);
  console.log(`[Baseball Odds] Fetching MLB probable pitchers for ${today}...`);
  const mlbGames = await fetchMlbProbablePitchers(today);
  console.log(`  \u2705 ${mlbGames.length} games with pitchers`);

  // Cross-reference odds with pitcher stats
  for (const match of allMatches) {
    if (match.league === "MLB") {
      const game = mlbGames.find(
        (g) => g.home.team.toLowerCase().includes(match.home.toLowerCase().slice(0, 5)) ||
               g.away.team.toLowerCase().includes(match.away.toLowerCase().slice(0, 5))
      );
      if (game) {
        match.homePitcher = game.home.pitcher;
        match.awayPitcher = game.away.pitcher;
        match.gameTime = game.gameTime;
      }
    }
  }

  const output = {
    scraped_at: new Date().toISOString(),
    source: "betexplorer+mlb-statsapi",
    total: allMatches.length,
    matches: allMatches,
    mlbPitchers: mlbGames.length,
  };

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_FILE, JSON.stringify(output, null, 2), "utf-8");
  console.log(`\n[Baseball Odds] \u2705 ${allMatches.length} matchs \u2192 ${OUT_FILE}`);

  await browser.close();
}

main().catch((err) => {
  console.error("[Baseball Odds] Fatal:", err.message);
  process.exit(1);
});
