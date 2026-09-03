"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Store unifié pour le suivi (follow) de joueurs, équipes et matchs.
 *
 * Étend le système existant (useFavorites + useSportsSidebarStore.followedTeamIds)
 * en un store unique qui :
 * - Persiste dans localStorage
 * - Est cross-tab via storage event
 * - Connecte les follows aux notifications push
 *
 * Convention d'IDs :
 * - Joueur: `"player:{id}"` (ex: `"player:djokovic-novak"`)
 * - Équipe: `"team:{sport}:{id}"` (ex: `"team:football:psg"`)
 * - Match: `"match:{sport}:{id}"` (ex: `"match:tennis:sinner-alcaraz-20260901"`)
 * - Ligue: `"league:{sport}:{slug}"` (ex: `"league:football:ligue-1"`)
 */

export type FollowCategory = "player" | "team" | "match" | "league";

export type FollowEntry = {
  id: string;
  category: FollowCategory;
  name: string;
  sport?: string;
  /** Notifications push activées pour cet élément */
  notifications: boolean;
  /** Date d'ajout (ISO) */
  addedAt: string;
  /** Métadonnées optionnelles (photo, couleur, etc.) */
  meta?: Record<string, unknown>;
};

type FollowState = {
  /** Map id → FollowEntry */
  follows: Record<string, FollowEntry>;
  /** Nombre total de follows */
  count: number;
};

type FollowActions = {
  /** Ajouter un follow */
  add: (entry: Omit<FollowEntry, "addedAt">) => void;
  /** Retirer un follow */
  remove: (id: string) => void;
  /** Toggle follow (ajoute si absent, retire si présent) */
  toggle: (entry: Omit<FollowEntry, "addedAt">) => void;
  /** Vérifier si un élément est suivi */
  isFollowed: (id: string) => boolean;
  /** Activer/désactiver les notifications pour un follow */
  setNotifications: (id: string, enabled: boolean) => void;
  /** Obtenir tous les follows d'une catégorie */
  getByCategory: (category: FollowCategory) => FollowEntry[];
  /** Obtenir tous les follows d'un sport */
  getBySport: (sport: string) => FollowEntry[];
  /** Obtenir les IDs des matchs suivis (pour filtrage) */
  getFollowedMatchIds: () => string[];
  /** Obtenir les IDs des équipes suivies (pour filtrage) */
  getFollowedTeamIds: () => string[];
  /** Obtenir les IDs des joueurs suivis (pour filtrage) */
  getFollowedPlayerIds: () => string[];
  /** Obtenir les IDs des ligues suivies (pour filtrage) */
  getFollowedLeagueIds: () => string[];
  /** Nettoyer les follows orphelins (anciens matchs, etc.) */
  cleanup: () => void;
  /** Réinitialiser tous les follows */
  clearAll: () => void;
};

export const useFollowStore = create<FollowState & FollowActions>()(
  persist(
    (set, get) => ({
      follows: {},
      count: 0,

      add: (entry) => {
        const { follows, count } = get();
        if (follows[entry.id]) return; // déjà suivi
        const newEntry: FollowEntry = {
          ...entry,
          addedAt: new Date().toISOString(),
        };
        set({
          follows: { ...follows, [entry.id]: newEntry },
          count: count + 1,
        });
      },

      remove: (id) => {
        const { follows, count } = get();
        if (!follows[id]) return;
        const { [id]: _, ...rest } = follows;
        set({ follows: rest, count: count - 1 });
      },

      toggle: (entry) => {
        const { isFollowed, add, remove } = get();
        const wasFollowed = isFollowed(entry.id);

        // Optimistic update : mettre à jour l'UI immédiatement
        if (wasFollowed) {
          remove(entry.id);
        } else {
          add(entry);
        }

        // Sync backend en arrière-plan (fire-and-forget)
        if (typeof window !== "undefined") {
          const userId = localStorage.getItem("pariscore-user-id");
          if (userId) {
            fetch("/api/v1/follows", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                userId,
                entityId: entry.id,
                category: entry.category,
                name: entry.name,
                sport: entry.sport,
                notifications: entry.notifications,
              }),
            }).catch(() => {
              // En cas d'erreur, rollback optimistic update
              if (wasFollowed) {
                add(entry);
              } else {
                remove(entry.id);
              }
            });
          }
        }
      },

      isFollowed: (id) => {
        return !!get().follows[id];
      },

      setNotifications: (id, enabled) => {
        const { follows } = get();
        const entry = follows[id];
        if (!entry) return;
        set({
          follows: {
            ...follows,
            [id]: { ...entry, notifications: enabled },
          },
        });
      },

      getByCategory: (category) => {
        return Object.values(get().follows).filter(
          (e) => e.category === category,
        );
      },

      getBySport: (sport) => {
        return Object.values(get().follows).filter(
          (e) => e.sport === sport,
        );
      },

      getFollowedMatchIds: () => {
        return Object.keys(get().follows).filter((id) =>
          id.startsWith("match:"),
        );
      },

      getFollowedTeamIds: () => {
        return Object.keys(get().follows).filter((id) =>
          id.startsWith("team:"),
        );
      },

      getFollowedPlayerIds: () => {
        return Object.keys(get().follows).filter((id) =>
          id.startsWith("player:"),
        );
      },

      getFollowedLeagueIds: () => {
        return Object.keys(get().follows).filter((id) =>
          id.startsWith("league:"),
        );
      },

      cleanup: () => {
        const { follows, count } = get();
        const now = Date.now();
        const maxAge = 90 * 24 * 60 * 60 * 1000; // 90 jours pour les matchs
        const cleaned: Record<string, FollowEntry> = {};

        for (const [id, entry] of Object.entries(follows)) {
          if (entry.category === "match") {
            const age = now - new Date(entry.addedAt).getTime();
            if (age > maxAge) continue; // expiré
          }
          cleaned[id] = entry;
        }

        if (Object.keys(cleaned).length !== count) {
          set({ follows: cleaned, count: Object.keys(cleaned).length });
        }
      },

      clearAll: () => {
        set({ follows: {}, count: 0 });
      },
    }),
    {
      name: "pariscore.follows",
      partialize: (state) => ({ follows: state.follows, count: state.count }),
    },
  ),
);

// Hook shorthand pour les composants
export function useIsFollowed(id: string): boolean {
  return useFollowStore((s) => s.isFollowed(id));
}
