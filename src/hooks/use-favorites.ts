"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "setpoint-favorites";

// Read favorites from localStorage (client-side only)
function readFavorites(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr) : new Set();
  } catch {
    return new Set();
  }
}

function writeFavorites(favs: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...favs]));
  } catch {
    // localStorage may be disabled — silently ignore
  }
}

// Singleton state shared across all hook instances
let cachedFavorites: Set<string> = new Set();
let initialized = false;
const listeners = new Set<(favs: Set<string>) => void>();

function init() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  cachedFavorites = readFavorites();
  // Sync across tabs
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) {
      cachedFavorites = readFavorites();
      listeners.forEach((fn) => fn(cachedFavorites));
    }
  });
}

function setFavorites(next: Set<string>) {
  cachedFavorites = next;
  writeFavorites(next);
  listeners.forEach((fn) => fn(next));
}

export function useFavorites() {
  const [favorites, setFavoritesState] = useState<Set<string>>(cachedFavorites);

  useEffect(() => {
    init();
    // Sync initial state if not yet initialized
    if (cachedFavorites.size !== favorites.size) {
      Promise.resolve().then(() => setFavoritesState(cachedFavorites));
    }
    const listener = (favs: Set<string>) => setFavoritesState(favs);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, [favorites.size]);

  const toggle = useCallback((matchId: string) => {
    const next = new Set(cachedFavorites);
    if (next.has(matchId)) {
      next.delete(matchId);
    } else {
      next.add(matchId);
    }
    setFavorites(next);
  }, []);

  const isFavorite = useCallback(
    (matchId: string) => favorites.has(matchId),
    [favorites]
  );

  const clear = useCallback(() => {
    setFavorites(new Set());
  }, []);

  return {
    favorites,
    count: favorites.size,
    toggle,
    isFavorite,
    clear,
  };
}
