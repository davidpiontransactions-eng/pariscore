// Client TopHåndbold (tophaandbold.dk) — API publique SANS CLÉ identifiée le
// 2026-09-29 (CakePHP server-rendered, aucune auth, aucun quota observé) :
//   GET /match/{id}.json              → détails match (score/temps live inclus)
//   GET /kampprogram/{slug}           → fixtures HTML (IDs /match/{id})
//   GET /intranet/pdfs/game/{id}/…    → rapports PDF officiels (report/events)
//   POST /tophaandbold_theme/statistics/playerModal/{id} → stats joueur (HTML)
// Usage : coupe danoise (Pokalturnering Herrer) — source live de secours quand
// API-Sports handball répond 403 (abonnement sport séparé, audit 2026-09-23).

import type { HandballMatch, HandballMatchStatus, HandballScore } from "./handball-data";

const TH_BASE = "https://tophaandbold.dk";
const TH_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const TIMEOUT_MS = 8000;

/** Match TopHåndbold = HandballMatch + contexte coupe (bracket, salle, TV…). */
export type TopCupMatch = HandballMatch & {
  /** Tour du tableau (ex. « 1/8 finaler »). */
  bracket?: string;
  /** Salle (ex. « BioCirc Arena »). */
  arena?: string;
  /** Canal TV (ex. « TV2 sport »). */
  tv?: string;
  /** Spectateurs déclarés (0 tant que le match n'a pas commencé). */
  spectators?: number;
};

// ─── Types de la réponse /match/{id}.json (schéma vérifié 2026-09-29) ───────
type ThTeam = {
  id?: number;
  name?: string;
  short_name?: string;
  logo?: string;
};

type ThMatchJson = {
  id?: number;
  start_time?: string; // "2026-09-29T20:00:00+02:00"
  time?: string; // "00:00.00" | "30:00.00" | "60:00.00"
  time_running?: number; // 1 pendant le match
  spectators?: number;
  score?: string; // "0-0" | "25-30"
  halftime_score?: string; // "15-15"
  teams?: ThTeam[];
  season?: { name?: string };
  league?: { id?: number; name?: string; logo?: string };
  bracket?: { name?: string };
  arena?: { name?: string };
  tv_channel?: { name?: string };
};

// ─── HTTP ────────────────────────────────────────────────────────────────────

