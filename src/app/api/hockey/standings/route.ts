import { NextResponse } from "next/server";
import { createTtlCache, isFresh } from "@/lib/cached-route";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const CACHE_TTL = 6 * 60_000; // 6h — changements quotidiens

type TeamStanding = {
  rank: number;
  name: string;
  teamId: string | null;
  teamSlug: string | null;
  conf: string;
  gp: number;
  w: number;
  t: number;
  l: number;
  otw: number;
  otl: number;
  gf: number;
  ga: number;
  plusMinus: number;
  tp: number;
  ppg: number;
};

type LeagueData = {
  name: string;
  country: string;
  season: string;
  teams: TeamStanding[];
};

type StandingsPayload = {
  updatedAt: string;
  source: string;
  season: string;
  leagues: Record<string, LeagueData>;
};

const cache = createTtlCache<StandingsPayload>("__hockeyStandingsCache");

function loadFromFile(): StandingsPayload | null {
  try {
    const filePath = join(process.cwd(), "data", "eliteprospects_hockey_standings.json");
    if (!existsSync(filePath)) return null;
    return JSON.parse(readFileSync(filePath, "utf8")) as StandingsPayload;
  } catch {
    return null;
  }
}

export async function GET() {
  const cached = cache.getEntry();
  if (cached?.data && isFresh(cached, CACHE_TTL)) {
    return NextResponse.json(cached.data);
  }

  const data = loadFromFile();
  if (!data) {
    return NextResponse.json(
      { error: "Standings data not available. Run scrape-eliteprospects-hockey.mjs first." },
      { status: 503 }
    );
  }

  cache.set(data);
  return NextResponse.json(data);
}
