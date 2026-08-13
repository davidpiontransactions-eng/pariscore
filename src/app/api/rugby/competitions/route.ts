import { NextResponse } from "next/server";
import { getCompetitionsPayload } from "@/lib/rugby/provider";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/rugby/competitions
 * Liste des compétitions rugby couvertes + compteurs de fixtures.
 */
export async function GET() {
  try {
    const payload = await getCompetitionsPayload();
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
    });
  } catch (error) {
    console.error("[rugby/competitions]", error);
    return NextResponse.json(
      { error: "Pipeline rugby indisponible — réessayez." },
      { status: 502 }
    );
  }
}
