"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * Hook sports favoris — localStorage.
 * Stocke les 5 premiers sports affichés dans la headbar.
 * Défaut : ["football", "tennis", "basketball", "hockey", "f1"]
 * L'utilisateur peut réordonner via drag & drop (desktop) ou via le dropdown "Plus".
 */

const STORAGE_KEY = "ps_sport_favorites";
const DEFAULT_FAVORITES = ["football", "tennis", "basketball", "hockey", "f1"];
const MAX_FAVORITES = 5;

export function useSportPreferences(allSportIds: string[]) {
  const [favorites, setFavorites] = useState<string[]>(DEFAULT_FAVORITES);

  // Charger depuis localStorage au montage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as string[];
        // Valider que les sports existent toujours
        const valid = parsed.filter((s) => allSportIds.includes(s));
        if (valid.length > 0) {
          setFavorites(valid.slice(0, MAX_FAVORITES));
        }
      }
    } catch {
      // ignore
    }
  }, [allSportIds]);

  // Sauvegarder dans localStorage
  const save = useCallback(
    (next: string[]) => {
      const trimmed = next.slice(0, MAX_FAVORITES);
      setFavorites(trimmed);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
      } catch {
        // ignore
      }
    },
    []
  );

  // Ajouter un sport aux favoris (le met en premier)
  const addFavorite = useCallback(
    (sportId: string) => {
      save([sportId, ...favorites.filter((s) => s !== sportId)]);
    },
    [favorites, save]
  );

  // Réordonner (drag & drop)
  const reorder = useCallback(
    (fromIdx: number, toIdx: number) => {
      const next = [...favorites];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      save(next);
    },
    [favorites, save]
  );

  // Sports secondaires (non favoris)
  const secondary = allSportIds.filter((s) => !favorites.includes(s));

  return {
    favorites,
    secondary,
    addFavorite,
    reorder,
    maxFavorites: MAX_FAVORITES,
  };
}
