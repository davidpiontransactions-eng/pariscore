"use client";

import useSWR from "swr";
import type { FibaPlayer } from "@/app/api/fiba/players/route";

type FibaPlayersResponse = {
  players: FibaPlayer[];
  mvpTop10: FibaPlayer[];
  totalPlayers: number;
  phase: string;
  source: string;
};

type UseFibaPlayersOptions = {
  phase?: string;
  stat?: string;
  sort?: string;
  position?: string;
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/**
 * Hook SWR pour les joueuses FIBA WC 2026.
 *
 * @example
 * const { players, mvpTop10, isLoading } = useFibaPlayers({ stat: "composite" });
 */
export function useFibaPlayers(options?: UseFibaPlayersOptions) {
  const params = new URLSearchParams();
  if (options?.phase) params.set("phase", options.phase);
  if (options?.stat) params.set("stat", options.stat);
  if (options?.sort) params.set("sort", options.sort);
  if (options?.position) params.set("position", options.position);

  const queryString = params.toString();
  const url = `/api/fiba/players${queryString ? `?${queryString}` : ""}`;

  const { data, error, isLoading, mutate } = useSWR<FibaPlayersResponse>(
    url,
    fetcher,
    {
      refreshInterval: 300_000, // 5 min
      revalidateOnFocus: true,
      dedupingInterval: 60_000,
    },
  );

  return {
    players: data?.players ?? [],
    mvpTop10: data?.mvpTop10 ?? [],
    totalPlayers: data?.totalPlayers ?? 0,
    source: data?.source ?? "",
    isLoading,
    isError: !!error,
    mutate,
  };
}

/**
 * Hook pour un seul joueur par ID (utilise le même cache).
 */
export function useFibaPlayer(playerId: string | null, allPlayers: FibaPlayer[]) {
  if (!playerId) return null;
  return allPlayers.find((p) => p.playerId === playerId) ?? null;
}
