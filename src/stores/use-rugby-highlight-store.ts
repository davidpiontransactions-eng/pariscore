import { create } from "zustand";

/**
 * Store partagé pour le highlight bidirectionnel Calendar ↔ Top10.
 * Quand un match est cliqué dans le calendrier, le Top10 scrolle et highlight.
 * Inversement, un clic dans le Top10 highlight dans le calendrier.
 */
interface RugbyHighlightState {
  highlightedMatchId: string | null;
  /** Timestamp du dernier highlight (pour auto-clear après 5s). */
  highlightedAt: number | null;
  setHighlight: (matchId: string | null) => void;
  clearHighlight: () => void;
}

export const useRugbyHighlightStore = create<RugbyHighlightState>((set) => ({
  highlightedMatchId: null,
  highlightedAt: null,
  setHighlight: (matchId) =>
    set({ highlightedMatchId: matchId, highlightedAt: matchId ? Date.now() : null }),
  clearHighlight: () => set({ highlightedMatchId: null, highlightedAt: null }),
}));
