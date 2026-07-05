#!/usr/bin/env bun
/**
 * fetch-tennis-data.ts
 *
 * Seed-and-cache Elo backend for the SetPoint tennis app.
 *
 * Downloads the last 3 years (2023, 2024, 2025) of Jeff Sackmann's
 * tennis_atp AND tennis_wta match CSVs (one file per year per tour),
 * parses them, computes Elo ratings iteratively from oldest → newest
 * match (K=32, denominator=400, start Elo=1500), and writes per-player
 * Elo histories for the 6 players we care about to
 * `src/lib/prediction/elo-data.json`:
 *
 *   ATP: Alcaraz, Rublev, Sinner, Medvedev
 *   WTA: Sabalenka, Osaka
 *
 * Data source strategy per tour (tried in order):
 *
 *   ATP — canonical first, then verified mirror:
 *     1. https://raw.githubusercontent.com/JeffSackmann/tennis_atp/master/atp_matches_{year}.csv
 *     2. https://raw.githubusercontent.com/jegqwll/tennis_atp_2000_2025/master/atp_matches_{year}.csv
 *
 *   WTA — canonical first (currently 404 — repo appears deleted/private
 *   at time of writing, same situation as tennis_atp), then a verified
 *   mirror that is a fork of the original tennis_wta repo with the
 *   2023-2025 years populated:
 *     1. https://raw.githubusercontent.com/JeffSackmann/tennis_wta/master/wta_matches_{year}.csv
 *     2. https://raw.githubusercontent.com/mikecristancho/tennis_wta/master/wta_matches_{year}.csv
 *        (verified mirror — fork of ppaulojr/tennis_wta, same CSV
 *        schema as canonical, all 3 years 2023/2024/2025 present)
 *
 * The script records the actually-used source URL(s) per tour in the
 * JSON `source` field for traceability. If all sources fail for any
 * year on either tour, the script aborts without writing the JSON
 * file. The app then falls back to the existing mock in
 * elo-history.ts (the import is wrapped in a defensive guard).
 *
 * NOTE: synthetic WTA data fallback is intentionally NOT implemented —
 * a verified real mirror was found (mikecristancho/tennis_wta, forked
 * from ppaulojr/tennis_wta which itself is the original JeffSackmann
 * fork network with 170+ forks). If that mirror ever goes dark and no
 * alternative is found, add a synthetic generator here and mark
 * `source: "synthetic"` for the WTA tour in the JSON.
 *
 * Usage:
 *   cd /home/z/my-project && bun run scripts/fetch-tennis-data.ts
 *   cd /home/z/my-project && bun run scripts/fetch-tennis-data.ts --dry-run
 *
 * Exit codes:
 *   0 — success (JSON written, or dry-run completed without writing)
 *   1 — download / parse / compute failure (existing JSON preserved)
 *
 * --dry-run — runs the full download + Elo computation but does NOT
 *   write src/lib/prediction/elo-data.json. Used by the CI workflow
 *   (.github/workflows/refresh-elo.yml) to probe mirror health without
 *   committing anything.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

// ---------------------------------------------------------------------------
// CLI flags
// ---------------------------------------------------------------------------

const DRY_RUN = process.argv.includes("--dry-run");

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const YEARS = [2023, 2024, 2025];
const K = 32; // standard tennis K-factor
const DENO = 400; // Elo denominator
const START_ELO = 1500; // baseline Elo for unseen players

type TourConfig = {
  /** Tour label — used in logs + JSON `source` structure. */
  tour: "ATP" | "WTA";
  /** URL template per year — tried in order. */
  sources: Array<(year: number) => string>;
  /** Pattern used to strip the year-specific filename so we record
   *  the repo root in the JSON `source` field. */
  sourceNormalise: RegExp;
  /** Filename prefix used by the CSV on this tour (atp_matches_ vs
   *  wta_matches_). Used purely for the normalisation regex. */
  targetPlayers: Record<string, string>;
};

