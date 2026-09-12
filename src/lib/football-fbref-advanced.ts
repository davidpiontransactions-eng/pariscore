/**
 * football-fbref-advanced.ts — Chargement des stats FBref avancées (keeper, shooting, standard).
 *
 * Source : data/fbref_advanced/{slug}_{season}.json (généré par scrape_advanced_stats.py via soccerdata).
 * Couvre Big 5 + Championship. Les données incluent saves, save%, CS, CS%, GA90, SoTA.
 *
 * Pas de PSxG (Post-Shot xG) dans soccerdata — à ajouter via FBref brut si besoin.
 */

import { readFileSync } from "fs";
import { join } from "path";

// ── Types ──────────────────────────────────────────────────────────────────

export interface FbrefKeeperStats {
  team: string;
  mp: number;
  ga: number;
  ga90: number;
  sota: number;
  saves: number;
  savePct: number;
  cs: number;
  csPct: number;
  pkAtt: number;
  pkA: number;
  pkSv: number;
}

export interface FbrefShootingStats {
  team: string;
  mp: number;
  sh: number;
  sh90: number;
  sot: number;
  sot90: number;
  gSh: number;
  gSot: number;
  dist: number;
  fk: number;
  pk: number;
  pkAtt: number;
}

export interface FbrefStandardStats {
  team: string;
  mp: number;
  starts: number;
  min: number;
  gls: number;
  ast: number;
  pk: number;
  pkAtt: number;
  sh: number;
  sot: number;
  yc: number;
  rc: number;
}

export interface FbrefTeamAdvanced {
  team: string;
  keeper: FbrefKeeperStats | null;
  shooting: FbrefShootingStats | null;
  standard: FbrefStandardStats | null;
}

// ── Cache ──────────────────────────────────────────────────────────────────

const cache = new Map<string, FbrefTeamAdvanced[]>();

// ── Helpers ────────────────────────────────────────────────────────────────

