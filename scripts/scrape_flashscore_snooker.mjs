#!/usr/bin/env node
/**
 * scrape_flashscore_snooker.mjs
 *
 * Scrape les matchs snooker depuis FlashScore (calendrier du jour + cotes).
 * Utilise Playwright (déjà installé) pour contourner le rendu JS.
 *
 * Usage:
 *   node scripts/scrape_flashscore_snooker.mjs
 *   node scripts/scrape_flashscore_snooker.mjs --live
 *
 * Sortie: data/odds_flashscore_snooker.json
 */

import { chromium } from "playwright";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

const OUT_DIR = join(import.meta.dirname, "..", "data");
const OUT_FILE = join(OUT_DIR, "odds_flashscore_snooker.json");

const SNOOKER_URL = "https://www.flashscore.com/snooker/";
const SNOOKER_LIVE_URL = "https://www.flashscore.com/snooker/?live=true";

async function scrapeMatches(page, url, label) {
  console.log(`[FlashScore] Navigation → ${url}`);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

  // Attendre que les matchs se chargent
  await page.waitForSelector(".event__match, .sportName", { timeout: 15000 }).catch(() => null);
  await page.waitForTimeout(3000); // Laisser le JS finaliser

  // Extraire les données via évaluation dans le navigateur
  const matches = await page.evaluate(() => {
    const results = [];

    // Sélecteurs FlashScore pour les lignes de match
    const rows = document.querySelectorAll(
      '[class*="event__match"], [class*="event__matchWithReport"], [id^="g_1_"]'
    );

    for (const row of rows) {
      try {
        // ID du match
        const id = row.id?.replace("g_1_", "") || row.getAttribute("data-id") || "";
        if (!id) continue;

        // Heure
        const timeEl = row.querySelector('[class*="event__time"], .event__stage');
        const time = timeEl?.textContent?.trim() || "";

        // Équipes/joueurs
        const homeEl = row.querySelector('[class*="event__participant--home"], [class*="homeParticipant"]');
        const awayEl = row.querySelector('[class*="event__participant--away"], [class*="awayParticipant"]');
        const home = homeEl?.textContent?.trim() || "";
        const away = awayEl?.textContent?.trim() || "";
        if (!home || !away) continue;

        // Score
        const scoreHomeEl = row.querySelector('[class*="event__score--home"], [class*="homeScore"]');
        const scoreAwayEl = row.querySelector('[class*="event__score--away"], [class*="awayScore"]');
        const scoreHome = scoreHomeEl?.textContent?.trim() || "";
        const scoreAway = scoreAwayEl?.textContent?.trim() || "";

        // Statut (LIVE, finished, scheduled)
        const stageEl = row.querySelector('[class*="event__stage"]');
        const stage = stageEl?.textContent?.trim() || "";
        const isLive = row.classList.toString().includes("live") ||
          stage.toLowerCase().includes("live") ||
          stage.includes("'") || // ex: 3', 47'
          /^\d+\s*(?:Frame|Set)/i.test(stage);

        // Tournoi (remonter au header de groupe)
        let tournament = "";
        let el = row;
        while (el && el.previousElementSibling) {
          el = el.previousElementSibling;
          if (el.classList.toString().includes("event__header")) {
            const titleEl = el.querySelector('[class*="event__title"], [class*="category__title"]');
            tournament = titleEl?.textContent?.trim() || "";
            break;
          }
        }

        // Cotes 1X2 si disponibles
        const oddsEls = row.querySelectorAll('[class*="event__odd"], [class*="odds__odd"]');
        const odds = {};
        if (oddsEls.length >= 2) {
          odds.home = parseFloat(oddsEls[0]?.textContent?.trim()) || null;
          odds.draw = oddsEls.length >= 3 ? parseFloat(oddsEls[1]?.textContent?.trim()) || null : null;
          odds.away = oddsEls.length >= 3
            ? parseFloat(oddsEls[2]?.textContent?.trim()) || null
            : parseFloat(oddsEls[1]?.textContent?.trim()) || null;
        }

        results.push({
          id,
          tournament,
          home,
          away,
          scoreHome,
          scoreAway,
          time,
          stage,
          isLive,
          odds: odds.home ? odds : undefined,
        });
      } catch {
        // ignorer les lignes malformées
      }
    }

    return results;
  });

  console.log(`[FlashScore] ${label}: ${matches.length} matchs extraits`);
  return matches;
}

