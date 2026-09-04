/**
 * Cache en mémoire pour les API routes.
 * 
 * En production, on utiliserait Redis (Upstash ou Redis Cloud).
 * Pour l'instant, on utilise un cache en mémoire avec TTL.
 * 
 * Features:
 * - TTL par clé
 * - Invalidation manuelle
 * - Stats d'usage (hits/misses)
 * - Serialization automatique
 */

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
  createdAt: number;
};

type CacheStats = {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
};

class MemoryCache {
  private store = new Map<string, CacheEntry<unknown>>();
  private stats: CacheStats = { hits: 0, misses: 0, sets: 0, deletes: 0 };
  private defaultTTL = 60_000; // 1 minute par défaut

  /**
   * Récupère une valeur du cache.
   */
  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    return entry.value as T;
  }

  /**
   * Met une valeur dans le cache.
   */
  set<T>(key: string, value: T, ttlMs?: number): void {
    const ttl = ttlMs ?? this.defaultTTL;
    
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttl,
      createdAt: Date.now(),
    });
    
    this.stats.sets++;
  }

  /**
   * Supprime une clé du cache.
   */
  delete(key: string): boolean {
    const deleted = this.store.delete(key);
    if (deleted) this.stats.deletes++;
    return deleted;
  }

  /**
   * Supprime toutes les clés matchant un pattern.
   */
  invalidatePattern(pattern: string): number {
    const regex = new RegExp(pattern.replace(/\*/g, ".*"));
    let count = 0;
    
    for (const key of this.store.keys()) {
      if (regex.test(key)) {
        this.store.delete(key);
        count++;
      }
    }
    
    return count;
  }

  /**
   * Nettoie les entrées expirées.
   */
  cleanup(): number {
    const now = Date.now();
    let count = 0;
    
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
        count++;
      }
    }
    
    return count;
  }

  /**
   * Retourne les statistiques du cache.
   */
  getStats(): CacheStats & { size: number; hitRate: number } {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      size: this.store.size,
      hitRate: total > 0 ? this.stats.hits / total : 0,
    };
  }

  /**
   * Vide complètement le cache.
   */
  clear(): void {
    this.store.clear();
    this.stats = { hits: 0, misses: 0, sets: 0, deletes: 0 };
  }
}

// Instance singleton
export const cache = new MemoryCache();

// Nettoyage automatique toutes les 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => cache.cleanup(), 5 * 60_000);
}

/**
 * Wrapper pour les appels API avec cache.
 * 
 * @param key - Clé de cache
 * @param fetcher - Fonction pour récupérer les données
 * @param ttlMs - TTL en millisecondes (défaut: 60s)
 */
export async function withCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number = 60_000,
): Promise<T> {
  const cached = cache.get<T>(key);
  if (cached !== null) {
    return cached;
  }

  const data = await fetcher();
  cache.set(key, data, ttlMs);
  return data;
}

/**
 * Cache spécifique pour les API routes FIBA.
 */
export const fibaCache = {
  scoreboard: (dates?: string) => ({
    key: `fiba:scoreboard:${dates ?? "today"}`,
    ttl: 30_000, // 30s pour live
  }),
  standings: () => ({
    key: "fiba:standings",
    ttl: 5 * 60_000, // 5min
  }),
  stats: (team?: string) => ({
    key: `fiba:stats:${team ?? "all"}`,
    ttl: 30 * 60_000, // 30min
  }),
  odds: (home: string, away: string) => ({
    key: `fiba:odds:${home}-${away}`,
    ttl: 60_000, // 1min
  }),
};
