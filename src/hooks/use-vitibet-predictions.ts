"use client";

/**
 * SWR — prédictions 1xBet (Vitibet) pour une ligue calibrée.
 *
 * Ce hook n'alimente QUE les ligues dont les marchés sont calibrés. La NBA et
 * la WNBA restent servies par `useBasketballMatches` (ESPN + modèle complet
 * Elo/Pythagore/Four Factors/blessures/repos) : mélanger les deux
 * dégraderait un modèle supérieur par une source à 0 % de couverture sur ces
 * ligues (mesuré : `nba` 0/16, `eurocup` 0/16, `euroleague` 7/7).
 *
 * Le contrat de la route garantit déjà qu'aucune ligue non calibrée n'est
 * servie, même si l'URL est forcée.
 */

import useSWR from "swr";

import type { BasketballLeagueId } from "@/lib/basketball-data";

export type VitibetH2hRow = {
  date: string | null;
  home: string;
  away: string;
  homeScore: number | null;
  awayScore: number | null;
};

export type VitibetTeam = {
  name: string;
  statsAvailable: boolean;
  pointsPerGame: number | null;
};

export type VitibetPrediction = {
  id: string;
  league: BasketballLeagueId;
  scheduledAt: string;
  home: VitibetTeam;
  away: VitibetTeam;
  /** false ⇒ tous les champs de prédiction sont `null` et une raison est donnée. */
  predictionsAvailable: boolean;
  predictionsUnavailableReason: string | null;
  index: number | null;
  probHome: number | null;
  probDraw: number | null;
  probAway: number | null;
  tip: string | null;
  predictedScore: string | null;
  teamPower: { home: number | null; away: number | null };
  form: { home: number | null; away: number | null };
  h2h: VitibetH2hRow[];
  bsdMatched: boolean;
};

type VitibetResponse = {
  matches: VitibetPrediction[];
  scrapedAt: string | null;
  counts?: {
    served: number;
    withPredictions: number;
    withoutPredictions: number;
  };
  predictionsAvailable: boolean;
  error?: string;
};

const fetcher = async (url: string): Promise<VitibetResponse> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

/**
 * @param league Ligue calibrée visée. Le serveur filtre de toute façon.
 * @param onlyPredicted `true` ne garde que les matchs portant une proba.
 */
export function useVitibetPredictions(
  league: BasketballLeagueId,
  onlyPredicted = false,
) {
  const params = new URLSearchParams({ leagues: league });
  if (onlyPredicted) params.set("predictionsOnly", "1");

  const { data, error, isLoading } = useSWR<VitibetResponse>(
    `/api/basketball/vitibet?${params.toString()}`,
    fetcher,
    {
      // Le dump est re-scrapé par un cron, pas par l'utilisateur : un refresh
      // plus lent qu'un flux live évite de servir le même JSON en boucle.
      refreshInterval: 5 * 60_000,
      revalidateOnFocus: false,
      dedupingInterval: 60_000,
    },
  );

  return {
    predictions: data?.matches ?? [],
    scrapedAt: data?.scrapedAt ?? null,
    counts: data?.counts ?? null,
    isLoading,
    error: error ?? data?.error ?? null,
  };
}
