"use client";

import useSWR from "swr";
import type { BeH2H, BeMatch } from "@/lib/betexplorer-handball";

// DTO de /api/handball/h2h?home=…&away=…&limit=…
export type HandballH2HPayload = {
  home: string;
  away: string;
  /** `none` = snapshot BetExplorer absent → `h2h` vide, PAS « pas de confrontation ». */
  source: "betexplorer" | "none";
  scrapedAt: string | null;
  h2h: BeH2H[];
  form: { home: BeMatch[]; away: BeMatch[] };
  lastHalftime: { home: number; away: number } | null;
};

const fetchJson = (url: string): Promise<HandballH2HPayload> =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json() as Promise<HandballH2HPayload>;
  });

/**
 * Confrontations directes + forme récente, lues dans le snapshot BetExplorer.
 *
 * La route existait mais n'était consommée par AUCUN composant : elle était
 * morte depuis sa création. Les types sont importés de `betexplorer-handball`,
 * qui lit `fs` — d'où le passage par l'API et non un import direct dans un
 * composant client.
 *
 * `source: "none"` distingue « la source n'a rien » de « ces deux équipes ne
 * se sont jamais rencontrées » : sans cette distinction, un historique BetExplorer
 * cassé afficherait un H2H vide, indiscernable d'un dossier réellement vierge.
 */
export function useHandballH2H(home: string, away: string, limit = 5) {
  const hasBoth = home.trim() !== "" && away.trim() !== "";
  const key = hasBoth
    ? `/api/handball/h2h?home=${encodeURIComponent(home)}&away=${encodeURIComponent(
        away,
      )}&limit=${limit}`
    : null;
  const { data, error, isLoading } = useSWR<HandballH2HPayload>(key, fetchJson, {
    dedupingInterval: 30 * 60_000,
    revalidateOnFocus: false,
  });
  return {
    h2h: data?.h2h ?? [],
    form: data?.form ?? null,
    lastHalftime: data?.lastHalftime ?? null,
    source: data?.source ?? null,
    scrapedAt: data?.scrapedAt ?? null,
    error,
    isLoading,
  };
}