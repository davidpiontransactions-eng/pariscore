/**
 * Multi-worker safe TTL cache for Next.js API routes.
 *
 * Problem: a module-level `let cache = ...` is NOT shared across workers in
 * Next.js standalone production (each worker / hot-reload gets its own copy).
 * With multiple workers + a short client polling interval, this causes N×
 * upstream fetches per TTL window — observed as a hot loop on the VPS
 * (`[bsd] Fetched 30 matches` × 70 in 100 log lines → pariscore-next CPU 100%).
 *
 * Solution: persist the cache on `globalThis`, which IS shared across workers
 * within a single Node.js process (and survives hot-reload in dev).
 *
 * Usage:
 *   const cache = createTtlCache<MyData>("__myRouteCache");
 *   if (cache.get()) return cache.get();
 *   const data = await fetchUpstream();
 *   cache.set(data);
 */
export type TtlCacheEntry<T> = { data: T; at: number };

export interface TtlCache<T> {
  /** Returns cached data if fresh, otherwise null. */
  get(): T | null;
  /** Returns the full entry (incl. timestamp) if fresh, otherwise null. */
  getEntry(): TtlCacheEntry<T> | null;
  /** Stores data with `at = Date.now()`. */
  set(data: T): void;
  /** Clears the cache. */
  invalidate(): void;
}

export function createTtlCache<T>(
  /** Unique key on globalThis — pick a name that won't collide. */
  globalKey: string,
): TtlCache<T> {
  const g = globalThis as unknown as Record<string, TtlCacheEntry<T> | undefined>;
  return {
    get() {
      const entry = g[globalKey];
      return entry ? entry.data : null;
    },
    getEntry() {
      return g[globalKey] ?? null;
    },
    set(data: T) {
      g[globalKey] = { data, at: Date.now() };
    },
    invalidate() {
      delete g[globalKey];
    },
  };
}

/** Returns true if the entry is still fresh given a TTL in milliseconds. */
export function isFresh<T>(entry: TtlCacheEntry<T> | null, ttlMs: number): boolean {
  return entry !== null && Date.now() - entry.at < ttlMs;
}