async function thFetch(path: string): Promise<Response | null> {
  try {
    const res = await fetch(`${TH_BASE}${path}`, {
      headers: { "User-Agent": TH_UA, Accept: "*/*" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    return res.ok ? res : null;
  } catch {
    return null;
  }
}

/** GET JSON brut sur tophaandbold.dk (null si absente/erreur). */
export async function fetchThJson<T = unknown>(path: string): Promise<T | null> {
  const res = await thFetch(path);
  if (!res) return null;
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** GET HTML brut (kampprogram…). */
async function thHtml(path: string): Promise<string | null> {
  const res = await thFetch(path);
  if (!res) return null;
  try {
    return await res.text();
  } catch {
    return null;
  }
}

// ─── Parsing (pures — testées sans réseau) ───────────────────────────────────

/** IDs numériques uniques `/match/{id}` dans une page HTML (ordre d'apparition). */
export function parseMatchIds(html: string): number[] {
  const out: number[] = [];
  const seen = new Set<number>();
  const re = /\/match\/(\d{3,8})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const id = Number(m[1]);
    if (Number.isFinite(id) && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

/** "25-30" → { home: 25, away: 30 } (null si illisible). */
function parseScore(raw: string | undefined): { home: number; away: number } | null {
  if (!raw) return null;
  const m = /^(\d+)-(\d+)$/.exec(raw.trim());
  if (!m) return null;
  return { home: Number(m[1]), away: Number(m[2]) };
}

/** "12:34.00" → minutes entières jouées (0 si illisible). */
function parseMinute(raw: string | undefined): number {
  if (!raw) return 0;
  const m = /^(\d{1,3}):/.exec(raw.trim());
  return m ? Number(m[1]) : 0;
}

/**
 * Statut TH → HandballMatchStatus :
 *  - coup d'envoi futur → not_started
 *  - horloge ≥ 60 min ou non lancée après 60 → finished
 *  - time_running = 1 → live (30:00 exact = halftime, la pause arrête l'horloge)
 *  - sinon après coup d'envoi : 30 ≤ min < 60 → halftime, sinon not_started
 */
function resolveStatus(
  kickoffIso: string,
  time: string,
  running: number,
  nowMs: number,
): { status: HandballMatchStatus; minute: number } {
  const kickoffMs = Date.parse(kickoffIso);
  const minute = parseMinute(time);
  if (Number.isFinite(kickoffMs) && kickoffMs > nowMs) {
    return { status: "not_started", minute: 0 };
  }
  if (minute >= 60) return { status: "finished", minute: Math.min(minute, 60) };
  if (running) {
    if (minute === 30) return { status: "halftime", minute: 30 };
    return { status: "live", minute };
  }
  if (minute >= 30) return { status: "halftime", minute };
  return { status: "not_started", minute: 0 };
}

/** Prefixe relatif `/app/webroot/…` → URL absolue tophaandbold.dk. */
function absUrl(p: string | undefined): string | undefined {
  if (!p) return undefined;
  return p.startsWith("/") ? `${TH_BASE}${p}` : p;
}

/** JSON /match/{id} → TopCupMatch (null si structure inattendue). */
export function mapTopMatch(raw: unknown, nowMs: number = Date.now()): TopCupMatch | null {
  if (!raw || typeof raw !== "object") return null;
  const j = raw as ThMatchJson;
  if (typeof j.id !== "number" || !Array.isArray(j.teams) || j.teams.length < 2) return null;
  const home = j.teams[0];
  const away = j.teams[1];
  if (!home?.name || !away?.name) return null;
  const kickoff = j.start_time ? new Date(j.start_time).toISOString() : new Date(0).toISOString();
  const { status, minute } = resolveStatus(kickoff, j.time ?? "", j.time_running ?? 0, nowMs);

  const started = status !== "not_started";
  const full = parseScore(j.score);
  const half = parseScore(j.halftime_score);
  let score: HandballScore | undefined;
  if (started && full) {
    score = { home: full.home, away: full.away };
    if (half) {
      score.homeHalf = half.home;
      score.awayHalf = half.away;
    }
  }

  const match: TopCupMatch = {
    id: j.id,
    league: {
      id: typeof j.league?.id === "number" ? j.league.id : 0,
      name: j.league?.name ?? "Pokalturnering",
      country: "Denmark",
      countryCode: "DK",
      logo: absUrl(j.league?.logo),
      season: j.season?.name,
    },
    home: {
      id: typeof home.id === "number" ? home.id : 0,
      name: home.name,
      shortName: home.short_name,
      logo: absUrl(home.logo),
    },
    away: {
      id: typeof away.id === "number" ? away.id : 0,
      name: away.name,
      shortName: away.short_name,
      logo: absUrl(away.logo),
    },
    kickoff,
    status,
  };
  if (score) match.score = score;
  if (status === "live" || status === "halftime") match.minute = minute;
  if (j.bracket?.name) match.bracket = j.bracket.name;
  if (j.arena?.name) match.arena = j.arena.name;
  if (j.tv_channel?.name) match.tv = j.tv_channel.name;
  if (typeof j.spectators === "number") match.spectators = j.spectators;
  return match;
}

// ─── API haut niveau ─────────────────────────────────────────────────────────

/** Détail d'un match TH par son id (null si absent/erreur). */
export async function fetchTopMatch(id: number): Promise<TopCupMatch | null> {
  const json = await fetchThJson<unknown>(`/match/${id}.json`);
  return json ? mapTopMatch(json) : null;
}

/**
 * Fixtures d'une compétition TH — parse les IDs `/match/{id}` de la page
 * kampprogram puis charge les JSON en parallèle (cap 24 = une tournoi complet).
 */
export async function fetchTopLeagueMatches(
  slug = "pokalturnering-herrer",
  limit = 24,
): Promise<TopCupMatch[]> {
  const html = await thHtml(`/kampprogram/${slug}`);
  if (!html) return [];
  const ids = parseMatchIds(html).slice(0, Math.max(1, limit));
  const jsons = await Promise.all(ids.map((id) => fetchThJson<unknown>(`/match/${id}.json`)));
  return jsons
    .map((j) => (j ? mapTopMatch(j) : null))
    .filter((m): m is TopCupMatch => m !== null)
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff));
}
