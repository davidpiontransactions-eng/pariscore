/**
 * hltv-stats-types.ts — Types pour les données HLTV scrapées
 * ----------------------------------------------------------------
 * Sources : data/hltv_team_stats.json, data/hltv_map_pool.json
 * Le scraper (tools/scrape-hltv-stats.js) écrit ces fichiers,
 * le serveur Next.js les lit en lecture seule.
 */

import { type Cs2MapName } from "@/lib/prediction/cs2/cs2-predictive-ml-engine";

// ─── Team Overview (HLTV stats/teams/{id}) ────────────────────────────────────

export type HltvTeamOverview = {
  mapsPlayed: number | null;
  totalKills: number | null;
  totalDeaths: number | null;
  roundsPlayed: number | null;
  kdRatio: number | null;
  wins: number | null;
  draws: number | null;
  losses: number | null;
};

// ─── Per-Map Stats (HLTV stats/teams/maps/{id}) ──────────────────────────────

export type HltvMapStats = {
  wins: number;
  draws: number;
  losses: number;
  winRate: number;       // 0-100 %
  totalRounds: number;
  roundWinPAfterFirstKill?: number;
  roundWinPAfterFirstDeath?: number;
};

// ─── Player (lineup actuelle) ────────────────────────────────────────────────

export type HltvPlayer = {
  id: number;
  name: string;
};

// ─── Team Stats complet ──────────────────────────────────────────────────────

export type HltvTeamStats = {
  name: string;
  hltv_id: number;
  rank: number;
  points: number;
  overview: HltvTeamOverview | null;
  mapStats: Partial<Record<Cs2MapName, HltvMapStats>>;
  currentLineup: HltvPlayer[];
};

// ─── Map Pool (agrégé) ───────────────────────────────────────────────────────

export type HltvMapPoolEntry = {
  name: string;
  hltv_id: number;
  winRate: number;
  wins: number;
  losses: number;
  totalRounds: number;
  rank: number;
};

export type HltvMapPool = {
  avgWinrate: number | null;
  totalMatches: number;
  teams: HltvMapPoolEntry[];
};

// ─── Fichiers JSON scrapés ───────────────────────────────────────────────────

export type HltvTeamStatsFile = {
  generated: string;
  source: string;
  n_teams: number;
  maps: readonly Cs2MapName[];
  teams: HltvTeamStats[];
};

export type HltvMapPoolFile = {
  generated: string;
  source: string;
  n_teams: number;
  maps: readonly Cs2MapName[];
  mapPool: Record<Cs2MapName, HltvMapPool>;
};

// ─── API Response ────────────────────────────────────────────────────────────

export type HltvStatsResponse = {
  teamStats: HltvTeamStatsFile;
  mapPool: HltvMapPoolFile;
  cached: boolean;
  age: number | null;   // ms depuis dernier refresh
};
