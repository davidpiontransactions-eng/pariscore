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

/** Récupère les cotes via FlareSolverr (contourne WAF Cloudflare sur VPS) */
async function scrapeOddsViaFlareSolverr(matchId) {
  const url = `https://www.flashscore.com/match/${matchId}/#/match-summary/match-odds/1x2-odds`;
  const flareApi = process.env.FLARESOLVERR_URL || "http://localhost:8191/v1";
  try {
    const payload = {
      cmd: "request.get",
      url,
      maxTimeout: 15000,
      session: "snooker-odds",
    };
    const res = await fetch(flareApi, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const html = data?.solution?.response || data?.solution?.html || "";
    if (!html) return null;

    const odds = [];
    const bookmakerRegex = /<span[^>]*class="bookmaker[^"]*"[^>]*>([^<]+)<\/span>/gi;
    const oddsRegex = /<span[^>]*class="odds__odd[^"]*"[^>]*>([\d.]+)<\/span>/gi;
    const bookmakers = [...html.matchAll(bookmakerRegex)].map(m => m[1].trim());
    const oddValues = [...html.matchAll(oddsRegex)].map(m => parseFloat(m[1]));
    for (let i = 0; i < bookmakers.length; i++) {
      if (oddValues[i * 3] && oddValues[i * 3 + 2]) {
        odds.push({ bookmaker: bookmakers[i], home: oddValues[i * 3], draw: oddValues[i * 3 + 1] ?? null, away: oddValues[i * 3 + 2] });
      }
    }
    return odds.length > 0 ? odds : null;
  } catch { return null; }
}

/** Scrape cotes d'un match: FlareSolverr first, Playwright fallback */
async function scrapeOddsDetail(page, matchId) {
  const fsOdds = await scrapeOddsViaFlareSolverr(matchId);
  if (fsOdds) return fsOdds;
  // Fallback Playwright
  try {
    const url = `https://www.flashscore.com/match/${matchId}/#/match-summary/match-odds/1x2-odds`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(2000);
    const odds = await page.evaluate(() => {
      const bookmakerOdds = [];
      const rows = document.querySelectorAll('[class*="ui-table__row"], [class*="odds__row"]');
      for (const row of rows) {
        const name = row.querySelector('[class*="bookmaker"], [class*="participant"]')?.textContent?.trim() || "";
        const oddEls = row.querySelectorAll('[class*="odds__odd"], [class*="event__odd"]');
        const values = Array.from(oddEls).map((el) => parseFloat(el.textContent?.trim()) || null).filter(Boolean);
        if (name && values.length >= 2) {
          bookmakerOdds.push({ bookmaker: name, home: values[0], draw: values[1] ?? null, away: values[2] ?? values[1] ?? null });
        }
      }
      return bookmakerOdds;
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
