/**
 * Sync des follows localStorage → base de données.
 *
 * À appeler lors du login (quand auth sera configurée).
 * Lit les follows du useFollowStore (localStorage) et les envoie
 * à /api/v1/follows pour fusion avec la DB.
 *
 * Stratégie :
 * 1. Lire localStorage (source locale)
 * 2. Lire DB (source distante)
 * 3. Fusionner (union, pas d'écrasement)
 * 4. PUT pour sauvegarder la fusion
 *
 * Usage :
 *   import { syncFollowsToDb } from "@/lib/follows-sync";
 *   await syncFollowsToDb("user-123");
 */

import type { FollowEntry } from "@/stores/use-follow-store";

const STORAGE_KEY = "setpoint-follow-store";

/** Lire les follows du localStorage (même clé que useFollowStore) */
function readLocalFollows(): Record<string, FollowEntry> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    // useFollowStore persist format: { state: { follows: {...} } }
    return parsed?.state?.follows ?? parsed?.follows ?? {};
  } catch {
    return {};
  }
}

/** Fusionner follows locaux + distants (union, priorité au plus récent) */
function mergeFollows(
  local: Record<string, FollowEntry>,
  remote: Record<string, FollowEntry>
): Record<string, FollowEntry> {
  const merged = { ...remote };

  for (const [id, localEntry] of Object.entries(local)) {
    const remoteEntry = merged[id];
    if (!remoteEntry) {
      // Pas dans la DB → ajouter
      merged[id] = localEntry;
    } else {
      // Les deux existent → garder le plus récent
      const localDate = new Date(localEntry.addedAt).getTime();
      const remoteDate = new Date(remoteEntry.addedAt).getTime();
      if (localDate > remoteDate) {
        merged[id] = localEntry;
      }
    }
  }

  return merged;
}

/**
 * Synchroniser les follows localStorage avec la DB.
 *
 * @param userId - ID de l'utilisateur (depuis la session)
 * @returns Nombre de follows après fusion
 */
export async function syncFollowsToDb(userId: string): Promise<number> {
  // 1. Lire localStorage
  const localFollows = readLocalFollows();
  const localCount = Object.keys(localFollows).length;

  if (localCount === 0) {
    // Rien à sync, charger depuis la DB
    const res = await fetch(`/api/v1/follows?userId=${userId}`);
    if (!res.ok) return 0;
    const data = await res.json();
    return Object.keys(data.follows ?? {}).length;
  }

  // 2. Lire DB
  const res = await fetch(`/api/v1/follows?userId=${userId}`);
  const remoteFollows: Record<string, FollowEntry> = {};
  if (res.ok) {
    const data = await res.json();
    Object.assign(remoteFollows, data.follows ?? {});
  }

  // 3. Fusionner
  const merged = mergeFollows(localFollows, remoteFollows);

  // 4. Sauvegarder en DB (un par un via POST toggle)
  let syncedCount = 0;
  for (const entry of Object.values(merged)) {
    const alreadyInDb = entry.id in remoteFollows;
    if (!alreadyInDb) {
      // AJOUTER à la DB
      const postRes = await fetch("/api/v1/follows", {
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
      });
      if (postRes.ok) syncedCount++;
    }
  }

  // 5. Mettre à jour localStorage avec la fusion
  if (typeof window !== "undefined") {
    try {
      const storeData = localStorage.getItem(STORAGE_KEY);
      if (storeData) {
        const parsed = JSON.parse(storeData);
        if (parsed?.state) {
          parsed.state.follows = merged;
          localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
        }
      }
    } catch {
      // Ignorer erreurs localStorage
    }
  }

  return Object.keys(merged).length;
}
