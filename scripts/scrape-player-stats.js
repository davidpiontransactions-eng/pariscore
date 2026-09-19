/**
 * scrape-player-stats.js — Récupère les top buteurs/passeurs depuis football-data.org
 * 
 * Source : https://api.football-data.org/v4/competitions/{code}/scorers
 * Données : buts, passes décisives, apparitions, minutes jouées
 * 
 * Run : node scripts/scrape-player-stats.js
 * Output : data/player-stats.json
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import https from "https";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUTPUT_DIR = join(ROOT, "data");
const OUTPUT_FILE = join(OUTPUT_DIR, "player-stats.json");

// Clé API football-data.org
const API_KEY = process.env.FOOTBALL_DATA_KEY || "fafba7e8f6574bb2a5ce7cab8d021f00";
const BASE_URL = "https://api.football-data.org/v4";

// Ligues à scraper (codes football-data.org)
const LEAGUES = [
  { code: "PL", name: "Premier League", slug: "epl" },
  { code: "PD", name: "La Liga", slug: "laliga" },
  { code: "BL1", name: "Bundesliga", slug: "bundesliga" },
  { code: "SA", name: "Serie A", slug: "seriea" },
  { code: "FL1", name: "Ligue 1", slug: "ligue1" },
  { code: "CL", name: "Champions League", slug: "champions_league" },
  { code: "DED", name: "Eredivisie", slug: "eredivisie" },
  { code: "PPL", name: "Primeira Liga", slug: "primeira_liga" },
  { code: "BSA", name: "Brasileirão", slug: "brasileirao_a" },
  { code: "MLS", name: "MLS", slug: "mls" },
];

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        "X-Auth-Token": API_KEY,
        "User-Agent": "PariScore/1.0 (https://pariscore.fr)",
      },
      timeout: 15000,
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => data += chunk);
      res.on("end", () => {
        if (res.statusCode === 200) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`JSON parse error: ${e.message}`));
          }
        } else if (res.statusCode === 429) {
          reject(new Error("Rate limited (429)"));
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("Timeout")); });
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function fetchTopScorers(leagueCode) {
  try {
    const url = `${BASE_URL}/competitions/${leagueCode}/scorers?limit=20`;
    const data = await httpsGet(url);
    
    if (!data.scorers || !Array.isArray(data.scorers)) {
      console.warn(`[player-stats] No scorers for ${leagueCode}`);
      return [];
    }

    return data.scorers.map((s, i) => ({
      rank: i + 1,
      player: {
        id: s.player?.id,
        name: s.player?.name,
        firstName: s.player?.firstName,
        lastName: s.player?.lastName,
        dateOfBirth: s.player?.dateOfBirth,
        nationality: s.player?.nationality,
        position: s.player?.position,
        section: s.player?.section,
      },
      team: {
        id: s.team?.id,
        name: s.team?.name,
        shortName: s.team?.shortName,
        tla: s.team?.tla,
        crest: s.team?.crest,
      },
      goals: s.goals ?? 0,
      assists: s.assists ?? 0,
      penalties: s.penalties ?? 0,
      playedMatches: s.playedMatches ?? 0,
      minutesPlayed: s.minutesPlayed ?? 0,
      minutesPerGoal: s.goals > 0 ? Math.round(s.minutesPlayed / s.goals) : null,
    }));
  } catch (err) {
    console.error(`[player-stats] Error fetching ${leagueCode}:`, err.message);
    return [];
  }
}

async function main() {
  console.log("[player-stats] Starting scrape...");
  
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const allData = {
    meta: {
      source: "football-data.org",
      scrapedAt: new Date().toISOString(),
      leagues: LEAGUES.map(l => l.slug),
    },
    leagues: {},
  };

  for (const league of LEAGUES) {
    console.log(`[player-stats] Fetching ${league.name} (${league.code})...`);
    
    const scorers = await fetchTopScorers(league.code);
    
    allData.leagues[league.slug] = {
      name: league.name,
      code: league.code,
      scorers,
    };

    // Rate limit: 10 req/min pour le tier gratuit
    await sleep(6500);
  }

  writeFileSync(OUTPUT_FILE, JSON.stringify(allData, null, 2), "utf-8");
  
  const totalPlayers = Object.values(allData.leagues)
    .reduce((sum, l) => sum + l.scorers.length, 0);
  
  console.log(`[player-stats] Done! ${totalPlayers} players across ${LEAGUES.length} leagues`);
  console.log(`[player-stats] Output: ${OUTPUT_FILE}`);
}

main().catch(console.error);
