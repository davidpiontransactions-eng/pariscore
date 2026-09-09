/**
 * football-radar.ts — Calcul des 6 scores 0-100 pour le radar chart FotMob.
 *
 * Axes : Rating, Squad, Goalkeepers, Defence, Midfield, Attack.
 * Chaque score est normalisé sur [0, 100] avec fallback 50 si données manquantes.
 */

import type { FootballMatch } from "./football-data";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RadarAxisKey =
  | "rating"
  | "squad"
  | "goalkeepers"
  | "defence"
  | "midfield"
  | "attack";

export type RadarTeamData = Record<RadarAxisKey, number>;

export interface RadarMatchData {
  home: RadarTeamData;
  away: RadarTeamData;
  homeName: string;
  awayName: string;
}

export type TeamAttackStats = {
  goalsPerGame: number | null;
  shotsPerGame: number | null;
  xGPerGame: number | null;
  attackFrequency: number | null;
};

export type TeamDefenseStats = {
  concededPerGame: number | null;
  cleanSheetPct: number | null;
  tacklesPerGame: number | null;
  defActionsPerGame: number | null;
};

export type TeamRadarSource = {
  attack: TeamAttackStats | null;
  defense: TeamDefenseStats | null;
  rank: number | null;
  totalTeams: number;
  homeProb: number | null;
  awayProb: number | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function safe(v: number | null | undefined, fallback: number): number {
  if (v == null || Number.isNaN(v)) return fallback;
  return v;
}

/** Normalise une valeur dans un range donné vers 0-100. */
function normalize(v: number, min: number, max: number): number {
  if (max <= min) return 50;
  return clamp(((v - min) / (max - min)) * 100, 0, 100);
}

// ---------------------------------------------------------------------------
// Scores individuels par axe
// ---------------------------------------------------------------------------

/** Rating : probabilité implicite de victoire (cotes) → 0-100. */
function scoreRating(homeProb: number | null, awayProb: number | null, isHome: boolean): number {
  const prob = isHome ? safe(homeProb, 0.5) : safe(awayProb, 0.5);
  return clamp(prob * 100, 0, 100);
}

/** Squad : rang en ligue → 0-100 (1er = 100, dernier = ~40). */
function scoreSquad(rank: number | null, totalTeams: number): number {
  const r = safe(rank, Math.ceil(totalTeams / 2));
  if (totalTeams <= 1) return 50;
  // 1er = 100, dernier = 40 (pas 0 pour garder un minimum)
  return clamp(100 - ((r - 1) / (totalTeams - 1)) * 60, 40, 100);
}

/** Goalkeepers : cleanSheetPct + concededPerGame inversé. */
function scoreGoalkeepers(defense: TeamDefenseStats | null): number {
  if (!defense) return 50;
  const csPct = safe(defense.cleanSheetPct, 50);
  const cpg = safe(defense.concededPerGame, 1.5);
  // 0.6 * cleanSheetPct + 0.4 * (1 - cpg/3) * 100
  const cpgScore = clamp((1 - cpg / 3) * 100, 0, 100);
  return clamp(0.6 * csPct + 0.4 * cpgScore, 0, 100);
}

/** Defence : moyenne normalisée de cleanSheetPct, tackles/game, defActions/game. */
function scoreDefence(defense: TeamDefenseStats | null): number {
  if (!defense) return 50;
  const csPct = safe(defense.cleanSheetPct, 50);
  const tkl = safe(defense.tacklesPerGame, 20);
  const dpa = safe(defense.defActionsPerGame, 50);
  // Normaliser chaque métrique sur un range raisonnable
  const csScore = clamp(csPct, 0, 100);
  const tklScore = normalize(tkl, 10, 35); // 10-35 tackles/game → 0-100
  const dpaScore = normalize(dpa, 30, 80); // 30-80 def actions/game → 0-100
  return clamp((csScore + tklScore + dpaScore) / 3, 0, 100);
}

/** Midfield : proxy via attackFrequency + shotsPerGame. */
function scoreMidfield(attack: TeamAttackStats | null, defense: TeamDefenseStats | null): number {
  const af = attack ? safe(attack.attackFrequency, 15) : 15;
  const spg = attack ? safe(attack.shotsPerGame, 12) : 12;
  const dpa = defense ? safe(defense.defActionsPerGame, 50) : 50;
  // af (5-25%) → 0-100, spg (5-20) → 0-100, dpa proxy possession inverse
  const afScore = normalize(af, 5, 25);
  const spgScore = normalize(spg, 5, 20);
  // Plus d'actions défensives = moins de possession = score midfield plus bas
  const possProxy = 100 - normalize(dpa, 30, 80);
  return clamp((afScore + spgScore + possProxy) / 3, 0, 100);
}

/** Attack : goalsPerGame, shotsPerGame, xGPerGame. */
function scoreAttack(attack: TeamAttackStats | null): number {
  if (!attack) return 50;
  const gpg = safe(attack.goalsPerGame, 1.3);
  const spg = safe(attack.shotsPerGame, 12);
  const xg = safe(attack.xGPerGame, 1.3);
  const gpgScore = normalize(gpg, 0.5, 3.0);
  const spgScore = normalize(spg, 5, 20);
  const xgScore = normalize(xg, 0.5, 3.0);
  return clamp((gpgScore + spgScore + xgScore) / 3, 0, 100);
}

// ---------------------------------------------------------------------------
// Calcul complet d'un match
// ---------------------------------------------------------------------------

/**
 * Calcule les 6 scores radar pour les deux équipes d'un match.
 *
 * @param source - Données source pour chaque équipe
 * @returns RadarMatchData avec scores home/away normalisés 0-100
 */
export function computeRadarData(source: {
  home: TeamRadarSource;
  away: TeamRadarSource;
  match: FootballMatch;
}): RadarMatchData {
  const { home, away, match } = source;
  const homeName = match.home.shortName || match.home.name;
  const awayName = match.away.shortName || match.away.name;

  const totalTeams = Math.max(home.totalTeams, away.totalTeams, 2);

  return {
    homeName,
    awayName,
    home: {
      rating: scoreRating(home.homeProb, home.awayProb, true),
      squad: scoreSquad(home.rank, totalTeams),
      goalkeepers: scoreGoalkeepers(home.defense),
      defence: scoreDefence(home.defense),
      midfield: scoreMidfield(home.attack, home.defense),
      attack: scoreAttack(home.attack),
    },
    away: {
      rating: scoreRating(away.homeProb, away.awayProb, false),
      squad: scoreSquad(away.rank, totalTeams),
      goalkeepers: scoreGoalkeepers(away.defense),
      defence: scoreDefence(away.defense),
      midfield: scoreMidfield(away.attack, away.defense),
      attack: scoreAttack(away.attack),
    },
  };
}

/** Labels des axes pour l'affichage. */
export const RADAR_AXIS_LABELS: Record<RadarAxisKey, string> = {
  rating: "Rating",
  squad: "Squad",
  goalkeepers: "Goalkeepers",
  defence: "Defence",
  midfield: "Midfield",
  attack: "Attack",
};

/** Ordre d'affichage des axes (sens horaire depuis le haut). */
export const RADAR_AXIS_ORDER: RadarAxisKey[] = [
  "rating",
  "attack",
  "midfield",
  "defence",
  "goalkeepers",
  "squad",
];
