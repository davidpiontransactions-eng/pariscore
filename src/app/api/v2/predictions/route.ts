/**
 * GET /api/v2/predictions?matchId=xxx — Prédiction pour un match (Prisma).
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const matchId = searchParams.get("matchId");

    if (!matchId) {
      return NextResponse.json({ error: "matchId requis" }, { status: 400 });
    }

    const prediction = await prisma.prediction.findUnique({
      where: { matchId },
    });

    if (!prediction) {
      return NextResponse.json({ error: "Prédiction non trouvée" }, { status: 404 });
    }

    return NextResponse.json(prediction);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
