// Stats Bundesliga (1.HBL + 2.HBL) — lecture readonly des snapshots
// data/hbl_teamstats.json + data/hbl_standing.json produits par
// scripts/scrape-hbl.js (cron pm2 `pariscore-cron-hbl-stats`, 2×/semaine) :
//   - hbl_teamstats.json : 4 métriques/club (buts marqués, encaissés, arrêts,
//     tirs, passes décisives si présentes) + matchs joués ;
//   - hbl_standing.json  : classement (rang, points, V-N-D, buts, diff).
// Source = API Synergy/Sportradar derrière opel-hbl.de (GRATUITE, sans token).
// Cadence : lundi + jeudi 05:00 UTC (pm2 `pariscore-cron-hbl-stats`) — le
// cache mémoire module ci-dessous ne se rafraîchit qu'au redémarrage/HMR.
//
// Consommé par GET /api/handball/analysis en REPLI : la source StarLigue
// (lnh-stats.ts) ne couvre que la France — la Bundesliga n'avait AUCUNE source
// avant ce module (bead ParisScorebis-wvwv). Mêmes schémas que LNH pour
// mutualiser le rendu de l'onglet « Stats équipes ».
//
// Défensif : fichier absent / parse KO → null et l'UI dégrade proprement
// (pattern lnh-stats.ts : DATA_DIR env prioritaire côté VPS).

import { existsSync, readFileSync } from "node:fs";
import { join } from "path";

export type HblMetricDef = { order: string; key: string; label: string };

export type HblMetricValue = { total: number; avg?: number; label?: string };

export type HblTeamEntry = {
  team: string;
  competition?: string;
  played: number;
  metrics: Partial<Record<string, HblMetricValue>>;
};

export type HblTeamStatsSnapshot = {
  scraped_at: string;
  season: string;
  source: string;
  total: number;
  metrics: HblMetricDef[];
  teams: HblTeamEntry[];
};

export type HblStandingRow = {
  rank: number;
  team: string;
  competition?: string;
  points: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goals_for: number;
  goals_against: number;
  goal_diff: number;
};

export type HblStandingSnapshot = {
  scraped_at: string;
  season: string;
  source: string;
  total: number;
  standing: HblStandingRow[];
};

// Caches mémoire module : undefined = pas encore lu, null = fichier absent.
let _teamStats: HblTeamStatsSnapshot | null | undefined;
let _standing: HblStandingSnapshot | null | undefined;

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

/** Snapshot stats équipes Bundesliga (data/hbl_teamstats.json). */
export function loadHblTeamStats(): HblTeamStatsSnapshot | null {
  if (_teamStats === undefined) {
    _teamStats = readSnapshot<HblTeamStatsSnapshot>("hbl_teamstats.json", (d) => {
      const o = d as { teams?: unknown; metrics?: unknown };
      return Array.isArray(o?.teams) && Array.isArray(o?.metrics);
    });
  }
  return _teamStats;
}

/** Snapshot classement Bundesliga (data/hbl_standing.json). */
export function loadHblStanding(): HblStandingSnapshot | null {
  if (_standing === undefined) {
    _standing = readSnapshot<HblStandingSnapshot>("hbl_standing.json", (d) => {
      const o = d as { standing?: unknown };
      return Array.isArray(o?.standing);
    });
  }
  return _standing;
}

/**
 * Ligne d'une équipe dans les snapshots Bundesliga.
 * Matching : 1) exact · 2) inclusion réciproque (len ≥ 5, miroir LNH) ·
 * 3) **suffixe** (len ≥ 4) — indispensable côté allemand : le calendrier
 * Flashscore porte « Kiel » (4 car.) alors que l'HBL dit « THW Kiel »
 * (l'inclusion seule est bloquée par la garde ≥ 5). Le suffixe évite les
 * collisions du type « Kiel » ⊂ « Kielce » (« kielce ».endsWith("kiel") = faux).
 */
export function findHblRow<T extends { team: string }>(
  rows: readonly T[] | undefined,
  wanted: string,
): T | null {
  if (!rows || !rows.length) return null;
  const w = normName(wanted);
  if (!w) return null;
  let exact: T | null = null;
  let best: T | null = null;
  let suffix: T | null = null;
  for (const row of rows) {
    const t = normName(row.team);
    if (!t) continue;
    if (t === w) {
      exact = row;
      break;
    }
    if (Math.min(t.length, w.length) >= 5 && (t.includes(w) || w.includes(t))) {
      if (!best || t.length < best.team.length) best = row;
    }
    if (w.length >= 4 && t.endsWith(w)) {
      if (!suffix || t.length < suffix.team.length) suffix = row;
    }
  }
  return exact ?? best ?? suffix;
}

/** Normalisation (miroir normHandballName / norm LNH). */
function normName(s: string): string {
  return String(s)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** Purge des caches (tests / hot-reload après un scrape). */
export function clearHblCache(): void {
  _teamStats = undefined;
  _standing = undefined;
}
