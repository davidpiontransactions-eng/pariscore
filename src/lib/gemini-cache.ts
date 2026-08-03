/**
 * Cache Gemini partagé — utilisé par la route d'insight et le cron de pré-calcul.
 *
 * Stocke les analyses Gemini en mémoire côté serveur (Map, O(1) lookups).
 * TTL: 12 heures. Préfixe de clé: gemini-insight:{sport}:{matchId}:{YYYY-MM-DD}
 *
 * Note: ce cache est volatile (redémarrage = perdu). Pour une persistance cross-restart,
 * utiliser Prisma/SQLite. Acceptable car le cron re-pré-calcule au démarrage.
 */

export type CachedGeminiInsight = {
  analysis: string;
  factors: { label: string; value: string }[];
  edge: number;
  confidence: number;
};

type CacheEntry = { data: CachedGeminiInsight; at: number };

export const GEMINI_CACHE_TTL_MS = 12 * 60 * 60_000; // 12 heures

/** Map dédiée — pas de pollution globalThis */
const geminiCache = new Map<string, CacheEntry>();

/** Construit une clé de cache déterministe (match + jour). */
export function geminiCacheKey(sport: string, matchId: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return `gemini-insight:${sport}:${matchId}:${today}`;
}

/** Récupère une entrée du cache si elle existe et n'est pas expirée. */
export function geminiCacheGet(key: string): CachedGeminiInsight | null {
  const entry = geminiCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.at > GEMINI_CACHE_TTL_MS) {
    geminiCache.delete(key);
    return null;
  }
  return entry.data;
}

/** Stocke une entrée dans le cache avec le timestamp actuel. */
export function geminiCacheSet(key: string, data: CachedGeminiInsight): void {
  geminiCache.set(key, { data, at: Date.now() });
}

/** Nettoie les entrées expirées (itinère uniquement sur les clés du cache). */
export function geminiCachePrune(): number {
  const now = Date.now();
  let pruned = 0;
  for (const [key, entry] of geminiCache) {
    if (now - entry.at > GEMINI_CACHE_TTL_MS) {
      geminiCache.delete(key);
      pruned++;
    }
  }
  return pruned;
}

/** Retourne le nombre d'entrées dans le cache (pour monitoring). */
export function geminiCacheSize(): number {
  return geminiCache.size;
}

/** Retourne toutes les clés du cache (pour debug). */
export function geminiCacheKeys(): string[] {
  return Array.from(geminiCache.keys());
}