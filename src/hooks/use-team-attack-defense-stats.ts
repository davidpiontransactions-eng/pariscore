"use client";

import useSWR from "swr";
import type { TeamAttackDefenseLeague } from "@/lib/football-data";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/** Charge les stats Attaque/Defense pour une ligue donnee. */
export function useTeamAttackDefenseStats(leagueSlug: string | null) {
  const url = leagueSlug
    ? `/data/metrics/team_stats_${leagueSlug}.json`
    : null;

  const { data, error, isLoading } = useSWR<TeamAttackDefenseLeague>(
    url,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 3600_000, // 1h cache
    },
  );

  return { data, error, isLoading };
}

/** Trouve les stats d'une equipe par fuzzy match. */
export function findTeamADStats(
  teamName: string,
  adData: TeamAttackDefenseLeague | undefined,
) {
  if (!adData?.teams) return undefined;
  const clean = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const key = clean(teamName);
  return adData.teams.find((t) => clean(t.teamName) === key);
}
