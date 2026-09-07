#!/usr/bin/env node
/**
 * scrape_betexplorer_calendar.mjs
 *
 * Scraper BetExplorer — calendriers multisport avec odds.
 * Sports: football, tennis, basketball, ice-hockey, volleyball, handball, baseball, esports
 *
 * Usage:
 *   node scripts/scrape_betexplorer_calendar.mjs                    # tous les sports
 *   node scripts/scrape_betexplorer_calendar.mjs --sport=football   # un sport
 *   node scripts/scrape_betexplorer_calendar.mjs --live             # matchs live uniquement
 *
 * Sortie: data/betexplorer_calendar.json
 */

import { chromium } from "playwright";
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "fs";
import { join } from "path";

const OUT_DIR = join(import.meta.dirname, "..", "data");
const OUT_FILE = join(OUT_DIR, "betexplorer_calendar.json");
const SPORT = process.argv.find((a) => a.startsWith("--sport="))?.split("=")[1];
const LIVE_ONLY = process.argv.includes("--live");

const SPORTS = [
  { id: "football", slug: "football", name: "Football", icon: "⚽" },
  { id: "tennis", slug: "tennis", name: "Tennis", icon: "🎾" },
  { id: "basketball", slug: "basketball", name: "Basketball", icon: "🏀" },
  { id: "ice-hockey", slug: "ice-hockey", name: "Ice Hockey", icon: "🏒" },
  { id: "volleyball", slug: "volleyball", name: "Volleyball", icon: "🏐" },
  { id: "handball", slug: "handball", name: "Handball", icon: "🤾" },
  { id: "baseball", slug: "baseball", name: "Baseball", icon: "⚾" },
  { id: "esports", slug: "esports", name: "Esports", icon: "🎮" },
];

async function scrapeSport(page, sport) {
  const url = LIVE_ONLY
    ? `https://www.betexplorer.com/${sport.slug}/live/`
    : `https://www.betexplorer.com/${sport.slug}/`;

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.waitForTimeout(2500);

    if (page.url().includes("/block") || page.url().includes("captcha")) {
      console.log(`  ❌ ${sport.name}: Bloqué`);
      return [];
    }

    const matches = await page.evaluate((sportId) => {
      const results = [];
      let currentLeague = "";
      let currentCountry = "";

      // Try multiple selector strategies
      const allRows = document.querySelectorAll(
        'table tbody tr, [class*="match"], [class*="event"], [class*="game"]'
      );

      for (const row of allRows) {
        // League header detection
        const headerEl = row.querySelector(
          '[class*="league"], [class*="tournament"], [class*="header"], th[colspan]'
        );
        if (headerEl) {
          const text = headerEl.textContent?.trim() || "";
          if (text.includes(" - ")) {
            const parts = text.split(" - ");
            currentCountry = parts[0]?.trim() || "";
            currentLeague = parts[1]?.trim() || text;
          } else {
            currentLeague = text;
          }
          continue;
        }

        // Match row — extract teams and odds
        const cells = row.querySelectorAll("td");
        if (cells.length < 3) continue;

        const timeEl = row.querySelector('[class*="time"], [class*="hour"]');
        const time = timeEl?.textContent?.trim() || cells[0]?.textContent?.trim() || "";

        // Team names
        const teamEls = row.querySelectorAll(
          '[class*="team"], [class*="participant"], [class*="name"]'
        );
        let home = "";
        let away = "";
        if (teamEls.length >= 2) {
          home = teamEls[0]?.textContent?.trim() || "";
          away = teamEls[1]?.textContent?.trim() || "";
        } else if (cells.length >= 3) {
          home = cells[1]?.textContent?.trim() || "";
          away = cells[2]?.textContent?.trim() || "";
        }

        if (!home || !away) continue;

        // Odds
        const oddsEls = row.querySelectorAll(
          '[class*="odd"], [class*="coeff"], [class*="price"], a[href*="odds"]'
        );
        const odds = [];
        for (const el of oddsEls) {
          const val = parseFloat(el.textContent?.trim() || "");
          if (val > 1 && val < 100) odds.push(val);
        }

        // Score (if live)
        const scoreEl = row.querySelector('[class*="score"], [class*="result"]');
        const score = scoreEl?.textContent?.trim() || null;

        // Status
        const isLive = row.classList?.contains("live") ||
          row.querySelector('[class*="live"], [class*="running"]') !== null;

        results.push({
          sport: sportId,
          country: currentCountry,
          league: currentLeague,
          time,
          home,
          away,
          odds: odds.slice(0, 3), // [home, draw, away] or [home, away]
          score,
          isLive,
        });
      }

      return results;
    }, sport.id);

    console.log(`  ✅ ${sport.name}: ${matches.length} matchs`);
    return matches;
  } catch (err) {
    console.log(`  ❌ ${sport.name}: ${err.message}`);
    return [];
  }
}

async function main() {
  console.log(`[BetExplorer Calendar] Sport: ${SPORT || "all"}, Live: ${LIVE_ONLY}`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  const sportsToScrape = SPORT ? SPORTS.filter((s) => s.id === SPORT) : SPORTS;
  const allMatches = [];

  for (const sport of sportsToScrape) {
    const matches = await scrapeSport(page, sport);
    allMatches.push(...matches);
    await page.waitForTimeout(1000);
  }

  const scrapedAt = new Date().toISOString();

  // Load existing data to merge
  let existing = { matches: [] };
  if (existsSync(OUT_FILE)) {
    try {
      existing = JSON.parse(readFileSync(OUT_FILE, "utf-8"));
    } catch {}
  }

  // Merge: replace same sport matches, keep others
  const sportIds = sportsToScrape.map((s) => s.id);
  const keptMatches = (existing.matches || []).filter(
    (m) => !sportIds.includes(m.sport)
  );

  const output = {
    scraped_at: scrapedAt,
    source: "betexplorer",
    live_only: LIVE_ONLY,
    total: keptMatches.length + allMatches.length,
    matches: [...keptMatches, ...allMatches],
  };

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_FILE, JSON.stringify(output, null, 2), "utf-8");
  console.log(
    `\n[BetExplorer Calendar] ✅ ${output.total} matchs → ${OUT_FILE}`
  );

  await browser.close();
}

main().catch((err) => {
  console.error("[BetExplorer Calendar] Fatal:", err.message);
  process.exit(1);
});
