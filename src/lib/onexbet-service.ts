/**
 * Adaptateur serveur 1xBet (best-effort) pour les cotes tennis live.
 *
 * Contexte (Engineering Loop — phases Observation → Hypothèse) :
 *   - 1xBet n'expose aucune API publique ; l'intégration passe par ses
 *     endpoints internes LiveFeed/Get1x2_VZip (liste live) et
 *     LiveFeed/GetGameZip (cotes d'un événement). Non documentés, ils
 *     tournent fréquemment (404/403 observés depuis le réseau projet) et
 *     sont protégés par anti-bot (IP datacenter bloquees).
 * Conséquence d'architecture : source 100% best-effort derrière le flag
 * `ONEXBET_ENABLED`. Tout échec réseau/parse retombe sur la source BSD déjà
 * en place (oddsA/oddsB du pipeline live) — jamais de blocage.
 *
 * Contrat réseau (format interne observé chez la communauté) :
 *   - `${base}/LiveFeed/Get1x2_VZip?sports=6&count=N&mode=4&lng=en`
 *     → `{ Value: [{ I, O1, O2, ... }] }` (événements tennis live).
 *   - `${base}/LiveFeed/GetGameZip?id=<eventId>&lng=en&cfview=0&isSubGames=true&GroupEvents=true&countevents=250`
 *     → `{ Value: { E: [{ P, C, ... }] } }`. Le marché « vainqueur » (P1/P2)
 *     est extrait par heuristique : positions P=1 → joueur A, P=2 → joueur B,
 *     cote C > 1.
 */

export type OnexEvent = {
  id: string;
  nameA: string;
  nameB: string;
};

export type OnexMoneyline = {
  oddA: number;
  oddB: number;
};

export const ONEX_TIMEOUT_MS = 4_000;

const DEFAULT_BASE = "https://1xbet.com";
const MAX_BATCH = 30;

function isEnabled(): boolean {
  return process.env.ONEXBET_ENABLED === "true";
}

function baseUrl(): string {
  return process.env.ONEXBET_API_BASE || DEFAULT_BASE;
}

/** GET texte/JSON avec timeout. null à la moindre anomalie. */
async function fetchRaw<T>(path: string): Promise<T | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ONEX_TIMEOUT_MS);
  try {
    const res = await fetch(`${baseUrl()}${path}`, {
      signal: ctrl.signal,
      headers: { Accept: "application/json, text/plain, */*" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const text = await res.text();
    return JSON.parse(text) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Liste des événements tennis live 1xBet. null si source injoignable. */
export async function fetchOnexLiveEvents(limit = 60): Promise<OnexEvent[] | null> {
  if (!isEnabled()) return null;
  const json = await fetchRaw<{ Value?: unknown } | unknown[]>(
    `/LiveFeed/Get1x2_VZip?sports=6&count=${limit}&mode=4&lng=en&getEmpty=true`,
  );
  if (!json) return null;
  const rows = Array.isArray(json) ? json : (json as { Value?: unknown }).Value;
  if (!Array.isArray(rows)) return null;
  return rows
    .filter((r) => r && typeof r === "object")
    .map((r) => r as Record<string, unknown>)
    .map((r) => ({
      id: String(r.I ?? ""),
      nameA: String(r.O1 ?? ""),
      nameB: String(r.O2 ?? ""),
    }))
    .filter((e) => e.id && e.nameA && e.nameB);
}

/** Cotes du marché « vainqueur » (P1/P2) d'un événement. null si absent. */
export async function fetchOnexGameOdds(eventId: string): Promise<OnexMoneyline | null> {
  if (!isEnabled()) return null;
  const json = await fetchRaw<{ Value?: { E?: unknown } }>(
    `/LiveFeed/GetGameZip?id=${encodeURIComponent(eventId)}&lng=en&cfview=0&isSubGames=true&GroupEvents=true&allEventsGroupSubGames=true&countevents=250&grMode=2`,
  );
  const value = json?.Value;
  if (!value || !Array.isArray(value.E)) return null;
  const byPos = new Map<number, number>();
  for (const o of value.E as Record<string, unknown>[]) {
    const p = Number(o?.P);
    const c = Number(o?.C);
    if ((p === 1 || p === 2) && Number.isFinite(c) && c > 1) byPos.set(p, c);
  }
  const oddA = byPos.get(1);
  const oddB = byPos.get(2);
  if (!oddA || !oddB) return null;
  return { oddA, oddB };
}

// ---------------------------------------------------------------------------
// Matching nom → événement 1xBet (tolérant diacritiques / casse / espaces)
// ---------------------------------------------------------------------------

function normName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function lastToken(s: string): string {
  const parts = normName(s).split(" ");
  return parts.length ? parts[parts.length - 1] : "";
}

function namesMatch(ours: string, theirs: string): boolean {
  const a = normName(ours);
  const b = normName(theirs);
  if (!a || !b) return false;
  if (a === b) return true;
  return lastToken(ours) === lastToken(theirs);
}

/** Le duel (playerA/playerB) correspond aux noms d'un événement (A/B ou B/A). */
function duelMatches(
  a: string,
  b: string,
  e: OnexEvent,
): boolean {
  return (
    (namesMatch(a, e.nameA) && namesMatch(b, e.nameB)) ||
    (namesMatch(a, e.nameB) && namesMatch(b, e.nameA))
  );
}

/**
 * Résolution d'un batch de duels : 1 fetch pour la liste 1x, puis N fetch de
 * cotes. Ne lève JAMAIS : toute entrée non résolue est simplement absente du
 * retour (le client retombe sur la source BSD).
 */
export async function resolveOnexOdds(
  wants: Array<{ matchId: string; playerA: string; playerB: string }>,
): Promise<Record<string, OnexMoneyline & { updatedAt: number }>> {
  const out: Record<string, OnexMoneyline & { updatedAt: number }> = {};
  if (!isEnabled()) return out;
  const batch = wants.slice(0, MAX_BATCH);
  const events = await fetchOnexLiveEvents();
  if (!events || events.length === 0) return out;

  const eventIdByMatch = new Map<string, string>();
  for (const w of batch) {
    const found = events.find((e) => duelMatches(w.playerA, w.playerB, e));
    if (found) eventIdByMatch.set(w.matchId, found.id);
  }
  if (eventIdByMatch.size === 0) return out;

  const promises = [...eventIdByMatch.entries()].map(async ([matchId, eventId]) => {
    const odds = await fetchOnexGameOdds(eventId);
    if (odds) out[matchId] = { ...odds, updatedAt: Date.now() };
  });
  await Promise.all(promises);
  return out;
}