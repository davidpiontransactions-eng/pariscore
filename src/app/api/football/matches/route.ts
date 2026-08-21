import { NextResponse } from "next/server";
import { apiErrorHandler } from "@/lib/api-error-handler";
import { createTtlCache, isFresh } from "@/lib/cached-route";

const CACHE_TTL = 5 * 60_000;

// createTtlCache already wraps in { data, at }, so we store only the payload.
type CachedPayload = { matches: unknown[]; degraded: boolean; source: string };
const cache = createTtlCache<CachedPayload>("__footballMatchesCache");

export async function GET() {
  const now = Date.now();

  const cached = cache.getEntry();
  // On ne sert JAMAIS un état dégradé depuis le cache : si la dernière écriture
  // était « BSD vide », on re-tente BSD à chaque requête pour récupérer dès que
  // la source revient (au lieu de figer l'onglet vide pendant CACHE_TTL).
  if (cached && isFresh(cached, CACHE_TTL) && !cached.data.degraded) {
    return NextResponse.json({
      matches: cached.data.matches,
      source: cached.data.source,
      degraded: cached.data.degraded,
      updatedAt: new Date(cached.at).toISOString(),
    });
  }

  try {
    const { fetchBSDFootballPrematch, fetchBSDFootballLive } = await import("@/lib/bsd-football-fetcher");
    const { fetchOpenLigaDB2Bundesliga } = await import("@/lib/openligadb-fetcher");
    const [prematch, live, olb] = await Promise.all([
      fetchBSDFootballPrematch().catch(() => [] as never[]),
      fetchBSDFootballLive().catch(() => [] as never[]),
      // 2. Bundesliga — ligue absente de BSD, source gratuite OpenLigaDB.
      fetchOpenLigaDB2Bundesliga().catch(() => [] as never[]),
    ]);
    const matches = [...live, ...prematch, ...olb];
    // BSD est LA source des grandes ligues (C1, PL, Ligue 1…). Si elle ne
    // renvoie rien (rate-limit 429, quota addon, panne), on le signale et on ne
    // fige pas le cache : l'onglet est « dégradé » mais doit pouvoir revenir.
    const bsdOk = live.length > 0 || prematch.length > 0;
    const degraded = !bsdOk;
    const hasOlb = olb.length > 0;
    const source = bsdOk ? (hasOlb ? "bsd+openligadb" : "bsd") : "openligadb";
    if (!degraded) cache.set({ matches, degraded, source });
    return NextResponse.json({
      matches,
      source,
      degraded,
      updatedAt: new Date(now).toISOString(),
    });
  } catch (err) {
    console.error("[football] fetch failed:", (err as Error).message);
    return NextResponse.json(
      { error: "football data unavailable" },
      { status: 503 }
    );
  }
}
