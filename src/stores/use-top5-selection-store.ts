import { create } from "zustand";
import type {
  StrategyMatchEntry,
  StrategyTop5Key,
} from "@/lib/football-strategy-top5";

export type Top5SelectionItem = {
  entry: StrategyMatchEntry;
  /** Stratégie figée à la sélection (la valeur d'un match est spécifique à chaque stratégie). */
  strategy: StrategyTop5Key;
};

interface Top5SelectionState {
  items: Record<string, Top5SelectionItem>;
  toggle: (entry: StrategyMatchEntry, strategy: StrategyTop5Key) => void;
  remove: (matchId: string) => void;
  clearAll: () => void;
}

/**
 * Sélection de matchs du Top5 — éphémère (non persistée), partagée entre le
 * widget sidebar et le panneau des cards côté droit de la page.
 */
export const useTop5SelectionStore = create<Top5SelectionState>()((set) => ({
  items: {},
  toggle: (entry, strategy) =>
    set((s) => {
      const next = { ...s.items };
      const existing = next[entry.matchId];
      // Re-clic sur le même couple match/stratégie = retrait ; sous une autre
      // stratégie = mise à jour de la capture.
      if (existing && existing.strategy === strategy) delete next[entry.matchId];
      else next[entry.matchId] = { entry, strategy };
      return { items: next };
    }),
  remove: (matchId) =>
    set((s) => {
      if (!s.items[matchId]) return s;
      const next = { ...s.items };
      delete next[matchId];
      return { items: next };
    }),
  clearAll: () => set({ items: {} }),
}));
