// Lookup runtime du DR Moyen — lit dr-cache.json (mis à jour par cron nocturne).
//
// ⚠️  Ce module ne fait JAMAIS de fetch réseau. Il lit uniquement le cache
// disque. C'est le CLI (scripts/scrape-tennis-dr.ts) qui peuple le cache, sous
// le flag `LEGAL_OVERRIDE_CONFIRMED=1`.
//
// Architecture identique à src/lib/tennis-elo/lookup.ts : readFileSync + reload
// toutes les 60s, résolution multi-chemins (dev / standalone / env override),
// fuzzy surname fallback.

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { DrCache, DrSurface } from "./scraper";
import { normalizeKey } from "./scraper";

/** Surfaces acceptées en entrée (labels UI / DB). */
const SURFACE_ALIASES: Record<string, DrSurface> = {
  // Anglais (DB Sackmann)
  hard: "Hard",
  clay: "Clay",
  grass: "Grass",
  // Français (UI)
  dur: "Hard",
  terre: "Clay",
  "terre battue": "Clay",
  gazon: "Grass",
};

function resolveSurface(raw: string): DrSurface | null {
  const key = raw.trim().toLowerCase();
  return SURFACE_ALIASES[key] ?? null;
}

function resolveCachePath(): string {
  const envPath = process.env.DR_CACHE_PATH;
  if (envPath) return envPath;

  const candidates = [
    // Dev mode (next dev) — source du repo.
    resolve(process.cwd(), "src/lib/tennis-dr/dr-cache.json"),
    // Standalone production (copié par le script de build).
    resolve(
      process.cwd(),
      ".next/standalone/src/lib/tennis-dr/dr-cache.json",
    ),
    // Override racine projet.
    resolve(process.cwd(), ".dr-cache.json"),
  ];

  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return candidates[0]; // fallback dev (sera vide → lookup retourne null)
}

const CACHE_PATH = resolveCachePath();

let _cache: DrCache | null = null;
let _lastLoaded = 0;
const RELOAD_INTERVAL_MS = 60_000;

function getCache(): DrCache {
  const now = Date.now();
  if (_cache && now - _lastLoaded < RELOAD_INTERVAL_MS) return _cache;
  try {
    const raw = readFileSync(CACHE_PATH, "utf8");
    _cache = JSON.parse(raw) as DrCache;
    _lastLoaded = now;
  } catch {
    _cache = { generatedAt: "", lastUpdate: "", players: {} };
  }
  return _cache;
}

/**
 * Recherche un joueur dans le cache (match exact puis surname fuzzy).
 * Retourne l'entrée complète ou null.
 */
function findEntry(
  playerName: string,
): DrCache["players"][string] | null {
  if (!playerName || !playerName.trim()) return null;

  const cache = getCache();
  const players = cache.players;
  if (!players || Object.keys(players).length === 0) return null;

  const key = normalizeKey(playerName);

  // 1. Match exact sur la clé normalisée.
  const exact = players[key];
  if (exact) return exact;

  // 2. Fuzzy surname (dernier token du nom). Évite les soucis "Alex de Minaur"
  //    vs "Alexander de Minaur" ou variantes de prénom.
  const surname = key.split("_").pop();
  if (surname && surname.length >= 3) {
    for (const [k, v] of Object.entries(players)) {
      if (
        k.endsWith(`_${surname}`) ||
        k === surname ||
        k.includes(`_${surname}_`)
      ) {
        return v;
      }
    }
  }

  // 3. Substring (noms composés / translittérations).
  for (const [k, v] of Object.entries(players)) {
    if (k.includes(key) || key.includes(k)) return v;
  }

  return null;
}

/**
 * DR Moyen (5M) pour un joueur sur une surface donnée.
 *
 * Stratégie :
 *   1. Récupère le bucket de la surface demandée.
 *   2. Si ≥3 matchs sur cette surface → retourne la médiane surface.
 *   3. Sinon (sample trop faible) → fallback médiane tous-surfaces si ≥1 match.
 *   4. Sinon → null (l'UI masquera le token DR).
 *
 * @param playerName  Nom complet ("Jannik Sinner")
 * @param surface     Surface UI ou DB ("Gazon", "Hard", "Terre battue", ...)
 * @returns médiane arrondie à 2 décimales, ou null
 */
export function lookupDrMoyen(
  playerName: string,
  surface: string,
): number | null {
  const entry = findEntry(playerName);
  if (!entry) return null;

  const dbSurface = resolveSurface(surface);
  if (!dbSurface) return null;

  // 1-2. Bucket surface (Hard/Clay/Grass).
  const surfaceBucket = entry[dbSurface];
  if (surfaceBucket && surfaceBucket.n >= 3 && surfaceBucket.median != null) {
    return round2(surfaceBucket.median);
  }

  // 3. Fallback tous-surfaces.
  if (entry.all.n >= 1 && entry.all.median != null) {
    return round2(entry.all.median);
  }

  // 4. Aucune donnée exploitable.
  return null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Stats de service d'un joueur pour une surface (médiane 5 derniers matchs).
 *
 * Stratégie identique à lookupDrMoyen :
 *   1. Bucket surface si ≥1 match avec stats serve disponibles.
 *   2. Sinon fallback tous-surfaces.
 *   3. Sinon null.
 *
 * Retourne { servePtsWonPct, returnPtsWonPct } — `returnPtsWonPct` est déduit
 * de l'adversaire moyen (1 − servePtsWonPct, heuristique faute de données
 * adverses détaillées). Alimente predictTotalGames().
 */
export function lookupServeStats(
  playerName: string,
  surface: string,
): { servePtsWonPct: number | null; returnPtsWonPct: number | null } {
  const entry = findEntry(playerName);
  if (!entry || !entry.serveStats) {
    return { servePtsWonPct: null, returnPtsWonPct: null };
  }

  const dbSurface = resolveSurface(surface);
  if (!dbSurface) {
    return { servePtsWonPct: null, returnPtsWonPct: null };
  }

  // 1. Bucket surface.
  const surfaceBucket = entry.serveStats[dbSurface];
  if (surfaceBucket && surfaceBucket.servePtsWonPct != null) {
    return {
      servePtsWonPct: surfaceBucket.servePtsWonPct,
      // Heuristique : returnPtsWonPct ≈ 1 − servePtsWonPct moyen tour (0.36).
      // Sans données adverses, on assume la parité (un bon serveur est
      // statistiquement un retourneur moyen). Le modèle total-games tolère null.
      returnPtsWonPct: 0.36,
    };
  }

  // 2. Fallback tous-surfaces.
  if (entry.serveStats.all.servePtsWonPct != null) {
    return {
      servePtsWonPct: entry.serveStats.all.servePtsWonPct,
      returnPtsWonPct: 0.36,
    };
  }

  // 3. Aucune donnée serve.
  return { servePtsWonPct: null, returnPtsWonPct: null };
}

/** Exposé pour debug / tests — nombre de joueurs en cache. */
export function getCacheStats(): { count: number; lastUpdate: string } {
  const cache = getCache();
  return {
    count: Object.keys(cache.players).length,
    lastUpdate: cache.lastUpdate,
  };
}
