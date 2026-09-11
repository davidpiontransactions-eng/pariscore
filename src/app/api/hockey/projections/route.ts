import { NextResponse } from "next/server";
import { createTtlCache, isFresh } from "@/lib/cached-route";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const CACHE_TTL = 30 * 60_000; // 30 minutes

type TeamProjection = {
  id: string;
  abbr: string;
  name: string;
  logoUrl: string;
  conf: "west" | "east";
  div: string;
  winR1: number;
  winR2: number;
  makeFinal: number;
  winCup: number;
};

type ProjectionsPayload = {
  updatedAt: string;
  source: string;
  season: string;
  conferences: {
    west: TeamProjection[];
    east: TeamProjection[];
  };
  teams: TeamProjection[];
};

const cache = createTtlCache<ProjectionsPayload>("__hockeyProjectionsCache");

function loadFromFile(): ProjectionsPayload | null {
  try {
    const filePath = join(process.cwd(), "data", "hockeystats_nhl_projections.json");
    if (!existsSync(filePath)) return null;
    const raw = readFileSync(filePath, "utf8");
    return JSON.parse(raw) as ProjectionsPayload;
  } catch {
    return null;
  }
}

export async function GET() {
  // Cache frais → servir
  const cached = cache.get();
  if (cached) {
    return NextResponse.json(cached);
  }

  // Charger depuis le fichier JSON scrapé
  const data = loadFromFile();
  if (!data) {
    return NextResponse.json(
      { error: "Projections data not available. Run scrape-hockeystats-projections.mjs first." },
      { status: 503 }
    );
  }

  // Mettre en cache
  cache.set(data);

  return NextResponse.json(data);
}
