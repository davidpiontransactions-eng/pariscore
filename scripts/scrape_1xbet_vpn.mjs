#!/usr/bin/env node
/**
 * scrape_1xbet_vpn.mjs
 *
 * Scraper 1xbet/1xwin via VPN CyberGhost pour récupérer:
 * - Calendrier des matchs multisport (tous sports)
 * - Cotes 1X2 de 1xbet
 *
 * Usage:
 *   node scripts/scrape_1xbet_vpn.mjs                     # tous les sports
 *   node scripts/scrape_1xbet_vpn.mjs --sport=snooker     # un sport
 *   node scripts/scrape_1xbet_vpn.mjs --live               # mode live uniquement
 *
 * Prérequis: VPN actif sur le VPS (OpenVPN CyberGhost)
 * Sortie: data/odds_1xbet_{sport}.json ou data/odds_1xbet_all.json
 */

import { chromium } from "playwright";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

const OUT_DIR = join(import.meta.dirname, "..", "data");

// Sports supportés par 1xbet avec leurs slugs URL
const SPORTS = {
  snooker: { slug: "snooker", id: "snooker" },
  football: { slug: "football", id: "football" },
  tennis: { slug: "tennis", id: "tennis" },
  basketball: { slug: "basketball", id: "basketball" },
  hockey: { slug: "hockey", id: "ice-hockey" },
  esports: { slug: "esports", id: "esports" },
  mma: { slug: "mma", id: "mma" },
  boxing: { slug: "boxing", id: "boxing" },
  handball: { slug: "handball", id: "handball" },
  volleyball: { slug: "volleyball", id: "volleyball" },
  tabletennis: { slug: "table-tennis", id: "table-tennis" },
  darts: { slug: "darts", id: "darts" },
  cricket: { slug: "cricket", id: "cricket" },
};

// Domaines 1xbet à tester (par priorité)
const DOMAINS = [
  "https://1xbet.com",
  "https://1xbet.kz",
  "https://1x-bet.fr",
];

function parseArgs() {
  const args = process.argv.slice(2);
  const sportArg = args.find((a) => a.startsWith("--sport="));
  const liveOnly = args.includes("--live");
  return {
    sport: sportArg ? sportArg.split("=")[1] : null,
    liveOnly,
  };
}

async function findWorkingDomain(page) {
  for (const domain of DOMAINS) {
    try {
      const resp = await page.goto(`${domain}/en/line/all`, {
        waitUntil: "domcontentloaded",
        timeout: 15000,
      });
      const finalUrl = page.url();
      if (!finalUrl.includes("/block") && resp?.status() === 200) {
        console.log(`[1xbet] Domaine actif: ${domain}`);
        return domain;
      }
    } catch {}
  }
  return null;
}

