"use client";

// Hook pour récupérer les stats enrichies (Elo Surface, SPS, rangs) d'un
// ensemble de joueurs depuis /api/tennis/player-stats.
//
// Pattern : un seul fetch SWR pour TOUS les matchs visibles (on rassemble
// les noms uniques + la surface dominante), plutôt qu'un fetch par match.
// Le résultat est indexé par nom normalisé pour une lookup O(1) côté UI.

import useSWR from "swr";
import type { PlayerStatsMap } from "@/lib/tennis-stats/types";

type ApiResponse = PlayerStatsMap;

const fetcher = async (url: string): Promise<ApiResponse> => {
  const res = await fetch(url);
  if (!res.ok) return {}; // dégradation gracieuse — jamais d'erreur thrown
  return res.json();
};

/**
 * Récupère les stats enrichies pour un batch de noms de joueurs.
 *
 * @param names Noms (séparés par virgule) — le hook ignore si vide.
 * @param surface Surface du match (Dur / Terre battue / Gazon).
 * @returns map { [normalizedName]: PlayerStats } via SWR.
 */
export function usePlayerStats(names: string, surface: string) {
  // Clé SWR : on garde names+surface dans l'URL pour le cache navigateur.
  // Si names est vide, on passe une clé null → pas de fetch.
  const key = names && names.trim()
    ? `/api/tennis/player-stats?names=${encodeURIComponent(names)}&surface=${encodeURIComponent(surface)}`
    : null;

  return useSWR<ApiResponse>(key, fetcher, {
    refreshInterval: 5 * 60_000, // 5 min — les stats changent lentement
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
    errorRetryCount: 1,
    // En cas d'erreur réseau, on garde les données précédentes (pas de crash UI)
    keepPreviousData: true,
  });
}
