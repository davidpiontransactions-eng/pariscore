import { NextResponse } from "next/server";
import { createTtlCache, isFresh } from "@/lib/cached-route";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

export const dynamic = "force-dynamic";

const CACHE_TTL = 60 * 60_000;

type StatBlock = {
  oneXtwo?: {
    homeWins: number;
    draws: number;
    awayWins: number;
    pcts: number[];
    odds: number[];
  };
  oneTwo?: {
    homeWins: number;
    awayWins: number;
    pcts: number[];
    odds: number[];
  };
  totalGoals?: { line: number; underPct: number; overPct: number };
  goalsFor?: { goals: number; pct: number }[];
  goalsAgainst?: { goals: number; pct: number }[];
  btts?: number;
  goalDiff?: { diff: number; pct: number }[];
  goalAverage?: { home: number; away: number; total: number };
};

type OverUnderLine = {
  line: number;
  underPct: number;
  overPct: number;
  underOdds: number | null;
  overOdds: number | null;
  underOddsHome: number | null;
  underOddsAway: number | null;
  underOddsAll: number | null;
  overOddsHome: number | null;
  overOddsAway: number | null;
  overOddsAll: number | null;
  homeUnderPct: { under: number; over: number } | null;
  awayUnderPct: { under: number; over: number } | null;
  allUnderPct: { under: number; over: number } | null;
  homeOverPct: { under: number; over: number } | null;
  awayOverPct: { under: number; over: number } | null;
  allOverPct: { under: number; over: number } | null;
};

type MatchPrematch = {
  team1Id: number;
  team1Name: string;
  team2Id: number;
  team2Name: string;
  date?: string;
  odds1X2?: { home: number; draw: number; away: number } | null;
  h2h?: {
    homeTeam: string;
    awayTeam: string;
    date: string;
    summaryHome: StatBlock | null;
    summaryAway: StatBlock | null;
    h2hStats: StatBlock | null;
    standings: {
      rank: number;
      name: string;
      gp: number;
      all: { w: number; otw: number; otl: number; l: number; pts: number };
      home: { w: number; otw: number; otl: number; l: number; pts: number };
      away: { w: number; otw: number; otl: number; l: number; pts: number };
      highlighted: boolean;
    }[];
  } | null;
  summary?: { overUnderLines: OverUnderLine[] } | null;
  error?: string;
};

type PrematchPayload = {
  updatedAt: string;
  source: string;
  leagues: Record<string, { matches: MatchPrematch[]; error?: string }>;
};

const cache = createTtlCache<PrematchPayload>("__hockeyPrematch");

function loadFromFile(): PrematchPayload | null {
  try {
    const filePath = join(process.cwd(), "data", "annabet_hockey_prematch.json");
    if (!existsSync(filePath)) return null;
    return JSON.parse(readFileSync(filePath, "utf8")) as PrematchPayload;
  } catch {
    return null;
  }
}

export async function GET() {
  cache.invalidate();
  const data = loadFromFile();
  if (!data) {
    return NextResponse.json(
      { error: "Prematch data not available. Run scrape-annabet-hockey-prematch.mjs first." },
      { status: 503 }
    );
  }

  cache.set(data);
  return NextResponse.json(data);
}
