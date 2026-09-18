import { NextResponse } from "next/server";
import { getClvStats, getAllEntries } from "@/lib/rugby/clv";

export const dynamic = "force-dynamic";

/**
 * GET /api/rugby/clv?slug=top-14
 * Stats CLV agrégées + entrées détaillées.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("slug") || undefined;
    const detail = searchParams.get("detail") === "1";

    const stats = getClvStats(slug || undefined);
    const entries = detail ? getAllEntries(slug || undefined) : undefined;

    return NextResponse.json({
      stats,
      entries: entries?.slice(-50), // dernières 50 entrées
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[rugby/clv]", error);
    return NextResponse.json(
      { error: "CLV data unavailable" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/rugby/clv
 * Enregistre une entrée CLV.
 * Body: { matchId, slug, date, modelProb, openingOdds, closingOdds? }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { matchId, slug, date, modelProb, openingOdds, closingOdds } = body;

    if (!matchId || !slug || !date || modelProb == null || openingOdds == null) {
      return NextResponse.json(
        { error: "Missing required fields: matchId, slug, date, modelProb, openingOdds" },
        { status: 400 }
      );
    }

    const { recordClv } = await import("@/lib/rugby/clv");
    recordClv({ matchId, slug, date, modelProb, openingOdds, closingOdds: closingOdds ?? null });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[rugby/clv POST]", error);
    return NextResponse.json(
      { error: "Failed to record CLV" },
      { status: 500 }
    );
  }
}
