"use client";

import useSWR from "swr";

// ---------------------------------------------------------------------------
// Types — miroir de ComputeRequest / ComputeResponse côté API
// ---------------------------------------------------------------------------

/** Paramètres d'entrée pour le calcul de prédiction. */
interface PredictionComputeInput {
  matchId: string;
  homeElo?: number;
  awayElo?: number;
  homeXG?: number;
  awayXG?: number;
}

/** Résultat du calcul de prédiction (Poisson + ML hybride). */
interface PredictionComputeResult {
  matchId: string;
  markets: {
    homeProb: number;
    drawProb: number;
    awayProb: number;
    bttsProb: number;
    over25Prob: number;
  };
  model: string;
  confidence: number;
  edge?: number;
  ml?: {
    homeProb: number;
    drawProb: number;
    awayProb: number;
    trend: string;
    summary: string;
  };
}

// ---------------------------------------------------------------------------
// Fetcher POST — envoie le body JSON et parse la réponse
// ---------------------------------------------------------------------------

async function postFetcher<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
  return json as T;
}

// ---------------------------------------------------------------------------
// Hook principal — prédiction compute pour un match
// ---------------------------------------------------------------------------

/**
 * Récupère les prédictions calculées (Poisson + ML hybride) pour un match.
 * Ne fetch que quand `input` est fourni et contient un matchId.
 */
export function usePredictionCompute(input: PredictionComputeInput | null) {
  const key = input?.matchId
    ? [`/api/v1/predictions/compute`, input] as const
    : null;

  const { data, error, isLoading, mutate } = useSWR<PredictionComputeResult>(
    key,
    ([url, body]) => postFetcher<PredictionComputeResult>(url, body),
    {
      revalidateOnFocus: false,
      dedupingInterval: 60_000, // 1 min de déduplication
    },
  );

  return { prediction: data ?? null, isLoading, error, mutate };
}

// ---------------------------------------------------------------------------
// Hook batch — prédictions pour plusieurs matchs en parallèle
// ---------------------------------------------------------------------------

type BatchResponse = { predictions: PredictionComputeResult[] };

/**
 * Récupère les prédictions pour une liste de matchIds en un seul appel.
 * Si la liste est vide, ne fetch rien.
 */
export function usePredictionBatch(matchIds: string[]) {
  const key = matchIds.length > 0
    ? [`/api/v1/predictions/compute/batch`, { matchIds }] as const
    : null;

  const { data, error, isLoading } = useSWR<BatchResponse>(
    key,
    ([url, body]) => postFetcher<BatchResponse>(url, body),
    {
      revalidateOnFocus: false,
      dedupingInterval: 60_000,
    },
  );

  // Indexe les résultats par matchId pour un accès O(1)
  const predictions = new Map<string, PredictionComputeResult>();
  if (data?.predictions) {
    for (const p of data.predictions) {
      predictions.set(p.matchId, p);
    }
  }

  return { predictions, isLoading, error };
}