const ATP_SOURCES: Array<(year: number) => string> = [
  (y) =>
    `https://raw.githubusercontent.com/JeffSackmann/tennis_atp/master/atp_matches_${y}.csv`,
  (y) =>
    `https://raw.githubusercontent.com/jegqwll/tennis_atp_2000_2025/master/atp_matches_${y}.csv`,
];

const WTA_SOURCES: Array<(year: number) => string> = [
  (y) =>
    `https://raw.githubusercontent.com/JeffSackmann/tennis_wta/master/wta_matches_${y}.csv`,
  // Verified fork-network mirror — same CSV schema, all 3 years present
  // (2023 = 2810 matches, 2024 = 2689, 2025 = 2795). Sabalenka + Osaka
  // both present in the data (Osaka has 0 matches in 2023 — maternity
  // break — and 39 in 2024, 46 in 2025).
  (y) =>
    `https://raw.githubusercontent.com/mikecristancho/tennis_wta/master/wta_matches_${y}.csv`,
];

const TOURS: TourConfig[] = [
  {
    tour: "ATP",
    sources: ATP_SOURCES,
    sourceNormalise: /\/atp_matches_\d+\.csv$/,
    targetPlayers: {
      alcaraz: "Carlos Alcaraz",
      rublev: "Andrey Rublev",
      sinner: "Jannik Sinner",
      medvedev: "Daniil Medvedev",
    },
  },
  {
    tour: "WTA",
    sources: WTA_SOURCES,
    sourceNormalise: /\/wta_matches_\d+\.csv$/,
    targetPlayers: {
      sabalenka: "Aryna Sabalenka",
      osaka: "Naomi Osaka",
    },
  },
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Match = {
  date: string; // ISO "YYYY-MM-DD"
  winner: string; // display name e.g. "Carlos Alcaraz"
  loser: string;
  surface: string;
  tourney: string;
};

type PlayerHistory = {
  name: string;
  currentElo: number;
  history: Array<{ date: string; elo: number }>;
};

type TourSource = {
  tour: "ATP" | "WTA";
  /** Repository-root URL(s) actually used for this tour. */
  url: string | string[];
};

type EloDataJson = {
  generatedAt: string;
  source: string | string[] | Record<string, string | string[]>;
  years: number[];
  config: { k: number; denominator: number; startElo: number };
  players: Record<string, PlayerHistory>;
};

// ---------------------------------------------------------------------------
// HTTP fetch (15s timeout per attempt)
// ---------------------------------------------------------------------------

async function fetchCsv(url: string): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchYear(
  tour: TourConfig,
  year: number,
): Promise<{ csv: string; source: string }> {
  let lastErr: unknown = null;
  for (const src of tour.sources) {
    const url = src(year);
    try {
      const csv = await fetchCsv(url);
      if (csv.length < 1000) {
        // Suspiciously small payload — probably a 404 HTML stub or empty
        throw new Error(`payload too small (${csv.length} bytes)`);
      }
      console.log(
        `  ✓ ${tour.tour} ${year}: ${csv.length.toLocaleString()} bytes from ${url}`,
      );
      return { csv, source: url };
    } catch (err) {
      console.log(
        `  ✗ ${tour.tour} ${year}: failed ${url} — ${(err as Error).message}`,
      );
      lastErr = err;
    }
  }
  throw new Error(
    `All sources failed for ${tour.tour} ${year}: ${(lastErr as Error)?.message ?? "unknown"}`,
  );
}

// ---------------------------------------------------------------------------
// CSV parser (RFC-4180 lite: handles quoted fields & embedded commas)
// ---------------------------------------------------------------------------

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const n = text.length;
  for (let i = 0; i < n; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        row.push(field);
        field = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else {
        field += c;
      }
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// "20240115" → "2024-01-15"
function toIsoDate(yyyymmdd: string): string {
  if (!yyyymmdd || yyyymmdd.length !== 8) return yyyymmdd;
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

function extractMatches(csv: string): Match[] {
  const rows = parseCsv(csv);
  if (rows.length < 2) return [];
  const header = rows[0];
  const idx = {
    tourney_date: header.indexOf("tourney_date"),
    winner_name: header.indexOf("winner_name"),
    loser_name: header.indexOf("loser_name"),
    surface: header.indexOf("surface"),
    tourney_name: header.indexOf("tourney_name"),
  };
  // Sanity check: required columns must exist
  if (
    idx.tourney_date < 0 ||
    idx.winner_name < 0 ||
    idx.loser_name < 0
  ) {
    throw new Error(
      `CSV missing required columns (got header: ${header.join(",")})`,
    );
  }
  const out: Match[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r.length < header.length) continue;
    const date = r[idx.tourney_date];
    const winner = r[idx.winner_name];
    const loser = r[idx.loser_name];
    if (!date || !winner || !loser) continue;
    // Skip walkovers / retirements-with-no-score rows are still valid Elo
    // events in this dataset (winner/loser always populated). Keep them.
    out.push({
      date: toIsoDate(date),
      winner: winner.trim(),
      loser: loser.trim(),
      surface: (r[idx.surface] ?? "Unknown").trim(),
      tourney: (r[idx.tourney_name] ?? "").trim(),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Elo computation
// ---------------------------------------------------------------------------

function computeElo(
  matches: Match[],
  targetPlayers: Record<string, string>,
): Record<string, PlayerHistory> {
  // Sort chronologically oldest → newest. ISO dates sort lexicographically.
  const sorted = [...matches].sort((a, b) => a.date.localeCompare(b.date));

  // Elo pool: every player seen in any match. This keeps opponent Elo
  // realistic so target players' updates are properly weighted.
  const elo = new Map<string, number>();

  // Histories we'll emit (only for our target players).
  const targetNameToId = new Map<string, string>();
  for (const [id, name] of Object.entries(targetPlayers)) {
    targetNameToId.set(name, id);
  }
  const histories: Record<string, PlayerHistory> = {};
  for (const [id, name] of Object.entries(targetPlayers)) {
    histories[id] = { name, currentElo: START_ELO, history: [] };
  }

  const getElo = (p: string): number => elo.get(p) ?? START_ELO;

  for (const m of sorted) {
    const wElo = getElo(m.winner);
    const lElo = getElo(m.loser);
    // Expected score for winner = 1 / (1 + 10^((lElo - wElo)/400))
    const eWinner = 1 / (1 + Math.pow(10, (lElo - wElo) / DENO));
    const eLoser = 1 - eWinner;
    // Standard Elo update: winner gets K*(1 - eWinner), loser gets K*(0 - eLoser)
    const newWElo = wElo + K * (1 - eWinner);
    const newLElo = lElo + K * (0 - eLoser);
    elo.set(m.winner, newWElo);
    elo.set(m.loser, newLElo);

    // Record history for our target players (after this match).
    const wId = targetNameToId.get(m.winner);
    if (wId) {
      const rounded = Math.round(newWElo);
      histories[wId].history.push({ date: m.date, elo: rounded });
      histories[wId].currentElo = rounded;
    }
    const lId = targetNameToId.get(m.loser);
    if (lId) {
      const rounded = Math.round(newLElo);
      histories[lId].history.push({ date: m.date, elo: rounded });
      histories[lId].currentElo = rounded;
    }
  }

  return histories;
}

// ---------------------------------------------------------------------------
// Per-tour pipeline: download 3 years of CSVs, parse, compute Elo
// ---------------------------------------------------------------------------

async function runTour(
  tour: TourConfig,
): Promise<{ histories: Record<string, PlayerHistory>; source: string[] }> {
  console.log(`\n--- ${tour.tour} ---`);
  const allMatches: Match[] = [];
  const sourcesUsed: Set<string> = new Set();

  for (const year of YEARS) {
    try {
      const { csv, source } = await fetchYear(tour, year);
      const matches = extractMatches(csv);
      console.log(
        `  ${tour.tour} ${year}: parsed ${matches.length.toLocaleString()} matches`,
      );
      allMatches.push(...matches);
      // Normalise: strip the year-specific filename so we record the repo root.
      sourcesUsed.add(source.replace(tour.sourceNormalise, "/"));
    } catch (err) {
      console.error(`\nFATAL: could not fetch ${tour.tour} year ${year}.`);
      console.error(`  ${(err as Error).message}`);
      console.error("");
      console.error(
        "No elo-data.json written — app will keep the existing file.",
      );
      process.exit(1);
    }
  }

  console.log(
    `${tour.tour}: total matches parsed: ${allMatches.length.toLocaleString()}`,
  );
  console.log(`${tour.tour}: computing Elo (single pass, oldest → newest)...`);
  const histories = computeElo(allMatches, tour.targetPlayers);

  console.log(`\n${tour.tour} per-player results:`);
  let tourPoints = 0;
  for (const [id, h] of Object.entries(histories)) {
    console.log(
      `  ${id.padEnd(10)} ${h.name.padEnd(18)} matches=${String(h.history.length).padStart(3)}  currentElo=${h.currentElo}`,
    );
    tourPoints += h.history.length;
  }
  console.log(
    `  ${" ".repeat(10)} ${" ".repeat(18)} ${tour.tour} total points: ${tourPoints}`,
  );

  return { histories, source: Array.from(sourcesUsed) };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("=== fetch-tennis-data (ATP + WTA) ===");
  console.log(`Years:    ${YEARS.join(", ")}`);
  console.log(
    `Targets:  ${TOURS.flatMap((t) => Object.values(t.targetPlayers)).join(", ")}`,
  );
  console.log(`Config:   K=${K}, denom=${DENO}, startElo=${START_ELO}`);
  if (DRY_RUN) {
    console.log(`Mode:     --dry-run (no file will be written)`);
  }

  // Run ATP and WTA phases sequentially.
  const mergedPlayers: Record<string, PlayerHistory> = {};
  // Per-tour source mapping for the JSON `source` field — preserves
  // traceability of which mirror was actually used for each tour.
  const sourceByTour: Record<string, string | string[]> = {};
  let totalPoints = 0;

  for (const tour of TOURS) {
    const { histories, source } = await runTour(tour);
    for (const [id, h] of Object.entries(histories)) {
      // Defensive: if a player id collides across tours (shouldn't happen
      // with the current config), the later tour wins. Log it so we'd
      // notice.
      if (mergedPlayers[id]) {
        console.warn(
          `  ! player id "${id}" already present — overwriting with ${tour.tour} data`,
        );
      }
      mergedPlayers[id] = h;
      totalPoints += h.history.length;
    }
    sourceByTour[tour.tour] = source.length === 1 ? source[0] : source;
  }

  console.log(`\nGrand total Elo points: ${totalPoints}`);

  const output: EloDataJson = {
    generatedAt: new Date().toISOString(),
    source: sourceByTour,
    years: YEARS,
    config: { k: K, denominator: DENO, startElo: START_ELO },
    players: mergedPlayers,
  };

  const outPath = resolve(
    process.cwd(),
    "src/lib/prediction/elo-data.json",
  );
  const json = JSON.stringify(output, null, 2);
  const sizeKB = (Buffer.byteLength(json, "utf8") / 1024).toFixed(1);

  if (DRY_RUN) {
    console.log(`\n[dry-run] NOT writing ${outPath}`);
    console.log(`  Would-write size: ${sizeKB} KB (limit: 100 KB)`);
    console.log(`  Players: ${Object.keys(mergedPlayers).length}`);
    for (const [tour, url] of Object.entries(sourceByTour)) {
      console.log(`  ${tour} source(s): ${url}`);
    }
    console.log(
      `\n✓ Dry-run complete — exiting 0 without modifying any files.`,
    );
    return;
  }

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, json, "utf8");
  console.log(`\n✓ Wrote ${outPath}`);
  console.log(`  Size: ${sizeKB} KB (limit: 100 KB)`);
  console.log(`  Players: ${Object.keys(mergedPlayers).length}`);
  for (const [tour, url] of Object.entries(sourceByTour)) {
    console.log(`  ${tour} source(s): ${url}`);
  }
}

main().catch((err: unknown) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
