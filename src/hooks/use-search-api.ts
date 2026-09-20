"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export interface SearchResult {
  id: string;
  name: string;
  subtitle?: string;
  icon: "match" | "team" | "league";
  sport?: string;
  href?: string;
}

interface UseSearchApiReturn {
  results: SearchResult[];
  loading: boolean;
  error: string | null;
  query: string;
  setQuery: (q: string) => void;
}

const DEBOUNCE_MS = 250;

/**
 * Hook recherche unifiée — appelle /api/v1/search avec debouncing.
 * Cache local des résultats pour éviter les re-fetchs inutiles.
 */
export function useSearchApi(limit = 10): UseSearchApiReturn {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const cacheRef = useRef<Map<string, SearchResult[]>>(new Map());

  const doSearch = useCallback(
    async (q: string) => {
      const key = q.toLowerCase().trim();

      // Cache local
      const cached = cacheRef.current.get(key);
      if (cached) {
        setResults(cached);
        setLoading(false);
        return;
      }

      // Annuler requête précédente
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setError(null);

      try {
        const res = await fetch(
          `/api/v1/search?q=${encodeURIComponent(q)}&limit=${limit}`,
          { signal: controller.signal }
        );

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = (await res.json()) as {
          results: SearchResult[];
        };

        if (!controller.signal.aborted) {
          setResults(data.results);
          cacheRef.current.set(key, data.results);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Erreur réseau");
        setResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    },
    [limit]
  );

  useEffect(() => {
    const q = query.trim();

    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    const timer = setTimeout(() => doSearch(q), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, doSearch]);

  return { results, loading, error, query, setQuery };
}
