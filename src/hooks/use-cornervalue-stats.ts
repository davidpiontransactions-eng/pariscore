"use client";

import useSWR from "swr";

export interface CornervalueTeam {
  teamName: string;
  avgCornersFT: number | null;
  avgCornersFor: number | null;
  avgCornersAgainst: number | null;
  hitRates: Record<string, { pct: number; hit: number; total: number }>;
}

export interface CornervalueLeague {
  meta: {
    leagueName: string;
    leagueSlug: string;
    leagueAvgFT: number | null;
    lastUpdated: string;
    source: string;
  };
  teams: CornervalueTeam[];
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/** Charge les stats Cornervalue pour une ligue donnee. */
export function useCornervalueStats(leagueSlug: string | null) {
  const url = leagueSlug
    ? `/data/metrics/cornervalue_${leagueSlug}.json`
    : null;

  const { data, error, isLoading } = useSWR<CornervalueLeague>(url, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 3600_000, // 1h cache
  });

  return { data, error, isLoading };
}

/** Calcule le hit rate estime pour over 6.5 a partir des donnees over 7.5 */
export function estimateOver65(hitRates: CornervalueTeam["hitRates"]): number | null {
  const o75 = hitRates["over7_5"];
  if (!o75) return null;
  // Over 6.5 ≈ Over 7.5 + ~15% (empirique : si 71% O7.5 → ~86% O6.5)
  return Math.min(100, o75.pct + 15);
}

/** Matcher fuzzy entre nom FootyStats et nom Cornervalue */
export function matchTeamName(cvName: string, fsName: string): boolean {
  const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const c = clean(cvName);
  const f = clean(fsName);
  return c === f || c.includes(f) || f.includes(c);
}

/** Trouve les stats Cornervalue pour une equipe donnee */
export function findTeamCornerStats(
  teamName: string,
  cvData: CornervalueLeague | undefined,
): CornervalueTeam | undefined {
  if (!cvData?.teams) return undefined;
  return cvData.teams.find((t) => matchTeamName(t.teamName, teamName));
}
