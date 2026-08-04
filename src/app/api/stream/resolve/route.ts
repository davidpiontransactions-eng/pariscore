import { NextRequest, NextResponse } from "next/server";
import { apiErrorHandler } from "@/lib/api-error-handler";
import { ValidationError } from "@/lib/api-error";
import {
  resolveLiveTvStream,
  type LiveTvSport,
  type LiveTvResolveResult,
} from "@/lib/livetv-stream-service";

const VALID_SPORTS: LiveTvSport[] = ["football", "tennis", "basketball", "mma"];

const CACHE_CONTROL = (cached: boolean) =>
  cached ? "public, s-maxage=600, stale-while-revalidate=300" : "public, s-maxage=60";

/**
 * GET /api/stream/resolve?sport=football&home=Paris%20SG&away=Lyon
 *
 * Résout les streams LiveTV d'un match. Mise en cache côté service (30 min
 * positif / 5 min négatif) + headers CDN.
 */
export async function GET(request: NextRequest) {
  try {
    const sp = new URL(request.url).searchParams;
    const sport = sp.get("sport") as LiveTvSport | null;
    const home = sp.get("home")?.trim();
    const away = sp.get("away")?.trim();

    if (!sport || !VALID_SPORTS.includes(sport)) {
      throw new ValidationError("Paramètre sport invalide (football | tennis | basketball | mma)");
    }
    if (!home || !away) {
      throw new ValidationError("Paramètres home et away requis");
    }
    if (home.length > 80 || away.length > 80) {
      throw new ValidationError("Noms d'équipes trop longs");
    }

    const result: LiveTvResolveResult = await resolveLiveTvStream(sport, home, away);

    return new NextResponse(JSON.stringify(result), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": CACHE_CONTROL(result.cached),
        "X-LiveTv-Found": String(result.found),
        "X-LiveTv-Streams": String(result.streams.length),
        "X-LiveTv-Cached": String(result.cached),
      },
    });
  } catch (err) {
    return apiErrorHandler(err, "stream-resolve");
  }
}