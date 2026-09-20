/**
 * Fetcher partagé pour les endpoints football (/matches et /calendar).
 * Un seul cache globalThis pour éviter la désynchronisation entre les deux
 * routes qui appellent les mêmes sources BSD + OpenLigaDB.
 */
import { createTtlCache, isFresh, type TtlCacheEntry } from "./cached-route";

const CACHE_TTL = 5 * 60_000;
/** TTL court pour les réponses dégradées — anti-hot-loop quand BSD est down. */
const DEGRADED_TTL = 30_000;

export type FootballCachePayload = {
  matches: unknown[];
  degraded: boolean;
  source: string;
};

const cache = createTtlCache<FootballCachePayload>("__footballSharedCache");

/**
 * Récupère les matchs football depuis le cache partagé ou les sources amont.
 * Les deux endpoints (/matches, /calendar) appellent cette fonction → même
 * cache, même TTL, zéro désynchronisation.
 */
export async function getFootballMatches(): Promise<{
  entry: TtlCacheEntry<FootballCachePayload>;
  now: number;
}> {
  const now = Date.now();
  const cached = cache.getEntry();

  // Cache frais non-dégradé → servir directement (TTL 5 min)
  if (cached && isFresh(cached, CACHE_TTL) && !cached.data.degraded) {
    return { entry: cached, now };
  }
  // Cache dégradé avec TTL court (30s) → servir pour éviter la hot-loop BSD
  if (cached && cached.data.degraded && isFresh(cached, DEGRADED_TTL)) {
    return { entry: cached, now };
  }

  // Fetch depuis les sources amont
  const { fetchBSDFootballPrematch, fetchBSDFootballLive, dedupeFootballMatches } = await import("./bsd-football-fetcher");
  const { fetchOpenLigaDB2Bundesliga } = await import("./openligadb-fetcher");

  const [prematch, live, olb] = await Promise.all([
    fetchBSDFootballPrematch().catch(() => [] as never[]),
    fetchBSDFootballLive().catch(() => [] as never[]),
    fetchOpenLigaDB2Bundesliga().catch(() => [] as never[]),
  ]);

  const matches = dedupeFootballMatches([...live, ...prematch, ...olb]);
  const bsdOk = live.length > 0 || prematch.length > 0;
  const degraded = !bsdOk;
  const hasOlb = olb.length > 0;
  const source = bsdOk ? (hasOlb ? "bsd+openligadb" : "bsd") : "openligadb";

  const payload: FootballCachePayload = { matches, degraded, source };
  // Toujours mettre en cache (dégradé = TTL court, sain = TTL normal)
  cache.set(payload);

  return {
    entry: { data: payload, at: now },
    now,
  };
}
