/**
 * lookup.ts — fuzzy lookup of tennisabstract Elo data.
 *
 * Searches the cached tennisabstract Elo data (ATP + WTA) by player name.
 * Used by bsd-fetcher.ts as the PRIMARY Elo source.
 *
 * The cache file is loaded at runtime (readFileSync) so weekly scraper
 * updates take effect without a full Next.js rebuild.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { AbstractCache } from "./scraper";
import { normalizeKey } from "./scraper";

function resolveCachePath(): string {
  const envPath = process.env.ELO_CACHE_PATH;
  if (envPath) return envPath;

  const candidates = [
    // Dev mode (next dev)
    resolve(process.cwd(), "src/lib/tennis-elo/abstract-cache.json"),
    // Standalone production (copied by build script)
    resolve(
      process.cwd(),
      ".next/standalone/src/lib/tennis-elo/abstract-cache.json",
    ),
    // Alternate: project root .elo-cache
    resolve(process.cwd(), ".elo-cache.json"),
  ];

  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return candidates[0]; // fallback to dev path (will be empty)
}

const CACHE_PATH = resolveCachePath();

let _cache: AbstractCache | null = null;
let _lastLoaded: number = 0;
const RELOAD_INTERVAL_MS = 60_000;

function getCache(): AbstractCache {
  const now = Date.now();
  if (_cache && now - _lastLoaded < RELOAD_INTERVAL_MS) return _cache;
  try {
    const raw = readFileSync(CACHE_PATH, "utf8");
    _cache = JSON.parse(raw) as AbstractCache;
    _lastLoaded = now;
  } catch {
    _cache = { generatedAt: "", lastUpdate: "", players: {} };
  }
  return _cache;
}

type SurfaceLabel = "Dur" | "Terre battue" | "Gazon";

function surfaceEloOf(entry: AbstractCache["players"][string], surface?: SurfaceLabel): number {
  if (!surface) return entry.elo;
  if (surface === "Dur") return entry.hElo || entry.elo;
  if (surface === "Terre battue") return entry.cElo || entry.elo;
  if (surface === "Gazon") return entry.gElo || entry.elo;
  return entry.elo;
}

export type LookupResult = {
  name: string;
  tour: "ATP" | "WTA";
  elo: number;
  surfaceElo: number;
};

export function lookupAbstractElo(
  playerName: string,
  surface?: string,
): LookupResult | null {
  if (!playerName || !playerName.trim()) return null;

  const cache = getCache();
  const players = cache.players;
  if (!players || Object.keys(players).length === 0) return null;

  const key = normalizeKey(playerName);

  // 1. Normalized key exact match
  const exact = players[key];
  if (exact) {
    return {
      name: exact.name,
      tour: exact.tour,
      elo: exact.elo,
      surfaceElo: surfaceEloOf(exact, surface as SurfaceLabel),
    };
  }

  // 2. Surname-only match
  const surname = key.split("_").pop();
  if (surname && surname.length >= 3) {
    for (const [k, v] of Object.entries(players)) {
      if (k.endsWith(`_${surname}`) || k === surname || k.includes(`_${surname}_`)) {
        return {
          name: v.name,
          tour: v.tour,
          elo: v.elo,
          surfaceElo: surfaceEloOf(v, surface as SurfaceLabel),
        };
      }
    }
  }

  // 3. Substring match for compound surnames
  for (const [k, v] of Object.entries(players)) {
    if (k.includes(key) || key.includes(k)) {
      return {
        name: v.name,
        tour: v.tour,
        elo: v.elo,
        surfaceElo: surfaceEloOf(v, surface as SurfaceLabel),
      };
    }
  }

  return null;
}
