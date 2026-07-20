#!/usr/bin/env node
/**
 * scrap-tennistemple.ts — Scrap le calendrier ATP/WTA de TennisTemple.
 *
 * TennisTemple n'a pas d'API publique → scraping respectueux :
 *   - User-Agent réaliste
 *   - Respect robots.txt (vérifié : "index, follow" sur les pages cibles)
 *   - Délai 500ms entre requêtes
 *   - Retry sur 429/503
 *
 * Usage :
 *   npx tsx scripts/scrap-tennistemple.ts                 # today, ATP+WTA
 *   npx tsx scripts/scrap-tennistemple.ts --year 2026     # calendrier année
 *   npx tsx scripts/scrap-tennistemple.ts --tour atp      # ATP seulement
 *
 * Output : data/tennis-schedule-<date>.json (créé si manquant)
 */

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  parseTennisTempleSchedule,
  parseTennisTempleTournaments,
  type ParsedScheduleEntry,
  type ParsedTournament,
} from "../src/lib/tennistemple-parser";

const ATP_BASE = "https://en.tennistemple.com/competitions/atp";
const WTA_BASE = "https://en.tennistemple.com/competitions/wta";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const OUTPUT_DIR = join(process.cwd(), "data");

type CliArgs = {
  year: number;
  tour: "atp" | "wta" | "both";
};

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    year: new Date().getFullYear(),
    tour: "both",
  };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--year" && argv[i + 1]) {
      args.year = parseInt(argv[++i], 10);
    } else if (arg === "--tour" && argv[i + 1]) {
      const v = argv[++i];
      if (v === "atp" || v === "wta" || v === "both") args.tour = v;
    } else if (arg === "--help" || arg === "-h") {
      console.log(`Usage: npx tsx scripts/scrap-tennistemple.ts [--year <YYYY>] [--tour atp|wta|both]
Defaults: --year ${new Date().getFullYear()} --tour both`);
      process.exit(0);
    }
  }
  return args;
}

async function fetchWithRetry(
  url: string,
  retries = 2,
  delayMs = 500,
): Promise<string> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9",
          "Accept-Language": "en-US,en;q=0.9,fr;q=0.8",
          "Cache-Control": "no-cache",
        },
        redirect: "follow",
      });

      if (res.status === 429 || res.status >= 500) {
        if (attempt < retries) {
          const wait = delayMs * Math.pow(2, attempt);
          console.warn(
            `⚠️  ${res.status} sur ${url} — retry dans ${wait}ms (attempt ${attempt + 1}/${retries})`,
          );
          await new Promise((r) => setTimeout(r, wait));
          continue;
        }
        throw new Error(`HTTP ${res.status} after ${retries} retries`);
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }

      return await res.text();
    } catch (err) {
      if (attempt < retries) {
        const wait = delayMs * Math.pow(2, attempt);
        console.warn(
          `⚠️  Erreur ${err instanceof Error ? err.message : err} — retry dans ${wait}ms`,
        );
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      throw err;
    }
  }
  throw new Error("unreachable");
}

async function scrapOne(
  base: string,
  year: number,
  label: "ATP" | "WTA",
): Promise<{ schedule: ParsedScheduleEntry[]; tournaments: ParsedTournament[] }> {
  const url = `${base}/${year}`;
  console.log(`🔍 Scraping ${label} : ${url}`);
  const html = await fetchWithRetry(url);
  console.log(`   HTML récupéré : ${html.length} caractères`);

  const today = new Date().toISOString().slice(0, 10);
  const schedule = parseTennisTempleSchedule(html, today);
  const tournaments = parseTennisTempleTournaments(html, year);

  console.log(`   ✓ ${schedule.length} matchs today, ${tournaments.length} tournois`);
  return { schedule, tournaments };
}

async function main() {
  const args = parseArgs(process.argv);
  console.log(`📅 TennisTemple scraper — year=${args.year} tour=${args.tour}`);

  const allSchedule: ParsedScheduleEntry[] = [];
  const allTournaments: ParsedTournament[] = [];

  if (args.tour === "atp" || args.tour === "both") {
    try {
      const atp = await scrapOne(ATP_BASE, args.year, "ATP");
      allSchedule.push(...atp.schedule);
      allTournaments.push(...atp.tournaments);
    } catch (err) {
      console.error(`❌ Échec ATP : ${err instanceof Error ? err.message : err}`);
    }
  }

  if (args.tour === "wta" || args.tour === "both") {
    await new Promise((r) => setTimeout(r, 500)); // delay respectueux
    try {
      const wta = await scrapOne(WTA_BASE, args.year, "WTA");
      allSchedule.push(...wta.schedule);
      allTournaments.push(...wta.tournaments);
    } catch (err) {
      console.error(`❌ Échec WTA : ${err instanceof Error ? err.message : err}`);
    }
  }

  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const today = new Date().toISOString().slice(0, 10);
  const schedulePath = join(OUTPUT_DIR, `tennis-schedule-${today}.json`);
  const tournamentsPath = join(OUTPUT_DIR, `tennis-tournaments-${args.year}.json`);

  const schedulePayload = {
    date: today,
    scrappedAt: new Date().toISOString(),
    source: "tennistemple",
    count: allSchedule.length,
    entries: allSchedule,
  };

  const tournamentsPayload = {
    year: args.year,
    scrappedAt: new Date().toISOString(),
    source: "tennistemple",
    count: allTournaments.length,
    tournaments: allTournaments,
  };

  mkdirSync(dirname(schedulePath), { recursive: true });
  writeFileSync(schedulePath, JSON.stringify(schedulePayload, null, 2));
  console.log(`💾 Schedule écrit : ${schedulePath} (${allSchedule.length} entrées)`);

  writeFileSync(tournamentsPath, JSON.stringify(tournamentsPayload, null, 2));
  console.log(`💾 Tournaments écrit : ${tournamentsPath} (${allTournaments.length} tournois)`);

  console.log("\n✅ Scraping terminé");
}

main().catch((err) => {
  console.error("💥 Erreur fatale :", err);
  process.exit(1);
});
