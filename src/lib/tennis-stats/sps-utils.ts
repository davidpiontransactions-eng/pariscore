/**
 * SPS (Surface PowerScore) — utilitaires de mapping et d'affichage.
 *
 * Le SPS est un score [0-100] calculé par surface de jeu (Dur / Terre battue /
 * Gazon) qui résume la performance d'un joueur sur les 12 derniers mois sur
 * cette surface. Il combine :
 *   - Win rate pondéré par le niveau de l'adversaire
 *   - Écart-type des résultats (régularité)
 *   - Coefficient de forme récente (les 5 derniers matchs pèsent 2×)
 *
 * Ces données sont stockées en base (player_surface_scores) et servies via
 * le hook usePlayerStats + l'API /api/tennis/player-stats.
 */

import type { PlayerStats } from "@/lib/tennis-stats/types";

// ────────────────────────────────────────────
// Types exportés
// ────────────────────────────────────────────

export type SPSData = {
  /** Surface PowerScore [0-100]. */
  value: number;
  /** Rang SPS sur cette surface (1 = meilleur). */
  rank: number;
  /** Confiance (0-1, 1 = échantillon suffisant). */
  confidence: number;
  /** Nombre de matchs pris en compte. */
  matches: number;
};

export type SPSComparison = {
  /** SPS du joueur A. */
  playerA: SPSData | null;
  /** SPS du joueur B. */
  playerB: SPSData | null;
  /** Écart absolu entre les deux SPS. */
  gap: number;
  /** Résumé textuel du duel SPS. */
  summary: string;
};

// ────────────────────────────────────────────
// Helpers d'affichage
// ────────────────────────────────────────────

const EM_DASH = "—";

/** Formate un SPS pour affichage : "72" ou "—". */
export function fmtSPS(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return EM_DASH;
  return String(Math.round(value));
}

/** Formate un rang SPS : "#3" ou "—". */
export function fmtSPSRank(rank: number | null | undefined): string {
  if (rank == null || Number.isNaN(rank)) return EM_DASH;
  return `#${rank}`;
}

/** Formate une confiance SPS : "85%" ou "—". */
export function fmtSPSConfidence(
  confidence: number | null | undefined,
): string {
  if (confidence == null || Number.isNaN(confidence)) return EM_DASH;
  return `${Math.round(confidence * 100)}%`;
}

/** Couleur de badge selon la valeur SPS. */
export function spsTone(value: number): "high" | "mid" | "low" {
  if (value >= 70) return "high";
  if (value >= 50) return "mid";
  return "low";
}

// ────────────────────────────────────────────
// Extraction depuis PlayerStats
// ────────────────────────────────────────────

/**
 * Extrait les données SPS d'un objet PlayerStats (retourné par usePlayerStats).
 *
 * @param stats — PlayerStats | null | undefined (nullable depuis SWR)
 * @returns SPSData | null
 *
 * @example
 * ```tsx
 * const spsA = extractSPS(statsA);
 * // → { value: 72, rank: 3, confidence: 0.85, matches: 24 }
 * ```
 */
export function extractSPS(
  stats: PlayerStats | null | undefined,
): SPSData | null {
  if (!stats) return null;
  if (stats.sps == null) return null;

  return {
    value: Math.round(stats.sps),
    rank: stats.spsRank ?? 999,
    confidence: stats.spsConfidence ?? 0,
    matches: stats.spsMatches ?? 0,
  };
}

// ────────────────────────────────────────────
// Comparaison duel
// ────────────────────────────────────────────

/**
 * Compare les SPS de deux joueurs et produit un résumé.
 *
 * @param statsA — PlayerStats du joueur A
 * @param statsB — PlayerStats du joueur B
 * @param nameA — Nom court du joueur A
 * @param nameB — Nom court du joueur B
 * @returns SPSComparison
 *
 * @example
 * ```tsx
 * const cmp = compareSPS(statsA, statsB, "SABALENKA", "OSAKA");
 * // → { playerA: {...}, playerB: {...}, gap: 21, summary: "Sabalenka #4 vs Osaka #12" }
 * ```
 */
export function compareSPS(
  statsA: PlayerStats | null | undefined,
  statsB: PlayerStats | null | undefined,
  nameA: string,
  nameB: string,
): SPSComparison {
  const sA = extractSPS(statsA);
  const sB = extractSPS(statsB);

  const gap =
    sA != null && sB != null ? Math.abs(sA.value - sB.value) : 0;

  const summary =
    sA != null && sB != null
      ? `${nameA} #${sA.rank} vs ${nameB} #${sB.rank}`
      : sA != null
        ? `${nameA} #${sA.rank} vs ${nameB} —`
        : sB != null
          ? `${nameA} — vs ${nameB} #${sB.rank}`
          : "SPS non disponible";

  return { playerA: sA, playerB: sB, gap, summary };
}
