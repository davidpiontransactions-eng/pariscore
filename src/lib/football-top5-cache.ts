// Fallback disque pour le Top 5/10 football — si l'API BSD est indisponible
// (402/429/réseau), on re-score le dernier snapshot de fixtures connu.
// Garantit aussi une shape `StrategyTop5` TOUJOURS complète (clé `strategies`
// jamais absente — bug historique du tableau vide en production).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import type { BSDFootballMatch } from "@/lib/bsd-football-fetcher";
import {
  STRATEGY_TOP5_KEYS,
  type StrategyTop5,
  type StrategyTop5Key,
} from "@/lib/football-strategy-top5";

const CACHE_DIR = join(process.cwd(), "data", "cache");
const CACHE_PATH = join(CACHE_DIR, "bsd-fixtures.json");
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 h — au-delà, snapshot jugé périmé

type FixturesCache = {
  at: number;
  finished: BSDFootballMatch[];
  fixtures: BSDFootballMatch[];
};

/**
 * Shape StrategyTop5 vide mais COMPLÈTE : toutes les clés de stratégie
 * présentes à []. Le hook client lit `data.strategies[key]` — une shape
 * partielle produit un tableau vide silencieux côté UI.
 */
export function emptyStrategyTop5(): StrategyTop5 {
  const strategies = {} as StrategyTop5["strategies"];
  for (const key of STRATEGY_TOP5_KEYS) strategies[key] = [];
  return { window: 5, minPlayed: 2, strategies, drawModal: [] };
}

/** Snapshot fixtures disque (null si absent ou TTL dépassé). */
export function readFixturesCache(): FixturesCache | null {
  try {
    if (!existsSync(CACHE_PATH)) return null;
    const raw = JSON.parse(readFileSync(CACHE_PATH, "utf-8")) as FixturesCache;
    if (!raw || typeof raw.at !== "number") return null;
    if (Date.now() - raw.at > CACHE_TTL_MS) return null;
    if (!Array.isArray(raw.finished) || !Array.isArray(raw.fixtures)) return null;
    return raw;
  } catch {
    return null;
  }
}

/** Écrit le snapshot après un succès BSD (best-effort, jamais bloquant). */
export function writeFixturesCache(
  finished: BSDFootballMatch[],
  fixtures: BSDFootballMatch[],
): void {
  try {
    mkdirSync(CACHE_DIR, { recursive: true });
    const payload: FixturesCache = { at: Date.now(), finished, fixtures };
    writeFileSync(CACHE_PATH, JSON.stringify(payload));
  } catch (err) {
    console.error("[football-top5-cache] write failed:", (err as Error).message);
  }
}