async function scrapeSport(page, domain, sport, liveOnly) {
  const lineUrl = liveOnly
    ? `${domain}/en/live/${sport.slug}`
    : `${domain}/en/line/${sport.slug}`;

  console.log(`[1xbet] Scraping ${sport.slug}: ${lineUrl}`);

  try {
    await page.goto(lineUrl, { waitUntil: "domcontentloaded", timeout: 20000 });

    // Vérifier le blocage
    if (page.url().includes("/block")) {
      console.log(`  ❌ Bloqué → /block`);
      return { sport: sport.slug, error: "blocked", matches: [] };
    }

    // Attendre le chargement JS
    await page.waitForTimeout(5000);

    // Extraire les données
    const data = await page.evaluate((sportName) => {
      const matches = [];
      const tournaments = [];

      // Sélecteurs 1xbet pour les lignes de match
      // La structure HTML de 1xbet utilise des classes comme:
      // c-events__item, c-events-total__item, sport-name, etc.
      const eventItems = document.querySelectorAll(
        '[class*="c-events__item"], [class*="event-row"], [class*="sport-event"]'
      );

      for (const item of eventItems) {
        try {
          // Nom des joueurs/équipes
          const teams = item.querySelectorAll(
            '[class*="c-events__team"], [class*="participant"], [class*="team-name"]'
          );
          const home = teams[0]?.textContent?.trim() || "";
          const away = teams[1]?.textContent?.trim() || "";
          if (!home || !away) continue;

          // Score
          const scoreEls = item.querySelectorAll(
            '[class*="score"], [class*="result"]'
          );
          const scoreHome = scoreEls[0]?.textContent?.trim() || "";
          const scoreAway = scoreEls[1]?.textContent?.trim() || "";

          // Cotes 1X2
          const oddsEls = item.querySelectorAll(
            '[class*="bet"], [class*="odd"], [class*="coef"]'
          );
          const odds = Array.from(oddsEls)
            .map((el) => parseFloat(el.textContent?.trim()))
            .filter((v) => !isNaN(v) && v > 1);

          // Heure
          const timeEl = item.querySelector(
            '[class*="time"], [class*="date"]'
          );
          const time = timeEl?.textContent?.trim() || "";

          // Statut live
          const isLive = item.classList.toString().includes("live") ||
            item.querySelector('[class*="live"]') !== null;

          matches.push({
            home,
            away,
            scoreHome,
            scoreAway,
            time,
            isLive,
            odds1x2: odds.length >= 3
              ? { home: odds[0], draw: odds[1], away: odds[2] }
              : odds.length >= 2
                ? { home: odds[0], away: odds[1] }
                : null,
          });
        } catch {}
      }

      // Headers de tournoi
      const headers = document.querySelectorAll(
        '[class*="c-events__head"], [class*="tournament"], [class*="league"]'
      );
      for (const h of headers) {
        const name = h.textContent?.trim().substring(0, 80);
        if (name) tournaments.push(name);
      }

      return { matches, tournaments };
    }, sport.slug);

    console.log(`  ✅ ${data.matches.length} matchs, ${data.tournaments.length} tournois`);
    return { sport: sport.slug, ...data };
  } catch (err) {
    console.log(`  ❌ Erreur: ${err.message}`);
    return { sport: sport.slug, error: err.message, matches: [] };
  }
}

async function main() {
  const { sport, liveOnly } = parseArgs();
  const sportsToScrape = sport ? [SPORTS[sport]] : Object.values(SPORTS);

  console.log("[1xbet] Démarrage du navigateur...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    viewport: { width: 1920, height: 1080 },
  });
  const page = await context.newPage();

  // 1. Trouver un domaine actif
  const domain = await findWorkingDomain(page);
  if (!domain) {
    console.log("[1xbet] ❌ Aucun domaine accessible. Vérifiez le VPN.");
    await browser.close();
    process.exit(1);
  }

  // 2. Scraper chaque sport
  const results = {};
  for (const s of sportsToScrape) {
    if (!s) continue;
    const data = await scrapeSport(page, domain, s, liveOnly);
    results[s.slug] = data;
  }

  await browser.close();

  // 3. Sauvegarder
  const scrapedAt = new Date().toISOString();
  const totalMatches = Object.values(results).reduce(
    (sum, r) => sum + (r.matches?.length || 0),
    0
  );

  const output = {
    scraped_at: scrapedAt,
    source: "1xbet",
    domain,
    live_only: liveOnly,
    total_matches: totalMatches,
    sports: results,
  };

  mkdirSync(OUT_DIR, { recursive: true });

  if (sport) {
    const file = join(OUT_DIR, `odds_1xbet_${sport}.json`);
    writeFileSync(file, JSON.stringify(output, null, 2), "utf-8");
    console.log(`\n[1xbet] ✅ ${totalMatches} matchs → ${file}`);
  } else {
    const file = join(OUT_DIR, "odds_1xbet_all.json");
    writeFileSync(file, JSON.stringify(output, null, 2), "utf-8");
    console.log(`\n[1xbet] ✅ ${totalMatches} matchs (tous sports) → ${file}`);
  }
}

main().catch((err) => {
  console.error("[1xbet] Erreur fatale:", err.message);
  process.exit(1);
});
