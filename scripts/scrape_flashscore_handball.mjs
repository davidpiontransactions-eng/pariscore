#!/usr/bin/env node
/**
 * scrape_flashscore_handball.mjs
 *
 * Scrape les matchs handball depuis FlashScore (calendrier du jour + cotes).
 * Utilise Playwright (déjà installé) pour contourner le rendu JS.
 *
 * Usage:
 *   node scripts/scrape_flashscore_handball.mjs
 *   node scripts/scrape_flashscore_handball.mjs --live
 *
 * Sortie: data/flashscore_handball.json
 */

import { chromium } from "playwright";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

const OUT_DIR = join(import.meta.dirname, "..", "data");
const OUT_FILE = join(OUT_DIR, "flashscore_handball.json");

const HANDBALL_URL = "https://www.flashscore.com/handball/";
const HANDBALL_LIVE_URL = "https://www.flashscore.com/handball/?live=true";

// FlashScore date parameter: ?d1=YYYYMMDD
function todayUrl() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `https://www.flashscore.com/handball/?d1=${y}${m}${day}`;
}

function tomorrowUrl() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `https://www.flashscore.com/handball/?d1=${y}${m}${day}`;
}

async function scrapeMatches(page, url, label) {
  console.log(`[FlashScore Handball] Navigation → ${url}`);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

  // Attendre que les matchs se chargent
  await page.waitForSelector(".event__match, .sportName, [class*='event']", { timeout: 15000 }).catch(() => null);
  await page.waitForTimeout(3000);

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

        // Équipes
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
          stage.includes("'"); // ex: 45'

        const isFinished = stage.toLowerCase().includes("finished") ||
          stage.toLowerCase().includes("ft") ||
          stage.toLowerCase().includes("ended");

        // Ligue (depuis le header précédent)
        let league = "";
        let country = "";
        let prev = row.previousElementSibling;
        while (prev) {
          if (prev.classList.toString().includes("event__header") ||
              prev.classList.toString().includes("league")) {
            const leagueEl = prev.querySelector('[class*="event__title"], [class*="league"]');
            const countryEl = prev.querySelector('[class*="event__title--type"], [class*="country"]');
            league = leagueEl?.textContent?.trim() || "";
            country = countryEl?.textContent?.trim() || "";
            break;
          }
          prev = prev.previousElementSibling;
        }

        // Cotes
        const oddsEls = row.querySelectorAll('[class*="odds"], [class*="event__odd"], a[class*="odd"]');
        const odds = [];
        for (const el of oddsEls) {
          const val = parseFloat(el.textContent?.trim() || "");
          if (val > 1 && val < 100) odds.push(val);
        }

        results.push({
          id,
          time,
          home,
          away,
          score: scoreHome && scoreAway ? `${scoreHome} - ${scoreAway}` : null,
          isLive,
          isFinished,
          league,
          country,
          odds: odds.slice(0, 3), // [home, draw, away] ou [home, away]
        });
      } catch (e) {
        // Skip malformed rows
      }
    }

    return results;
  });

  console.log(`[FlashScore Handball] ${label}: ${matches.length} matchs`);
  return matches;
}

async function main() {
  const args = process.argv.slice(2);
  const liveOnly = args.includes("--live");
  const sport = args.find((a) => a.startsWith("--sport="))?.split("=")[1] || "handball";

  console.log(`[FlashScore Handball] Sport: ${sport}, Live: ${liveOnly}`);

  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-blink-features=AutomationControlled"],
  });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  let allMatches = [];

  if (liveOnly) {
    // Scrape live uniquement
    const liveMatches = await scrapeMatches(page, HANDBALL_LIVE_URL, "Live");
    allMatches.push(...liveMatches);
  } else {
    // Scrape aujourd'hui + demain
    const todayMatches = await scrapeMatches(page, todayUrl(), "Aujourd'hui");
    allMatches.push(...todayMatches);

    // Petit délai entre les pages
    await page.waitForTimeout(2000);

    const tomorrowMatches = await scrapeMatches(page, tomorrowUrl(), "Demain");
    allMatches.push(...tomorrowMatches);
  }

  // Dédupliquer par ID
  const seen = new Set();
  allMatches = allMatches.filter((m) => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });

  const output = {
    scraped_at: new Date().toISOString(),
    source: "flashscore",
    sport: "handball",
    live_only: liveOnly,
    total: allMatches.length,
    matches: allMatches,
  };

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_FILE, JSON.stringify(output, null, 2), "utf-8");
  console.log(`\n[FlashScore Handball] ✅ ${output.total} matchs → ${OUT_FILE}`);

  await browser.close();
}

main().catch((err) => {
  console.error("[FlashScore Handball] Fatal:", err.message);
  process.exit(1);
});
