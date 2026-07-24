"use client";

// Hook pour la recherche unifiée joueurs + tournois tennis.
//
// Pattern : SWR avec clé conditionnelle (null si query < 2 caractères → pas
// de fetch) + debounce maison 300 ms pour absorber les frappes rapides sans
// lib supplémentaire (cohérent avec use-player-stats.ts).
//
// Le fetcher ne lève jamais d'erreur (dégradation gracieuse) : en cas d'échec
// HTTP, on retourne un résultat vide pour éviter de crasher l'autocomplete.

import { useEffect, useState } from "react";
import useSWR from "swr";
import type {
  PlayerResult,
  SearchResponse,
  SearchType,
  TournamentResult,
} from "@/lib/tennis-search-types";

/** Réponse vide retournée en cas d'erreur réseau (dégradation gracieuse). */
const EMPTY_RESPONSE: SearchResponse = {
  players: [],
  tournaments: [],
  total: 0,
  query: "",
  type: "all",
  source: "empty",
  updatedAt: "",
};

/** Format attendu (alias de SearchResponse pour le fetcher). */
type ApiResponse = SearchResponse;

const fetcher = async (url: string): Promise<ApiResponse> => {
  const res = await fetch(url);
  if (!res.ok) return EMPTY_RESPONSE; // jamais d'erreur thrown
  return res.json();
};

/**
 * Recherche autocomplete de joueurs + tournois tennis.
 *
 * @param query  Texte saisi (debounce 300 ms, ignoré si < 2 caractères).
 * @param type   "players" | "tournaments" | "all" (défaut "all").
 * @returns données SWR `{ data, error, isLoading, isValidating }` avec
 *          `data.players` et `data.tournaments`.
 */
export function useTennisSearch(
  query: string,
  type: SearchType = "all",
) {
  // Debounce maison : on ne propage la query qu'après 300 ms d'inactivité.
  const [debounced, setDebounced] = useState(query);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(id);
  }, [query]);

  // Clé SWR conditionnelle : null si query trop courte → pas de fetch.
  const trimmed = debounced.trim();
  const key = trimmed.length >= 2
    ? `/api/tennis/search?q=${encodeURIComponent(trimmed)}&type=${type}`
    : null;

  return useSWR<ApiResponse>(key, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
    errorRetryCount: 1,
    // Garde les résultats précédents pendant la frappe (évite le flash vide)
    keepPreviousData: true,
  });
}

// Re-export des types pour les consommateurs du hook (commodité).
export type { PlayerResult, TournamentResult, SearchResponse, SearchType };
