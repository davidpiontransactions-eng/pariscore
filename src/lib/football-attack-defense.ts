/**
 * football-attack-defense.ts — Scores composites Attaque/Défense Home/Away.
 *
 * Formule (basée sur recherche académique) :
 * - Attaque = 35% xG + 25% buts pg + 25% tirs cadrés pg + 15% conversion
 * - Défense = 35% xGA inversé + 25% buts encaissés inv + 25% save% + 15% clean sheet%
 *
 * Sources :
 * - Poisson + xG (Leicester Study 2025) : xG = meilleur prédicteur
 * - GK Save Ability (Kim 2025) : save% = proxy gardien
 * - Modèle combiné (Bergius 2025) : xG + stats traditionnelles = accuracy max
 */

import type { FootballMatch, FbrefTeamAdvancedStats } from "./football-data";
import type { MetricValue } from "./football-data";

// ── Types ──────────────────────────────────────────────────────────────────

export interface AttackDefenseScore {
  /** Score attaque 0-100 (100 = meilleure attaque). */
  attack: number;
  /** Score défense 0-100 (100 = meilleure défense). */
  defense: number;
  /** Score global (moyenne pondérée attaque 60% + défense 40%). */
  overall: number;
  /** Décomposition attaque. */
  attackBreakdown: {
    xG: number | null;
    goalsPg: number | null;
    sotPg: number | null;
    conversion: number | null;
  };
  /** Décomposition défense. */
  defenseBreakdown: {
    xGA: number | null;
    concededPg: number | null;
    savePct: number | null;
    csPct: number | null;
  };
}

