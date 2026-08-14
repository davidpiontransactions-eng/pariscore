"use client";

import { useCallback, useEffect, useState } from "react";
import type { AIFilterPreset } from "@/lib/football-nl-filter";

/**
 * Persistance des filtres IA compilés (Phase 1) — pattern singleton localStorage
 * identique à use-favorites (pas de store Zustand global dans le codebase).
 */
const STORAGE_KEY = "pariscore-football-ai-filters";
const MAX_PRESETS = 12;

function readPresets(): AIFilterPreset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as AIFilterPreset[]) : [];
  } catch {
    return [];
  }
}

function writePresets(presets: AIFilterPreset[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  } catch {
    // localStorage indisponible — silencieux
  }
}

let cachedPresets: AIFilterPreset[] = [];
let initialized = false;
const listeners = new Set<(presets: AIFilterPreset[]) => void>();

function init() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  cachedPresets = readPresets();
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) {
      cachedPresets = readPresets();
      listeners.forEach((fn) => fn(cachedPresets));
    }
  });
}

function setPresets(next: AIFilterPreset[]) {
  cachedPresets = next;
  writePresets(next);
  listeners.forEach((fn) => fn(next));
}

export function useFootballAIFilters() {
  const [presets, setPresetsState] = useState<AIFilterPreset[]>(cachedPresets);

  useEffect(() => {
    init();
    if (cachedPresets !== presets) {
      Promise.resolve().then(() => setPresetsState(cachedPresets));
    }
    const listener = (p: AIFilterPreset[]) => setPresetsState(p);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, [presets]);

  const addPreset = useCallback((preset: AIFilterPreset) => {
    const next = [preset, ...cachedPresets].slice(0, MAX_PRESETS);
    setPresets(next);
  }, []);

  const removePreset = useCallback((id: string) => {
    setPresets(cachedPresets.filter((p) => p.id !== id));
  }, []);

  return { presets, addPreset, removePreset };
}
