// GET /api/tennis/player-stats
//
// Retourne les stats enrichies (Elo, ranking ATP/WTA, Elo Surface, rang
// surface, SPS, rang SPS) pour un batch de joueurs, lus directement depuis
// pariscore.db (via lib/tennis-stats/db.ts).
//
// Query params:
//   names=P1,P2,P3   — noms de joueurs séparés par virgule (requis, cap 50)
//   surface=Dur       — surface du match (Dur / Terre battue / Gazon / Hard / Clay / Grass)
//
// Réponse: { [normalizedName]: PlayerStats }
//
// Conception défensive — cette route ne lève JAMAIS de 500 : si la base est
// absente en local dev, elle renvoie 200 avec un objet vide `{}` et le UI
// dégrade en affichant `—` pour les valeurs manquantes.

import { NextResponse } from "next/server";
import { apiErrorHandler } from "@/lib/api-error-handler";
import { ValidationError } from "@/lib/api-error";
import { getPlayerStatsBatch } from "@/lib/tennis-stats/db";

const CACHE_TTL_MS = 60_000; // 1 min — cohérent avec /api/tennis/prematch

type CacheEntry = { map: Record<string, unknown>; at: number; key: string };
let cache: CacheEntry | null = null;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const namesParam = searchParams.get("names") ?? "";
    const surface = searchParams.get("surface") ?? "Dur";

    const names = namesParam
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean)
      .slice(0, 50); // cap anti-abus

    if (names.length === 0) {
      throw new ValidationError("Missing 'names' param");
    }

    const cacheKey = `${names.join("|")}@${surface}`;
    const now = Date.now();
    if (cache && cache.key === cacheKey && now - cache.at < CACHE_TTL_MS) {
      return NextResponse.json(cache.map);
    }

    const map = getPlayerStatsBatch(names, surface);
    cache = { map, at: now, key: cacheKey };
    return NextResponse.json(map);
  } catch (err) {
    // Dégradation gracieuse — on ne casse jamais le prematch.
    return apiErrorHandler(err, "tennis/player-stats", () =>
      NextResponse.json({}, { status: 200 })
    );
  }
}
