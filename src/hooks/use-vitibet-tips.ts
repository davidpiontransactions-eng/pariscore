"use client";

import { useMemo } from "react";
import useSWR from "swr";
import type { HandballMatch } from "@/lib/handball-data";
import type { VitibetBacktestResult, VitibetTip } from "@/lib/vitibet/types";

const fetchJson = <T>(url: string): Promise<T> =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json() as Promise<T>;
  });

type VitibetPayload = {
  count: number;
  tips: VitibetTip[];
  generatedAt: string;
  /** σ des erreurs de prédiction des totaux (pill Over, f1qc) — null si n < 30. */
  scoreSigma?: { sigma: number; n: number } | null;
};

type VitibetBacktestPayload = {
  backtest: VitibetBacktestResult;
  generatedAt: string;
};

const SWR_OPTS = {
  revalidateOnFocus: false,
  dedupingInterval: 5 * 60_000,
} as const;

/** Jour civil Europe/Paris d'un kickoff ISO (« AAAA-MM-JJ »). */
const PARIS_DAY_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * Normalise un nom d'équipe pour le rapprochement Vitibet ↔ snapshot :
 * minuscules, sans accents ni ponctuation (« PSG » ≠ « Paris Saint-Germain »
 * reste non matché — jamais de tip inventé sur un rapprochement douteux).
 */
function normName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Pronostics Vitibet de la fenêtre J → J+3 (une seule requête).
 * `tipFor` rapproche un match du snapshot par (jour Paris, équipes normalisées),
 * avec repli sur les seuls noms si les dates divergent.
 */
export function useVitibetTips() {
  const { data, error, isLoading } = useSWR<VitibetPayload>(
    "/api/v1/vitibet",
    fetchJson,
    SWR_OPTS,
  );

  const { tips, tipFor } = useMemo(() => {
    const list = data?.tips ?? [];
    const byDateNames = new Map<string, VitibetTip>();
    const byNames = new Map<string, VitibetTip>();
    for (const t of list) {
      const names = `${normName(t.equipeDom)}|${normName(t.equipeExt)}`;
      byDateNames.set(`${t.dateMatch}|${names}`, t);
      if (!byNames.has(names)) byNames.set(names, t);
    }
    const lookup = (m: HandballMatch): VitibetTip | undefined => {
      const names = `${normName(m.home.name)}|${normName(m.away.name)}`;
      const kickoff = new Date(m.kickoff);
      if (!Number.isNaN(kickoff.getTime())) {
        const hit = byDateNames.get(`${PARIS_DAY_FMT.format(kickoff)}|${names}`);
        if (hit) return hit;
      }
      return byNames.get(names);
    };
    return { tips: list, tipFor: lookup };
  }, [data]);

  return { tips, tipFor, error, isLoading, isReady: !!data };
}

/** Top `limit` des pronostics J → J+3 par |INDEX| décroissant (section Top 10). */
export function useVitibetTop(limit = 10) {
  const { data, error, isLoading } = useSWR<VitibetPayload>(
    `/api/v1/vitibet?top=${limit}`,
    fetchJson,
    SWR_OPTS,
  );
  return {
    tips: data?.tips ?? [],
    scoreSigma: data?.scoreSigma ?? null,
    error,
    isLoading,
    isReady: !!data,
  };
}

/** Backtest des tips Vitibet (T6) : taux de réussite FT vs prédit. */
export function useVitibetBacktest() {
  const { data, error, isLoading } = useSWR<VitibetBacktestPayload>(
    "/api/v1/vitibet?backtest=1",
    fetchJson,
    SWR_OPTS,
  );
  return { backtest: data?.backtest ?? null, error, isLoading, isReady: !!data };
}