export interface MatchAttackDefense {
  home: AttackDefenseScore;
  away: AttackDefenseScore;
  /** Avantage domicile (home.overall - away.overall). */
  homeAdvantage: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function norm(val: number | null, min: number, max: number): number {
  if (val === null) return 50; // neutre si pas de données
  return Math.max(0, Math.min(100, ((val - min) / (max - min)) * 100));
}

function invNorm(val: number | null, min: number, max: number): number {
  if (val === null) return 50;
  return Math.max(0, Math.min(100, 100 - ((val - min) / (max - min)) * 100));
}

function safeVal(m: MetricValue | undefined): number | null {
  if (!m) return null;
  return m.value;
}

// ── Poids ──────────────────────────────────────────────────────────────────

const ATTACK_WEIGHTS = {
  xG: 0.35,
  goalsPg: 0.25,
  sotPg: 0.25,
  conversion: 0.15,
};

const DEFENSE_WEIGHTS = {
  xGA: 0.35,
  concededPg: 0.25,
  savePct: 0.25,
  csPct: 0.15,
};

// ── bornes typiques (moyennes ligue big 5) ─────────────────────────────────

const ATTACK_BOUNDS = {
  xG: { min: 0.5, max: 2.5 },
  goalsPg: { min: 0.5, max: 2.5 },
  sotPg: { min: 3, max: 8 },
  conversion: { min: 5, max: 20 },
};

const DEFENSE_BOUNDS = {
  xGA: { min: 0.5, max: 2.5 },
  concededPg: { min: 0.5, max: 2.5 },
  savePct: { min: 55, max: 80 },
  csPct: { min: 10, max: 50 },
};

// ── Calcul principal ───────────────────────────────────────────────────────

export function computeAttackDefense(
  match: FootballMatch,
): MatchAttackDefense | null {
  const pred = match.prediction;
  if (!pred) return null;

  const fbref = pred.fbrefAdvanced;
  const metrics = pred.metricStats;
  const xg = pred.xGa;

  // Estimations xG depuis metricStats (fallback si pas de xGa)
  const estXgH = safeVal(metrics?.home?.goals?.scoredPg) ?? 1.3;
  const estXgA = safeVal(metrics?.away?.goals?.scoredPg) ?? 1.1;
  const estXgaH = safeVal(metrics?.home?.goals?.concededPg) ?? 1.3;
  const estXgaA = safeVal(metrics?.away?.goals?.concededPg) ?? 1.1;

  const home = computeTeamScore(
    {
      xG: xg?.home ?? estXgH,
      goalsPg: safeVal(metrics?.home?.goals?.scoredPg),
      sotPg: safeVal(metrics?.home?.sot?.for),
      conversion: null, // pas de données de conversion fiables
    },
    {
      xGA: xg?.home ?? estXgaH,
      concededPg: safeVal(metrics?.home?.goals?.concededPg),
      savePct: fbref?.home?.savePct ?? null,
      csPct: fbref?.home?.csPct ?? null,
    },
  );

  const away = computeTeamScore(
    {
      xG: xg?.away ?? estXgA,
      goalsPg: safeVal(metrics?.away?.goals?.scoredPg),
      sotPg: safeVal(metrics?.away?.sot?.for),
      conversion: null,
    },
    {
      xGA: xg?.away ?? estXgaA,
      concededPg: safeVal(metrics?.away?.goals?.concededPg),
      savePct: fbref?.away?.savePct ?? null,
      csPct: fbref?.away?.csPct ?? null,
    },
  );

  return {
    home,
    away,
    homeAdvantage: home.overall - away.overall,
  };
}

function computeTeamScore(
  attack: {
    xG: number | null;
    goalsPg: number | null;
    sotPg: number | null;
    conversion: number | null;
  },
  defense: {
    xGA: number | null;
    concededPg: number | null;
    savePct: number | null;
    csPct: number | null;
  },
): AttackDefenseScore {
  // Score attaque
  const xgScore = norm(attack.xG, ATTACK_BOUNDS.xG.min, ATTACK_BOUNDS.xG.max);
  const goalsScore = norm(attack.goalsPg, ATTACK_BOUNDS.goalsPg.min, ATTACK_BOUNDS.goalsPg.max);
  const sotScore = norm(attack.sotPg, ATTACK_BOUNDS.sotPg.min, ATTACK_BOUNDS.sotPg.max);
  const convScore = norm(attack.conversion, ATTACK_BOUNDS.conversion.min, ATTACK_BOUNDS.conversion.max);

  const attackScore = Math.round(
    xgScore * ATTACK_WEIGHTS.xG +
    goalsScore * ATTACK_WEIGHTS.goalsPg +
    sotScore * ATTACK_WEIGHTS.sotPg +
    convScore * ATTACK_WEIGHTS.conversion,
  );

  // Score défense (inversé : moins de buts encaissés = meilleur)
  const xgaScore = invNorm(defense.xGA, DEFENSE_BOUNDS.xGA.min, DEFENSE_BOUNDS.xGA.max);
  const concededScore = invNorm(defense.concededPg, DEFENSE_BOUNDS.concededPg.min, DEFENSE_BOUNDS.concededPg.max);
  const saveScore = norm(defense.savePct, DEFENSE_BOUNDS.savePct.min, DEFENSE_BOUNDS.savePct.max);
  const csScore = norm(defense.csPct, DEFENSE_BOUNDS.csPct.min, DEFENSE_BOUNDS.csPct.max);

  const defenseScore = Math.round(
    xgaScore * DEFENSE_WEIGHTS.xGA +
    concededScore * DEFENSE_WEIGHTS.concededPg +
    saveScore * DEFENSE_WEIGHTS.savePct +
    csScore * DEFENSE_WEIGHTS.csPct,
  );

  const overall = Math.round(attackScore * 0.6 + defenseScore * 0.4);

  return {
    attack: attackScore,
    defense: defenseScore,
    overall,
    attackBreakdown: attack,
    defenseBreakdown: defense,
  };
}

// ── Label UI ───────────────────────────────────────────────────────────────

export function attackDefenseLabel(score: number): "elite" | "fort" | "moyen" | "faible" {
  if (score >= 75) return "elite";
  if (score >= 55) return "fort";
  if (score >= 35) return "moyen";
  return "faible";
}

export function attackDefenseColor(score: number): string {
  if (score >= 75) return "#22c55e"; // vert
  if (score >= 55) return "#84cc16"; // vert clair
  if (score >= 35) return "#f59e0b"; // orange
  return "#ef4444"; // rouge
}
