import { NextResponse } from "next/server";
import { createTtlCache, isFresh } from "@/lib/cached-route";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const CACHE_TTL = 6 * 60_000; // 6h — changements quotidiens

type PlayerStat = {
  rank: number;
  name: string;
  position: string;
  playerId: string | null;
  playerSlug: string | null;
  team: string;
  gp: number;
  g: number;
  a: number;
  tp: number;
  ppg: number;
  pim: number;
  plusMinus: number;
};

type LeaguePlayerData = {
  name: string;
  season: string;
  players: PlayerStat[];
  topScorers: PlayerStat[];
  topAssists: PlayerStat[];
  topPoints: PlayerStat[];
};

type PlayerStatsPayload = {
  updatedAt: string;
  source: string;
  season: string;
  leagues: Record<string, LeaguePlayerData>;
};

const cache = createTtlCache<PlayerStatsPayload>("__hockeyPlayerStats");

function loadFromFile(): PlayerStatsPayload | null {
  try {
    const filePath = join(process.cwd(), "data", "eliteprospects_player_stats.json");
    if (!existsSync(filePath)) return null;
    return JSON.parse(readFileSync(filePath, "utf8")) as PlayerStatsPayload;
  } catch {
    return null;
  }
}

export async function GET() {
  const cached = cache.getEntry();
  if (cached?.data && isFresh(cached, CACHE_TTL)) return NextResponse.json(cached.data);

  const data = loadFromFile();
  if (!data) {
    return NextResponse.json(
      { error: "Player stats not available. Run scrape-eliteprospects-player-stats.mjs first." },
      { status: 503 }
    );
  }

  cache.set(data);
  return NextResponse.json(data);
}
