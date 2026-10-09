/**
 * Client ESPN NHL — scoreboard live (API publique, sans clé).
 *
 * Rôle : fournir au widget BETS PRÉDICTIFS les DEUX champs qui manquent
 * partout ailleurs dans le repo — la période et l'horloge.
 *
 * ── Pourquoi une source réseau et pas `nhl_schedule.json` ────────────────
 *
 * Le calendrier NHL du repo est un FICHIER STATIQUE (`data/nhl_schedule.json`),
 * produit par `scripts/scrape-nhl-schedule.mjs`. Il est structurellement
 * incapable de porter le live :
 *   1. `homeGoals`/`awayGoals` y valent `null` SAUF si le match est terminé
 *      (`scrape-nhl-schedule.mjs:275-276`) ;
 *   2. la période et l'horloge n'y sont pas extraites du tout ;
 *   3. aucun cron ne le rafraîchit (0 occurrence hors `scripts/`).
 *
 * Un widget qui poll toutes les 8 s ne peut pas lire un fichier figé. D'où
 * l'appel direct au scoreboard ESPN, sur le modèle exact de la route FIBA
 * (`src/app/api/fiba/scoreboard/route.ts`), qui lit déjà `status.period` et
 * `status.displayClock` pour le basket.
 *
 * ── Hôte : `site.web.api.espn.com`, PAS `site.api.espn.com` ───────────────
 *
 * `site.api.espn.com` répond 403 derrière le WAF ESPN (fingerprint client, IP
 * datacenter comme résidentielle) — documenté et contourné depuis le 2026-09-29
 * dans `services/basketballService.js:20-22` et appliqué par la route FIBA.
 * `site.web.api.espn.com` sert la MÊME API `/apis/site/v2` et répond 200.
 *
 * ── `Accept-Encoding: identity` ───────────────────────────────────────────
 *
 * Repris de `services/basketballService.js:99-101` : sans cet en-tête, ESPN
 * peut servir une réponse gzip que le décompresseur du runtime ne gère pas et
 * l'appel échoue en `JSON.parse` sans message utile.
 */

const ESPN_HOST = "site.web.api.espn.com";
const NHL_SCOREBOARD = `https://${ESPN_HOST}/apis/site/v2/sports/hockey/nhl/scoreboard`;

// ─── Forme ESPN (subset utile uniquement) ────────────────────────────────────

export type EspnNhlStatus = {
  clock?: number;
  displayClock?: string;
  period?: number;
  type?: {
    id?: string;
    state?: "pre" | "in" | "post";
    completed?: boolean;
    description?: string;
    shortDetail?: string;
  };
};

type EspnNhlCompetitor = {
  homeAway?: "home" | "away";
  score?: string | number | { value?: number; displayValue?: string } | null;
  team?: { id?: string; displayName?: string; abbreviation?: string };
  linescores?: Array<{ value?: number; period?: number }>;
};

export type EspnNhlEvent = {
  id?: string;
  date?: string;
  name?: string;
  shortName?: string;
  league?: { id?: string; name?: string; abbreviation?: string };
  competitions?: Array<{
    id?: string;
    competitors?: EspnNhlCompetitor[];
    status?: EspnNhlStatus;
  }>;
  status?: EspnNhlStatus;
};

/** Match NHL normalisé, exactement la forme que consomme `adaptHockey`. */
export type NhlLiveMatch = {
  id: string;
  homeName: string;
  awayName: string;
  homeGoals: number | null;
  awayGoals: number | null;
  /** Période 1-3, 4 = prolongation. `null` si absente. */
  period: number | null;
  /** Secondes restantes dans la période. `null` si l'horloge est absente. */
  periodSecondsLeft: number | null;
  isLive: boolean;
  isFinished: boolean;
  leagueName: string;
};

// ─── Lecture tolérante (le scraper NHL fait de même) ─────────────────────────

