import { describe, expect, test, mock, beforeEach } from "bun:test";

/**
 * Tests du cache degraded — vérifie que le cache est toujours rempli
 * même quand BSD échoue, et que le fallback vers l'ancien cache fonctionne.
 */

type CachedPayload = { matches: unknown[]; degraded: boolean; source: string };

// Simule la logique de cache degraded de la route API
function applyCacheLogic(
  matches: unknown[],
  degraded: boolean,
  source: string,
  staleEntry: { data: CachedPayload; at: number } | null,
): { matches: unknown[]; source: string; cacheSet: boolean; cacheData?: CachedPayload } {
  let cacheSet = false;
  let cacheData: CachedPayload | undefined;

  const mockCache = {
    set: (data: CachedPayload) => { cacheSet = true; cacheData = data; },
    getEntry: () => staleEntry,
  };

  if (degraded) {
    const stale = mockCache.getEntry();
    if (stale && !stale.data.degraded) {
      // Fallback : garder les dernières données non-degraded
      matches = stale.data.matches as unknown[];
      source = stale.data.source;
    } else {
      mockCache.set({ matches, degraded, source });
    }
  } else {
    mockCache.set({ matches, degraded, source });
  }

  return { matches, source, cacheSet, cacheData };
}

describe("football calendar cache degraded", () => {
  test("cache est rempli quand degraded=true et pas d'ancien cache", () => {
    const result = applyCacheLogic([], true, "openligadb", null);

    expect(result.cacheSet).toBe(true);
    expect(result.cacheData).toBeDefined();
    expect(result.cacheData!.degraded).toBe(true);
    expect(result.cacheData!.source).toBe("openligadb");
  });

  test("cache est rempli quand degraded=false", () => {
    const result = applyCacheLogic([{ id: 1 }], false, "bsd+openligadb", null);

    expect(result.cacheSet).toBe(true);
    expect(result.cacheData).toBeDefined();
    expect(result.cacheData!.degraded).toBe(false);
    expect(result.cacheData!.matches).toHaveLength(1);
  });

  test("fallback vers ancien cache non-degraded quand degraded=true", () => {
    const staleEntry = {
      data: { matches: [{ id: 99 }], degraded: false, source: "bsd+openligadb" },
      at: Date.now() - 60000,
    };

    const result = applyCacheLogic([], true, "openligadb", staleEntry);

    // Le cache ne doit PAS être re-rempli (on garde l'ancien)
    expect(result.cacheSet).toBe(false);
    // Les matches doivent provenir de l'ancien cache
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]).toEqual({ id: 99 });
    expect(result.source).toBe("bsd+openligadb");
  });

  test("pas de fallback si ancien cache est aussi degraded", () => {
    const staleEntry = {
      data: { matches: [], degraded: true, source: "openligadb" },
      at: Date.now() - 60000,
    };

    const result = applyCacheLogic([{ id: 1 }], true, "openligadb", staleEntry);

    // Le cache DOIT être re-rempli (l'ancien est aussi degraded)
    expect(result.cacheSet).toBe(true);
    expect(result.matches).toHaveLength(1);
  });
});
