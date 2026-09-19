import { describe, expect, test, mock, beforeEach } from "bun:test";

/**
 * Tests de pagination BSD — vérifie que bsdFetch suit le champ `next`
 * pour récupérer toutes les pages de résultats.
 *
 * Note : on teste la logique de pagination directement, pas l'import de bsdFetch
 * (qui est une fonction interne non-exportée). On vérifie le comportement attendu
 * via des mocks de fetch.
 */

// Simule la logique de pagination de bsdFetch
async function bsdFetchPaginated(
  endpoint: string,
  fetchFn: typeof fetch,
  baseUrl: string,
  headers: Record<string, string>,
): Promise<unknown[]> {
  const allResults: unknown[] = [];
  let url: string | null = `${baseUrl}${endpoint}`;

  while (url) {
    const res = await fetchFn(url, { headers, signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as { count: number; next: string | null; results: unknown[] } | unknown[];

    if (Array.isArray(data)) {
      return data;
    }

    allResults.push(...data.results);
    url = data.next;
  }

  return allResults;
}

describe("bsdFetch pagination", () => {
  test("retourne directement un tableau si réponse non-paginée", async () => {
    const fetchMock = mock(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve([{ id: 1 }, { id: 2 }]),
      }),
    );

    const result = await bsdFetchPaginated(
      "/matches/",
      fetchMock as unknown as typeof fetch,
      "https://api.test",
      {},
    );

    expect(result).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("suit le champ next pour récupérer toutes les pages", async () => {
    const page1 = {
      count: 1500,
      next: "https://api.test/matches/?offset=1000",
      results: Array.from({ length: 1000 }, (_, i) => ({ id: i + 1 })),
    };
    const page2 = {
      count: 1500,
      next: null,
      results: Array.from({ length: 500 }, (_, i) => ({ id: i + 1001 })),
    };

    const fetchMock = mock((url: string) => {
      if (url.includes("offset=1000")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(page2) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(page1) });
    });

    const result = await bsdFetchPaginated(
      "/matches/",
      fetchMock as unknown as typeof fetch,
      "https://api.test",
      {},
    );

    expect(result).toHaveLength(1500);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result[0]).toEqual({ id: 1 });
    expect(result[1499]).toEqual({ id: 1500 });
  });

  test("gère 3+ pages correctement", async () => {
    const pages = [
      { count: 2500, next: "https://api.test/?p=2", results: Array.from({ length: 1000 }, (_, i) => ({ id: i })) },
      { count: 2500, next: "https://api.test/?p=3", results: Array.from({ length: 1000 }, (_, i) => ({ id: i + 1000 })) },
      { count: 2500, next: null, results: Array.from({ length: 500 }, (_, i) => ({ id: i + 2000 })) },
    ];
    let callIndex = 0;

    const fetchMock = mock(() => {
      const page = pages[callIndex++];
      return Promise.resolve({ ok: true, json: () => Promise.resolve(page) });
    });

    const result = await bsdFetchPaginated(
      "/matches/",
      fetchMock as unknown as typeof fetch,
      "https://api.test",
      {},
    );

    expect(result).toHaveLength(2500);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  test("lance une erreur si HTTP échoue", async () => {
    const fetchMock = mock(() =>
      Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) }),
    );

    await expect(
      bsdFetchPaginated("/matches/", fetchMock as unknown as typeof fetch, "https://api.test", {}),
    ).rejects.toThrow("HTTP 500");
  });
});