function safeNum(val: unknown): number {
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const n = parseFloat(val);
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

function extractKeeper(rows: Record<string, unknown>[]): FbrefKeeperStats[] {
  return rows
    .filter((r) => r.team && r["Performance__Saves"] != null)
    .map((r) => ({
      team: String(r.team),
      mp: safeNum(r["Playing Time__MP"]),
      ga: safeNum(r["Performance__GA"]),
      ga90: safeNum(r["Performance__GA90"]),
      sota: safeNum(r["Performance__SoTA"]),
      saves: safeNum(r["Performance__Saves"]),
      savePct: safeNum(r["Performance__Save%"]),
      cs: safeNum(r["Performance__CS"]),
      csPct: safeNum(r["Performance__CS%"]),
      pkAtt: safeNum(r["Penalty Kicks__PKatt"]),
      pkA: safeNum(r["Penalty Kicks__PKA"]),
      pkSv: safeNum(r["Penalty Kicks__PKsv"]),
    }));
}

function extractShooting(rows: Record<string, unknown>[]): FbrefShootingStats[] {
  return rows
    .filter((r) => r.team && r["Standard__Sh"] != null)
    .map((r) => ({
      team: String(r.team),
      mp: safeNum(r["Playing Time__MP"]),
      sh: safeNum(r["Standard__Sh"]),
      sh90: safeNum(r["Standard__Sh/90"]),
      sot: safeNum(r["Standard__SoT"]),
      sot90: safeNum(r["Standard__SoT/90"]),
      gSh: safeNum(r["Standard__G/Sh"]),
      gSot: safeNum(r["Standard__G/SoT"]),
      dist: safeNum(r["Standard__Dist"]),
      fk: safeNum(r["Standard__FK"]),
      pk: safeNum(r["Standard__PK"]),
      pkAtt: safeNum(r["Standard__PKatt"]),
    }));
}

function extractStandard(rows: Record<string, unknown>[]): FbrefStandardStats[] {
  return rows
    .filter((r) => r.team && r["Total__Gls"] != null)
    .map((r) => ({
      team: String(r.team),
      mp: safeNum(r["Playing Time__MP"]),
      starts: safeNum(r["Playing Time__Starts"]),
      min: safeNum(r["Playing Time__Min"]),
      gls: safeNum(r["Total__Gls"]),
      ast: safeNum(r["Total__Ast"]),
      pk: safeNum(r["Total__PK"]),
      pkAtt: safeNum(r["Total__PKatt"]),
      sh: safeNum(r["Total__Sh"]),
      sot: safeNum(r["Total__SoT"]),
      yc: safeNum(r["Performance__CrdY"]),
      rc: safeNum(r["Performance__CrdR"]),
    }));
}

// ── Chargeur principal ─────────────────────────────────────────────────────

const LEAGUE_SLUG_MAP: Record<string, string> = {
  england: "en_premier_league",
  spain: "es_la_liga",
  germany: "de_bundesliga",
  italy: "it_serie_a",
  france: "fr_ligue_1",
  england2: "en_championship",
};

/**
 * Charge les stats FBref avancées pour une ligue donnée.
 * @param leagueSlug — slug ParisScore (ex: "england", "spain")
 * @param season — saison (ex: "2025-2026")
 * @returns FbrefTeamAdvanced[] ou [] si pas de données
 */
export function loadFbrefAdvanced(
  leagueSlug: string,
  season = currentSeason(),
): FbrefTeamAdvanced[] {
  const cacheKey = `${leagueSlug}:${season}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey)!;

  const fbrefSlug = LEAGUE_SLUG_MAP[leagueSlug];
  if (!fbrefSlug) return [];

  try {
    const dataDir = join(
      process.cwd(),
      "data",
      "fbref_advanced",
    );
    const filePath = join(dataDir, `${fbrefSlug}_${season}.json`);
    const raw = JSON.parse(readFileSync(filePath, "utf-8"));

    const keeperRows = (raw.team_season_stats?.keeper ?? []) as Record<
      string,
      unknown
    >[];
    const shootingRows = (raw.team_season_stats?.shooting ?? []) as Record<
      string,
      unknown
    >[];
    const standardRows = (raw.team_season_stats?.standard ?? []) as Record<
      string,
      unknown
    >[];

    const keepers = extractKeeper(keeperRows);
    const shooters = extractShooting(shootingRows);
    const standards = extractStandard(standardRows);

    // Fusionner par équipe
    const teamMap = new Map<string, FbrefTeamAdvanced>();
    for (const k of keepers) {
      teamMap.set(k.team, {
        team: k.team,
        keeper: k,
        shooting: null,
        standard: null,
      });
    }
    for (const s of shooters) {
      const existing = teamMap.get(s.team);
      if (existing) {
        existing.shooting = s;
      } else {
        teamMap.set(s.team, {
          team: s.team,
          keeper: null,
          shooting: s,
          standard: null,
        });
      }
    }
    for (const s of standards) {
      const existing = teamMap.get(s.team);
      if (existing) {
        existing.standard = s;
      } else {
        teamMap.set(s.team, {
          team: s.team,
          keeper: null,
          shooting: null,
          standard: s,
        });
      }
    }

    const result = Array.from(teamMap.values());
    cache.set(cacheKey, result);
    return result;
  } catch {
    return [];
  }
}

/**
 * Recherche les stats FBref pour une équipe spécifique.
 */
export function getTeamFbrefAdvanced(
  leagueSlug: string,
  teamName: string,
  season?: string,
): FbrefTeamAdvanced | null {
  const teams = loadFbrefAdvanced(leagueSlug, season);
  return (
    teams.find(
      (t) =>
        t.team.toLowerCase() === teamName.toLowerCase() ||
        t.team.includes(teamName) ||
        teamName.includes(t.team),
    ) ?? null
  );
}

function currentSeason(): string {
  const now = new Date();
  const y = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return `${y}-${y + 1}`;
}
