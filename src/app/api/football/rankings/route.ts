import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import type { MetricRankings } from "@/lib/football-data";

/** Structure du fichier statique public/data/rankings/{leagueId}.json */
type RankingsFile = {
  meta?: { league?: string; updatedAt?: string; season?: string };
  home?: MetricRankings;
  away?: MetricRankings;
  metricDefs?: Record<string, unknown>;
};

/**
 * GET /api/football/rankings?leagueId=epl&side=home
 *
 * Sert le fichier statique /public/data/rankings/{leagueId}.json
 * via lecture filesystem — un fetch relatif échoue en Route Handler
 * (pas de base URL) et en build standalone le répertoire public/ est
 * copié dans .next/standalone/. Cache 1h serveur, SWR 24h CDN.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const leagueId = url.searchParams.get("leagueId");
  const side = (url.searchParams.get("side") || "home") as "home" | "away";

  if (!leagueId) {
    return NextResponse.json(
      { error: "leagueId required" },
      { status: 400 }
    );
  }

  if (side !== "home" && side !== "away") {
    return NextResponse.json(
      { error: "side must be 'home' or 'away'" },
      { status: 400 }
    );
  }

  try {
    const filePath = path.join(
      process.cwd(),
      "public",
      "data",
      "rankings",
      `${leagueId}.json`
    );
    const raw = await readFile(filePath, "utf8");
    const full: RankingsFile = JSON.parse(raw);
    const data: MetricRankings = full[side] ?? {};

    return NextResponse.json(data, {
      headers: {
        "Cache-Control":
          "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (err) {
    console.error(
      `[rankings-api] ${leagueId}/${side}:`,
      (err as Error).message
    );
    return NextResponse.json(
      { error: "Rankings unavailable — upstream error" },
      { status: 503 }
    );
  }
}
