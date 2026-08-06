/**
 * Live broker — fan-out SSE pour les matchs de tennis live.
 *
 * Problème : sans broker, chaque client SSE déclencherait son propre poll BSD
 * → charge BSD N× (explosion CPU + rate-limit). On veut exactement 1 seul
 * poller BSD quel que soit le nombre de clients connectés.
 *
 * Solution : un singleton sur `globalThis` (partagé intra-process, comme
 * `cached-route.ts`) maintient :
 *   - le dernier snapshot BSD (cache)
 *   - la liste des subscribers (callbacks SSE)
 *   - un unique `setInterval` de poll BSD (5s) démarré au 1er subscriber et
 *     arrêté quand le dernier se désabonne (évite de tourner à vide).
 *
 * Limitation multi-worker : `globalThis` est partagé intra-process mais PAS
 * inter-workers (cf. commentaire `cached-route.ts:6-17`). En prod standalone
 * sur le VPS, chaque worker a son broker + son poller. Acceptable pour un MVP
 * (typiquement 1 worker en prod standalone, ou 2-4 — charge BSD × workers).
 */

import type { LiveMatchItem } from "@/lib/bsd-fetcher";

/** Subscribed callback reçoit le snapshot complet à chaque changement. */
type Subscriber = (snapshot: LiveMatchItem[]) => void;

type BrokerState = {
  snapshot: LiveMatchItem[];
  snapshotAt: number;
  subscribers: Set<Subscriber>;
  timer: ReturnType<typeof setInterval> | null;
  /** Flag anti-reentrant : évite 2 polls BSD concurrents si un poll dépasse 5s. */
  polling: boolean;
  /** Hash du dernier snapshot diffusé (évite de repousser des données identiques). */
  lastHash: string;
};

const GLOBAL_KEY = "__tennisLiveBroker";
const POLL_INTERVAL_MS = 5_000;

function getState(): BrokerState {
  const g = globalThis as unknown as Record<string, BrokerState | undefined>;
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = {
      snapshot: [],
      snapshotAt: 0,
      subscribers: new Set<Subscriber>(),
      timer: null,
      polling: false,
      lastHash: "",
    };
  }
  return g[GLOBAL_KEY]!;
}

/**
 * Signature compacte des stats live d'un match (pour le hash) : permet au
 * poller de re-pousser quand SEULES les stats bougent (ace/DF/% qui évoluent
 * entre 2 points sans changement de score).
 */
function statsSig(m: LiveMatchItem): string {
  const s = m.live_stats;
  if (!s) return "-";
  return `S[${s.p1_aces ?? "-"}.${s.p2_aces ?? "-"}.${s.p1_df ?? "-"}.${s.p2_df ?? "-"}`
    + `.${s.p1_first_pct ?? "-"}.${s.p2_first_pct ?? "-"}.${s.p1_first_won ?? "-"}`
    + `.${s.p2_first_won ?? "-"}.${s.p1_bp_saved ?? "-"}.${s.p2_bp_saved ?? "-"}]`;
}

/**
 * Hash stable et léger d'un snapshot : concatène `id|gamesA-gamesB|sets|point|server`
 * pour chaque match. Suffisant pour détecter un changement de score (pas besoin
 * d'un hash cryptographique — on veut juste éviter de diffuser si rien n'a bougé).
 */
function hashSnapshot(matches: LiveMatchItem[]): string {
  return matches
    .map(
      (m) =>
        `${m.id}|${m.currentGame.p1}-${m.currentGame.p2}|` +
        `${m.setsDetail.map((s) => `${s.p1}-${s.p2}`).join(",")}|` +
        `${m.currentPoint.p1}-${m.currentPoint.p2}|${m.server}|${m.isLive ? 1 : 0}|` +
        statsSig(m),
    )
    .join(";");
}

/** Démarre le poller si pas déjà actif. Idempotent. */
function ensurePolling(state: BrokerState): void {
  if (state.timer) return;
  state.timer = setInterval(() => void pollOnce(state), POLL_INTERVAL_MS);
}

/** Arrête le poller si plus aucun subscriber. Idempotent. */
function maybeStopPolling(state: BrokerState): void {
  if (state.subscribers.size === 0 && state.timer) {
    clearInterval(state.timer);
    state.timer = null;
  }
}

/** Un cycle de poll BSD → maj snapshot → notification des subscribers si delta. */
async function pollOnce(state: BrokerState): Promise<void> {
  if (state.polling) return; // anti-reentrant
  // Gate identique à /api/tennis/live/route.ts : ne pas poller si BSD désactivé.
  const bsdKey = process.env.BSD_API_KEY;
  const bsdEnabled = process.env.BSD_TENNIS_ENABLED === "true";
  if (!bsdKey || !bsdEnabled) return;

  state.polling = true;
  try {
    const { fetchBSDLiveMatches } = await import("@/lib/bsd-fetcher");
    const matches = await fetchBSDLiveMatches();
    const hash = hashSnapshot(matches);
    state.snapshot = matches;
    state.snapshotAt = Date.now();
    // Ne diffuser que si le contenu a changé (économise le CPU client).
    if (hash !== state.lastHash) {
      state.lastHash = hash;
      for (const cb of state.subscribers) {
        try {
          cb(matches);
        } catch (err) {
          console.error("[live-broker] subscriber threw:", (err as Error).message);
        }
      }
    }
  } catch (err) {
    console.error("[live-broker] BSD poll failed:", (err as Error).message);
    // On garde l'ancien snapshot : les clients gardent leurs dernières données
    // connues plutôt que de voir un vide. Pas de notification d'erreur côté
    // client pour l'instant (MVP) — la reconnexion EventSource gère les gros soucis.
  } finally {
    state.polling = false;
  }
}

/** S'abonne aux mises à jour live. Retourne la fonction de désabonnement. */
export function subscribe(cb: Subscriber): () => void {
  const state = getState();
  state.subscribers.add(cb);
  ensurePolling(state);
  // Poll immédiat au 1er subscriber pour ne pas attendre 5s avant la 1ère maj.
  // (surtout utile si le snapshot est vide/stale au démarrage).
  if (state.snapshotAt === 0) {
    void pollOnce(state);
  }
  return () => {
    state.subscribers.delete(cb);
    maybeStopPolling(state);
  };
}

/** Retourne le snapshot courant (peut être vide/stale si jamais pollé). */
export function getSnapshot(): { matches: LiveMatchItem[]; at: number } {
  const state = getState();
  return { matches: state.snapshot, at: state.snapshotAt };
}