/** Scrape cotes: tente la page match, sinon accepte inline si dispo */
async function scrapeOddsDetail(page, matchId) {
  // Attempt to navigate to match odds page via Playwright (same session)
  // Note: FlashScore WAF may block datacenter IPs even in Playwright
  try {
    const url = `https://www.flashscore.com/match/${matchId}/#/match-summary/match-odds/1x2-odds`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => null);
    await page.waitForTimeout(2000);

    const odds = await page.evaluate(() => {
      const result = [];
      const rows = document.querySelectorAll('[class*="ui-table__row"],[class*="odds__row"],[class*="bettingTable"]');
      for (const row of rows) {
        const cells = row.querySelectorAll('td,div[class*="cell"]');
        const name = cells[0]?.textContent?.trim() || "";
        const vals = Array.from(cells).slice(1).map(c => parseFloat(c.textContent?.trim())).filter(v => !isNaN(v) && v > 1);
        if (name && vals.length >= 2) {
          result.push({ bookmaker: name, home: vals[0], draw: vals[1] ?? null, away: vals[2] ?? vals[1] ?? null });
        }
      }
      return result;
    });
    return odds.length > 0 ? odds : null;
  } catch { return null; }
}

async function main() {
  const liveOnly = process.argv.includes("--live");
  const noOdds = process.argv.includes("--no-odds");

  console.log("[FlashScore] Démarrage du navigateur...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    locale: "en-US",
  });
  const page = await context.newPage();

  const scrapedAt = new Date().toISOString();

  // 1. Scraper les matchs du jour
  const url = liveOnly ? SNOOKER_LIVE_URL : SNOOKER_URL;
  const matches = await scrapeMatches(page, url, liveOnly ? "live" : "today");

  // 2. Optionnel : récupérer les cotes détaillées pour chaque match
  if (!noOdds && matches.length > 0) {
    console.log(`[FlashScore] Récupération des cotes pour ${Math.min(matches.length, 10)} matchs...`);
    const toCheck = matches.slice(0, 10); // limiter pour éviter le rate limiting
    for (const m of toCheck) {
      if (m.odds) continue; // déjà des cotes
      const detailedOdds = await scrapeOddsDetail(page, m.id);
      if (detailedOdds) {
        m.detailedOdds = detailedOdds;
        // Prendre les cotes 1xbet si disponible
        const xbOdds = detailedOdds.find(
          (o) => o.bookmaker.toLowerCase().includes("1xbet") || o.bookmaker.toLowerCase().includes("1x")
        );
        if (xbOdds) {
          m.odds = { home: xbOdds.home, draw: xbOdds.draw, away: xbOdds.away, bookmaker: "1xbet" };
        }
      }
      await page.waitForTimeout(1000); // rate limiting
    }
  }

  await browser.close();

  // Stats
  const tournaments = [...new Set(matches.map((m) => m.tournament).filter(Boolean))];
  const liveCount = matches.filter((m) => m.isLive).length;
  const withOdds = matches.filter((m) => m.odds).length;

  const output = {
    scraped_at: scrapedAt,
    sport: "snooker",
    source: "flashscore.com",
    live_only: liveOnly,
    matches_count: matches.length,
    live_count: liveCount,
    with_odds: withOdds,
    tournaments,
    matches,
  };

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_FILE, JSON.stringify(output, null, 2), "utf-8");
  console.log(`\n[FlashScore] ✅ ${matches.length} matchs (${liveCount} live, ${withOdds} avec cotes) → ${OUT_FILE}`);
}

main().catch((err) => {
  console.error("[FlashScore] Erreur fatale:", err.message);
  process.exit(1);
});
