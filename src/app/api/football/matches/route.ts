import { NextResponse } from "next/server";
import { getFootballMatches } from "@/lib/football-shared-fetcher";

export async function GET() {
  try {
    const { entry, now } = await getFootballMatches();
    return NextResponse.json({
      matches: entry.data.matches,
      source: entry.data.source,
      degraded: entry.data.degraded,
      updatedAt: new Date(entry.data.degraded ? now : entry.at).toISOString(),
    });
  } catch (err) {
    console.error("[football] fetch failed:", (err as Error).message);
    return NextResponse.json(
      { error: "football data unavailable" },
      { status: 503 }
    );
  }
}
