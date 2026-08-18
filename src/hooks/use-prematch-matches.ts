"use client";

import useSWR from "swr";
import type { TennisMatch } from "@/lib/tennis-data";

export type PrematchResponse = {
  matches: TennisMatch[];
  source: "cache" | "cache-stale" | "bsd" | "odds-api" | "mock";
  updatedAt: string;
};

/**
 * Erreur typée de la chaîne d'acquisition prematch. `code` permet à l'UI de
 * distinguer un souci réseau, un HTTP non-2xx ou un payload malformé
 * (drift de shape — bug A9) au lieu d'un message générique.
 */
export type TennisPrematchErrorCode = "NETWORK_ERROR" | "HTTP_ERROR" | "INVALID_PAYLOAD";

export class TennisPrematchError extends Error {
  readonly code: TennisPrematchErrorCode;
  readonly status?: number;

  constructor(code: TennisPrematchErrorCode, message: string, status?: number) {
    super(message);
    this.name = "TennisPrematchError";
    this.code = code;
    this.status = status;
  }
}

const fetcher = async (url: string): Promise<PrematchResponse> => {
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new TennisPrematchError("NETWORK_ERROR", "Tennis API unreachable");
  }
  if (!res.ok) {
    throw new TennisPrematchError("HTTP_ERROR", `Failed to fetch prematch: ${res.status}`, res.status);
  }
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new TennisPrematchError("INVALID_PAYLOAD", "Prematch response is not JSON");
  }
  if (!json || typeof json !== "object" || !Array.isArray((json as PrematchResponse).matches)) {
    throw new TennisPrematchError("INVALID_PAYLOAD", "Prematch payload missing matches array");
  }
  return json as PrematchResponse;
};

/**
 * Hook de la grille prematch tennis.
 *
 * Mode dégradé : la route /api/tennis/prematch répond TOUJOURS 200 avec
 * `source: "mock"` (mock local re-daté) ou `source: "cache-stale"` (cache
 * périmé ≤ 1h) quand les sources externes sont KO. `isDegraded` permet à
 * chaque consommateur d'afficher un bandeau non-bloquant — et aux widgets
 * monétisés (value bets, comparateur) de ne PAS présenter des cotes
 * fabriquées comme réelles.
 *
 * NB : pas de `fallbackData` client — le repli vit côté route, ce qui évite
 * les faux positifs (cotes mock dans le dashboard) et garde `isLoading`
 * opérationnel pour le skeleton.
 */
export function usePrematchMatches() {
  const swr = useSWR<PrematchResponse, TennisPrematchError>("/api/tennis/prematch", fetcher, {
    refreshInterval: 60_000, // poll every 60s
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
    errorRetryCount: 2,
    errorRetryInterval: 5_000,
  });

  const isDegraded =
    swr.error != null ||
    swr.data?.source === "mock" ||
    swr.data?.source === "cache-stale";

  return { ...swr, isDegraded };
}