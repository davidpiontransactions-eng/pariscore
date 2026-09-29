// Coupe danoise (Pokalturnering Herrer) — API publique tophaandbold.dk sans
// clé (découverte 2026-09-29). Source live de secours pour la coupe : Flashscore
// rafraîchit son snapshot 1×/jour (06:30 UTC) et API-Sports handball = 403
// sans abonnement sport séparé.
//   GET /api/handball/danish-cup           → tous les matchs de la coupe
//   GET /api/handball/danish-cup?id=8364   → détail d'un match

import { NextResponse } from "next/server";
import { createTtlCache, isFresh } from "@/lib/cached-route";
import { apiErrorHandler } from "@/lib/api-error-handler";
import {
  fetchTopLeagueMatches,
  fetchTopMatch,
  type TopCupMatch,
} from "@/lib/tophaandbold";

type ListPayload = {
  source: "tophaandbold";
  matches: TopCupMatch[];
  fetchedAt: string;
  /** true = liste servie depuis le cache (TH inaccessible). */
  stale: boolean;
};

const CACHE_TTL = 60_000;
const cache = createTtlCache<ListPayload>("__danishCupCache");

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const idParam = searchParams.get("id");

    // ── Détail d'un match (pas de cache : usage live) ──
    if (idParam) {
      const id = Number.parseInt(idParam, 10);
      if (!Number.isFinite(id)) {
        return NextResponse.json({ error: "id invalide" }, { status: 400 });
      }
      const match = await fetchTopMatch(id);
      if (!match) {
        return NextResponse.json({ error: "match introuvable" }, { status: 404 });
      }
      return NextResponse.json({ source: "tophaandbold", match });
    }

    // ── Liste des matchs de la coupe (cache 60 s) ──
    const cached = cache.getEntry();
    if (cached && isFresh(cached, CACHE_TTL)) {
      return NextResponse.json(cached.data);
    }

    const matches = await fetchTopLeagueMatches("pokalturnering-herrer");
    if (matches.length > 0) {
      const payload: ListPayload = {
        source: "tophaandbold",
        matches,
        fetchedAt: new Date().toISOString(),
        stale: false,
      };
      cache.set(payload);
      return NextResponse.json(payload);
    }

    // TH inaccessible → cache stale s'il existe, sinon liste vide déclarée.
    if (cached) {
      return NextResponse.json({ ...cached.data, stale: true });
    }
    return NextResponse.json({
      source: "tophaandbold",
      matches: [],
      fetchedAt: new Date().toISOString(),
      stale: true,
    } satisfies ListPayload);
  } catch (err) {
    return apiErrorHandler(err, "handball/danish-cup");
  }
}