/** Score ESPN : nombre, chaîne, ou objet `{value, displayValue}`. */
function readScore(c: EspnNhlCompetitor | undefined): number | null {
  const s = c?.score;
  if (s == null) return null;
  if (typeof s === "number") return Number.isFinite(s) ? s : null;
  if (typeof s === "object") {
    const n = Number.parseInt(String(s.value ?? s.displayValue ?? ""), 10);
    return Number.isFinite(n) ? n : null;
  }
  const n = Number.parseInt(String(s), 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * Période et horloge.
 *
 * ESPN expose le statut à DEUX emplacements (`event.status` et
 * `competitions[0].status`) selon la surface. Les deux sont essayés, dans cet
 * ordre — même fallback que `scrape-nhl-schedule.mjs:238`.
 */
function readStatus(event: EspnNhlEvent): EspnNhlStatus | null {
  return event.status ?? event.competitions?.[0]?.status ?? null;
}

/**
 * Convertit l'horloge ESPN ("12:45") en secondes restantes.
 *
 * ⚠️ ESPN sert `displayClock: "0:00"` au moment où la période est咸 terminée
 * : convertir naïvement donnerait 0 s — ce qui est correct pour une fin de
 * période, mais FAUX si le match est en prolongation (alors `period = 4` et le
 * moteur doit la compter). Une horloge non numérique ("Intermission") renvoie
 * `null` pour que l'adaptateur refuse le match plutôt que de projeter sur une
 * période qui n'existe pas.
 */
export function parseEspnClockToSeconds(displayClock: string | undefined): number | null {
  if (typeof displayClock !== "string") return null;
  const trimmed = displayClock.trim();
  const m = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const min = Number(m[1]);
  const sec = Number(m[2]);
  if (!Number.isFinite(min) || !Number.isFinite(sec) || sec > 59) return null;
  return min * 60 + sec;
}

/** Normalise un événement ESPN en match NHL exploitable par le moteur. */
export function normalizeEspnNhlEvent(event: unknown): NhlLiveMatch | null {
  if (typeof event !== "object" || event === null) return null;
  const ev = event as EspnNhlEvent;
  const comp = ev.competitions?.[0];
  const competitors = comp?.competitors ?? [];
  const home = competitors.find((c) => c.homeAway === "home") ?? competitors[0];
  const away = competitors.find((c) => c.homeAway === "away") ?? competitors[1];
  if (!home || !away) return null;

  const status = readStatus(ev);
  const state = status?.type?.state ?? null;
  const completed = status?.type?.completed === true;
  // Période bornée à 1-4 (3 périodes + prolongation). ESPN peut renvoyer 0 ou
  // une valeur absente sur un match pré-match : `null` plutôt qu'un 0 inventé.
  const rawPeriod = status?.period;
  const period =
    typeof rawPeriod === "number" && rawPeriod >= 1 && rawPeriod <= 4 ? rawPeriod : null;

  return {
    id: String(ev.id ?? ""),
    homeName: home.team?.displayName ?? "",
    awayName: away.team?.displayName ?? "",
    homeGoals: readScore(home),
    awayGoals: readScore(away),
    period,
    periodSecondsLeft: parseEspnClockToSeconds(status?.displayClock),
    isLive: state === "in",
    isFinished: completed,
    leagueName: ev.league?.abbreviation ?? ev.league?.name ?? "NHL",
  };
}

// ─── Client HTTP ─────────────────────────────────────────────────────────────

async function fetchJson<T>(url: string, timeoutMs = 8000): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "identity",
        "User-Agent": "Mozilla/5.0 PariScore",
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    // Timeout, 403, 5xx, JSON invalide : tous treated de la même façon —
    // l'appelant dégrade proprement. Aucun stacktrace pour un flux externe
    // dont l'indisponibilité est normale (match terminé, maintenance ESPN).
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Récupère les matchs NHL DU JOUR et ne garde que ceux en cours.
 *
 * Le scoreboard ne prend pas de période de date : il sert la journée ESPN
 * (timezone US). Un match « J-1 » encore en direct (match nord-américain
 * décalé) sort donc du périmètre — c'est le même comportement que la route
 * baseball, qui interroge date et date+1 pour le même motif.
 */
export async function fetchLiveNhlMatches(): Promise<{ matches: NhlLiveMatch[]; degraded: boolean }> {
  const data = await fetchJson<{ events?: unknown[] }>(NHL_SCOREBOARD);
  // `degraded` décrit la RÉPONSE de la source, pas son contenu : un
  // scoreboard qui répond 200 avec 10 matchs dont aucun n'est en cours est un
  // état NORMAL (aucun match NHL à cette heure), pas une dégradation. Le
  // confondre ferait afficher « flux dégradé » à l'utilisateur pendant
  // toute la journée — le défaut exact que le repo documente et corrige
  // ailleurs (`/api/hockey/matches`, « un compte qui décrit la source brute
  // et non la réponse est un compte faux »).
  if (!data || !Array.isArray(data.events)) {
    return { matches: [], degraded: true };
  }
  const matches: NhlLiveMatch[] = [];
  for (const raw of data.events) {
    const m = normalizeEspnNhlEvent(raw);
    // `isLive` est exigé : un match terminé ne doit pas déclencher un widget.
    if (m && m.isLive) matches.push(m);
  }
  return { matches, degraded: false };
}