import { NextRequest, NextResponse } from "next/server";
import { cache, fibaCache } from "@/lib/cache/memory-cache";

const ESPN_FIBA_STANDINGS = "https://site.web.api.espn.com/apis/v2/sports/basketball/fiba/standings";

type ESPNStat = {
  name: string;
  value: number;
  displayValue: string;
};

type ESPNTeamEntry = {
  team: {
    id: string;
    abbreviation: string;
    displayName: string;
    shortDisplayName: string;
    color: string;
    logo: string;
  };
  stats: ESPNStat[];
};

type ESPNGroup = {
  name: string;
  id: string;
  standings: {
    entries: ESPNTeamEntry[];
  };
};

/** Équipe dans un groupe FIBA. */
export type FibaTeam = {
  id: string;
  name: string;
  abbr: string;
  color: string;
  logo: string;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  points: number;
};

/** Groupe FIBA. */
export type FibaGroup = {
  name: string;
  id: string;
  teams: FibaTeam[];
};

function normalizeEntry(entry: ESPNTeamEntry): FibaTeam {
  const getStat = (name: string): number => {
    const stat = entry.stats?.find((s) => s.name === name);
    return stat?.value ?? 0;
  };

  return {
    id: entry.team.id,
    name: entry.team.displayName,
    abbr: entry.team.abbreviation,
    color: entry.team.color,
    logo: entry.team.logo,
    wins: getStat("wins"),
    losses: getStat("losses"),
    pointsFor: getStat("pointsfor"),
    pointsAgainst: getStat("pointsagainst"),
    points: getStat("points"),
  };
}

export async function GET(request: NextRequest) {
  const cacheConfig = fibaCache.standings();
  const cached = cache.get(cacheConfig.key);
  
  if (cached) {
    return NextResponse.json(cached);
  }

  try {
    const res = await fetch(ESPN_FIBA_STANDINGS, {
      headers: { "User-Agent": "PariScore/1.0" },
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "ESPN FIBA standings unavailable", status: res.status },
        { status: 503 },
      );
    }

    const json = await res.json();
    const children: ESPNGroup[] = json?.children ?? [];
    const groups = children.map((g) => ({
      name: g.name,
      id: g.id,
      teams: g.standings?.entries?.map(normalizeEntry) ?? [],
    }));

    const data = {
      groups,
      season: json?.season?.year ?? 2026,
      source: "espn-fiba",
    };

    cache.set(cacheConfig.key, data, cacheConfig.ttl);
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch FIBA standings", details: (err as Error).message },
      { status: 500 },
    );
  }
}
