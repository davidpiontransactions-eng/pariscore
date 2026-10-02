"use client";

import useSWR from "swr";

/** Ligne de projection : rang actuel vs rang projeté fin de saison. */
export type ProjectorTeam = {
  team: string;
  /** Rang actuel (classement réel au snapshot). */
  currentRank: number;
  /** Points actuels. */
  currentPts: number;
  /** Points finaux projetés (modèle ExtraTrees). */
  projectedPts: number;
  /** Rang final projeté. */
  projectedRank: number;
  /** Écart : positif = l'équipe montera, négatif = elle descendra. */
  delta: number;
};

export type RankProjectorPayload = {
  league: string;
  meta: {
    status: "ok" | "too_early" | "no_data";
    season?: string;
    model?: string;
    /** Fraction de saison jouée au snapshot (0-1). */
    snapshot_frac?: number;
    snapshot_matches?: number;
    expected_matches?: number;
    /** early (<30%) / mid (<70%) / late — indicateur de fiabilité UI. */
    phase?: "early" | "mid" | "late";
    walkforward?: {
      spearman_gate: number;
      naive_spearman: number | null;
      gate_frac: number;
    };
    generated_at?: string;
    paper?: string;
  };
  teams: ProjectorTeam[];
};

// Ligue non couverte par le modèle (404) → null : la carte reste masquée.
const fetcher = async (url: string): Promise<RankProjectorPayload | null> => {
  const r = await fetch(url);
  if (!r.ok) return null;
  return (await r.json()) as RankProjectorPayload;
};

/**
 * Hook SWR : projection de classement fin de saison
 * (JSON statique public/data/rank-projector/{league}.json,
 * généré par scripts/fit_rank_projector.py — papier JISTA 2026).
 */
export function useRankProjector(league: string | null) {
  const { data, error, isLoading } = useSWR<RankProjectorPayload | null>(
    league ? `/data/rank-projector/${league}.json` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60 * 60 * 1000, // 1h (JSON régénéré hors-ligne)
      errorRetryCount: 1,
    },
  );

  // Masque les statuts sans équipes (too_early / no_data)
  const projection =
    data && data.meta.status === "ok" && data.teams.length > 0 ? data : null;

  return { projection, isLoading, isError: !!error };
}
