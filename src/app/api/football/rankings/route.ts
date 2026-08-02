import { NextRequest, NextResponse } from "next/server";
import type { MetricRankings } from "@/lib/football-data";

/**
 * GET /api/football/rankings?leagueId=epl&side=home
 *
 * Proxy vers le fichier statique /public/data/rankings/{leagueId}.json.
 * Cache 1h côté serveur, stale-while-revalidate 24h côté CDN.
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
    const res = await fetch(
      `/data/rankings/${encodeURIComponent(leagueId)}.json`,
      { next: { revalidate: 3600 } }
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: `Rankings not found for league '${leagueId}'` },
        { status: 404 }
      );
    }

    const full = await res.json();
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
