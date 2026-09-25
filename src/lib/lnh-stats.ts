// Stats StarLigue (LNH) — lecture readonly des snapshots data/lnh_*.json
// produits par scripts/scrape-lnh.js (cron pm2 `pariscore-cron-lnh`,
// quotidien 21:30 UTC) :
//   - lnh_teamstats.json : 5 métriques/équipe (buts marqués, encaissés,
//     arrêts, passes, pertes de balles) + matchs joués ;
//   - lnh_standing.json  : classement (rang, points, V-N-D, buts, diff).
// Consommé par GET /api/handball/analysis → onglet « Stats équipes » du
// popup handball (objectif : informer le parieur sur les 2 équipes même
// quand le snapshot Flashscore ne porte ni forme ni cotes).
//
// Défensif : fichier absent / parse KO → null et l'UI dégrade proprement
// (pattern handball-players.ts : DATA_DIR env prioritaire côté VPS).

import { existsSync, readFileSync } from "node:fs";
import { join } from "path";

export type LnhMetricKey = "goals_for" | "goals_against" | "saves" | "assists" | "turnovers";

export type LnhMetricDef = { order: string; key: string; label: string };

export type LnhMetricValue = { total: number; avg: number; label?: string };

export type LnhTeamEntry = {
  team: string;
  played: number;
  metrics: Partial<Record<LnhMetricKey, LnhMetricValue>>;
};

export type LnhTeamStatsSnapshot = {
  scraped_at: string;
  season: string;
  source: string;
  total: number;
  metrics: LnhMetricDef[];
  teams: LnhTeamEntry[];
};

export type LnhStandingRow = {
  rank: number;
  team: string;
  points: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goals_for: number;
  goals_against: number;
  goal_diff: number;
};

export type LnhStandingSnapshot = {
  scraped_at: string;
  season: string;
  source: string;
  total: number;
  standing: LnhStandingRow[];
};

// Caches mémoire module : undefined = pas encore lu, null = fichier absent.
let _teamStats: LnhTeamStatsSnapshot | null | undefined;
let _standing: LnhStandingSnapshot | null | undefined;

function readSnapshot<T>(file: string, guard: (d: unknown) => boolean): T | null {
  try {
    const dataDir = process.env.DATA_DIR || join(process.cwd(), "data");
    const target = join(dataDir, file);
    if (!existsSync(target)) return null;
    const data = JSON.parse(readFileSync(target, "utf8")) as unknown;
    return guard(data) ? (data as T) : null;
  } catch {
    return null;
  }
}

/** Snapshot stats équipes StarLigue (data/lnh_teamstats.json). */
export function loadLnhTeamStats(): LnhTeamStatsSnapshot | null {
  if (_teamStats === undefined) {
    _teamStats = readSnapshot<LnhTeamStatsSnapshot>("lnh_teamstats.json", (d) => {
      const o = d as { teams?: unknown; metrics?: unknown };
      return Array.isArray(o?.teams) && Array.isArray(o?.metrics);
    });
  }
  return _teamStats;
}

/** Snapshot classement StarLigue (data/lnh_standing.json). */
export function loadLnhStanding(): LnhStandingSnapshot | null {
  if (_standing === undefined) {
    _standing = readSnapshot<LnhStandingSnapshot>("lnh_standing.json", (d) => {
      const o = d as { standing?: unknown };
      return Array.isArray(o?.standing);
    });
  }
  return _standing;
}

/** Normalisation nom de club (miroir teamKey de handball-history-stats). */
function norm(name: string): string {
  return String(name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Matching inclusif d'un nom de calendrier vers une ligne LNH :
 * égalité exacte puis inclusion réciproque (len ≥ 5 — « Cesson Rennes » ⊂
 * « Cesson Rennes-Metropole »). Exporté pur pour être testable.
 */
export function findLnhRow<T extends { team: string }>(rows: readonly T[] | undefined, wanted: string): T | null {
  if (!rows || !rows.length) return null;
  const w = norm(wanted);
  if (!w) return null;
  let best: T | null = null;
  for (const row of rows) {
    const t = norm(row.team);
    if (!t) continue;
    if (t === w) return row;
    if (Math.min(t.length, w.length) < 5) continue;
    if (t.includes(w) || w.includes(t)) {
      if (!best || t.length > best.team.length) best = row;
    }
  }
  return best;
}

/** Purge des caches (tests / hot-reload après un scrape). */
export function clearLnhCache(): void {
  _teamStats = undefined;
  _standing = undefined;
}
