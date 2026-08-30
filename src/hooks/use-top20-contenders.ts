"use client";

import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/**
 * Hook qui retourne un Set de noms (normalisés) des 20 meilleurs
 * prétendants ATP + WTA de l'US Open 2026.
 * Utilisé pour afficher 👑 à côté de leur nom dans les cartes live/prematch.
 */
export function useTop20Contenders(): Set<string> {
  const { data: atpData } = useSWR(
    "/api/tennis/tournament/us-open/draw?year=2026",
    fetcher,
    { refreshInterval: 30 * 60_000 },
  );
  const { data: wtaData } = useSWR(
    "/api/tennis/tournament/us-open-women/draw?year=2026",
    fetcher,
    { refreshInterval: 30 * 60_000 },
  );

  const names = new Set<string>();

  // Top 20 ATP
  if (atpData?.forecast) {
    atpData.forecast.slice(0, 20).forEach((p: { name: string }) => {
      names.add(normalizeName(p.name));
    });
  }

  // Top 20 WTA
  if (wtaData?.forecast) {
    wtaData.forecast.slice(0, 20).forEach((p: { name: string }) => {
      names.add(normalizeName(p.name));
    });
  }

  return names;
}

/** Normalise un nom pour la comparaison (lowercase, sans accents). */
function normalizeName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Vérifie si un joueur est dans le top 20. */
export function isTop20Contender(name: string, top20: Set<string>): boolean {
  return top20.has(normalizeName(name));
}
