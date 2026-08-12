import { NextResponse } from "next/server";
import { createTtlCache, isFresh } from "@/lib/cached-route";

const CACHE_TTL = 5 * 60_000; // 5 min — enrichissement lourd (csapi + HLTV + BSD)
const cache = createTtlCache<unknown>("__cs2EnrichCache");

/**
 * GET /api/cs2/enrich?team1=&team2=&map=
 * Agrège l'enrichissement d'un duel CS2 (forme, joueurs, H2H, map pool 3m/6m/1y,
 * pistol index, winrates) + l'inférence de veto (co-play likelihood).
 * Délègue à services/cs2Service.js (CommonJS) — source unique de vérité.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const team1 = url.searchParams.get("team1") ?? "";
  const team2 = url.searchParams.get("team2") ?? "";
  const map = url.searchParams.get("map") ?? undefined;

  if (!team1 || !team2) {
    return NextResponse.json({ error: "team1 & team2 requis" }, { status: 400 });
  }

  const cacheKey = `${team1.toLowerCase()}|${team2.toLowerCase()}|${map ?? ""}`;
  const entry = cache.getEntry();
  const cachedPayload = (cache.get() as { key?: string } | null) ?? null;
  if (entry && cachedPayload && (cachedPayload as { key?: string }).key === cacheKey && isFresh(entry, CACHE_TTL)) {
    return NextResponse.json(cachedPayload);
  }

  try {
    const cs2Service = require("../../../../../services/cs2Service");
    const key = process.env.BSD_API_KEY;

    const enrichment = await cs2Service.buildMatchEnrichment(team1, team2, map, key);
    const mapLikelihood = cs2Service.computeMapPlayLikelihood(team1, team2, 180);

    const payload = { key: cacheKey, enrichment, mapLikelihood, source: "bsd+csapi+hltv" };
    cache.set(payload);
    return NextResponse.json(payload);
  } catch (err) {
    return NextResponse.json(
      { error: "cs2 enrich unavailable", details: (err as Error).message },
      { status: 503 },
    );
  }
}
