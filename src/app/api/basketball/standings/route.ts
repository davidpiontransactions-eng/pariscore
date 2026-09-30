/**
 * API route — Stats & Classements basketball (sous-onglet du même nom).
 * GET /api/basketball/standings?league=nba|wnba
 *
 * Une ligne par équipe : abbr, conférence, V-D, PPG/PPG Home/PPG Away/Points
 * (SQLite basketball_match_history) + FG%/2P%/3P%/FT%/RPG/AST/TO/STL/BLK/PF
 * (ESPN statistics). Cache multi-worker 10 min (pattern history route).
 */

import { NextRequest, NextResponse } from "next/server";

type Entry = { data: unknown; at: number };
const g = globalThis as unknown as { __bbStandingsCache?: Map<string, Entry> };
const cacheMap = (g.__bbStandingsCache ??= new Map<string, Entry>());
const CACHE_TTL = 10 * 60_000;

const VALID = new Set(["nba", "wnba"]);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const league = (searchParams.get("league") || "nba").toLowerCase();
  if (!VALID.has(league)) {
    return NextResponse.json(
      { error: "paramètre league invalide", details: "league=nba|wnba requis" },
      { status: 400 },
    );
  }

  const cached = cacheMap.get(league);
  if (cached && Date.now() - cached.at < CACHE_TTL) {
    return NextResponse.json(cached.data);
  }

  try {
    // Service legacy JS (dossier services/, non bundlé).
    const svc = require("../../../../../services/basketballStandingsService.js") as {
      getStandingsFull: (league: string) => Promise<unknown>;
    };
    const data = await svc.getStandingsFull(league);
    cacheMap.set(league, { data, at: Date.now() });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: "classements indisponibles", details: (err as Error).message },
      { status: 503 },
    );
  }
}
