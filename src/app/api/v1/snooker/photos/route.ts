import { NextResponse } from "next/server";
import { getPhotoDatabaseStats } from "@/lib/snooker/player-photos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const stats = getPhotoDatabaseStats();
  return NextResponse.json({
    photos_available: stats.total,
    // source_file retiré : ne pas exposer de chemin absolu serveur (audit lot3)
    message: `${stats.total} photos joueurs disponibles en base locale`,
  });
}
