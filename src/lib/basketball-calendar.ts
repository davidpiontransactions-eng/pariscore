/**
 * basketball-calendar.ts — helpers purs du calendrier Basket (format FotmobCalMatch).
 *
 * Merge des 4 sources (NBA/WNBA ESPN + EuroLeague/EuroCup bridge + FIBA ESPN)
 * vers le format consommé par FotmobCalendarTable, tri chronologique, dédup.
 * Utilisé par /api/basketball/calendar et testé dans
 * src/lib/__tests__/basketball-calendar.test.ts — aucune dépendance Node/React.
 */

import type { FotmobCalMatch } from "@/components/football/fotmob-calendar-table";

/* ─── Types d'entrée (formes brutes des sources) ─── */

/** Match ESPN normalisé (basketballService._normalizeEvent / wnbaService). */
export type EspnBbMatch = {
  id: string | number;
  date?: string;
  /** state ESPN : "pre" | "in" | "post". */
  status?: string | null;
  status_detail?: string | null;
  home?: { name?: string; abbr?: string; logo?: string | null; score?: number | null } | null;
  away?: { name?: string; abbr?: string; logo?: string | null; score?: number | null } | null;
};

/** Match EuroLeague/EuroCup (bridge euroleague_api, cf. euroleague-bridge.ts). */
export type EuroBbMatch = {
  id: number | string;
  startTime?: string;
  /** "live" | "finished" | "scheduled" (défaut). */
  status?: string | null;
  homeScore?: number | null;
  awayScore?: number | null;
  home?: { name?: string } | null;
  away?: { name?: string } | null;
  round?: number | string | null;
};

/** Match FIBA (export type FibaMatch de /api/fiba/scoreboard/route.ts). */
export type FibaBbMatch = {
  id: string;
  date?: string;
  status?: "pre" | "in" | "post" | string;
  statusDetail?: string | null;
  group?: string | null;
  home?: { name?: string; logo?: string; score?: number | null } | null;
  away?: { name?: string; logo?: string; score?: number | null } | null;
};

/* ─── Helpers temps ─── */

const PARIS_KEY_FMT = new Intl.DateTimeFormat("fr-CA", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Clé jour Paris YYYY-MM-DD depuis une date/ISO — "" si invalide (jamais de throw). */
export function parisDateKeyOf(iso: string | number | Date): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return PARIS_KEY_FMT.format(d);
}

/** Statut live au sens FotMob ("LIVE" | "HT") — copie locale de fotmob-filter (non exporté). */
export function isCalLiveStatus(s?: string | null): boolean {
  return s === "LIVE" || s === "HT";
}

/* ─── Mappers ─── */

/** state ESPN → statut affichable FotMob (LIVE / FT / prévu). */
export function espnStateToCalLive(m: EspnBbMatch): FotmobCalMatch["live"] {
  const state = (m.status || "pre").toLowerCase();
  if (state === "in") {
    return { status: "LIVE", homeScore: m.home?.score ?? null, awayScore: m.away?.score ?? null };
  }
  if (state === "post") {
    return { status: "FT", homeScore: m.home?.score ?? null, awayScore: m.away?.score ?? null };
  }
  return null;
}

export function espnBbToCal(
  m: EspnBbMatch,
  league: { id: string; name: string; country?: string | null },
): FotmobCalMatch {
  return {
    id: `${league.id}-${m.id}`,
    scheduledAt: m.date || "",
    home: { name: m.home?.name || m.home?.abbr || "?", logo: m.home?.logo ?? null },
    away: { name: m.away?.name || m.away?.abbr || "?", logo: m.away?.logo ?? null },
    league: { id: league.id, name: league.name, country: league.country ?? null, logo: null },
    live: espnStateToCalLive(m),
  };
}

export function euroBbToCal(m: EuroBbMatch, league: { id: string; name: string }): FotmobCalMatch {
  const st = (m.status || "").toLowerCase();
  const score = { homeScore: m.homeScore ?? null, awayScore: m.awayScore ?? null };
  const live = st === "live" ? { status: "LIVE", ...score } : st === "finished" ? { status: "FT", ...score } : null;
  return {
    id: `${league.id}-${m.id}`,
    scheduledAt: m.startTime || "",
    home: { name: m.home?.name || "?" },
    away: { name: m.away?.name || "?" },
    league: { id: league.id, name: league.name, country: null, logo: null },
    round: m.round != null && m.round !== 0 ? `J${m.round}` : null,
    live,
  };
}

export function fibaBbToCal(m: FibaBbMatch): FotmobCalMatch {
  const score = { homeScore: m.home?.score ?? null, awayScore: m.away?.score ?? null };
  const live =
    m.status === "in" ? { status: "LIVE", ...score } : m.status === "post" ? { status: "FT", ...score } : null;
  return {
    id: `fiba-${m.id}`,
    scheduledAt: m.date || "",
    home: { name: m.home?.name || "?", logo: m.home?.logo ?? null },
    away: { name: m.away?.name || "?", logo: m.away?.logo ?? null },
    league: { id: "fiba", name: m.group ? `FIBA WC — Groupe ${m.group}` : "FIBA World Cup", country: null, logo: null },
    live,
  };
}

/* ─── Merge 4 sources ─── */

export type BasketballCalendarSources = {
  nba?: EspnBbMatch[];
  wnba?: EspnBbMatch[];
  euroleague?: EuroBbMatch[];
  eurocup?: EuroBbMatch[];
  fiba?: FibaBbMatch[];
};

/**
 * Fusionne les 4 sources en FotmobCalMatch[] triés chronologiquement :
 * dédup par id, puis garde-fou date Paris (une source qui déborde d'un jour
 * sur l'autre est écartée), matchs sans horaire exploitable écartés.
 */
export function buildBasketballCalendar(
  dateKey: string,
  src: BasketballCalendarSources,
): FotmobCalMatch[] {
  const all: FotmobCalMatch[] = [];
  for (const m of src.nba ?? []) all.push(espnBbToCal(m, { id: "nba", name: "NBA", country: "USA" }));
  for (const m of src.wnba ?? []) all.push(espnBbToCal(m, { id: "wnba", name: "WNBA", country: "USA" }));
  for (const m of src.euroleague ?? []) all.push(euroBbToCal(m, { id: "euroleague", name: "EuroLeague" }));
  for (const m of src.eurocup ?? []) all.push(euroBbToCal(m, { id: "eurocup", name: "EuroCup" }));
  for (const m of src.fiba ?? []) all.push(fibaBbToCal(m));

  const seen = new Set<string>();
  return all
    .filter((m) => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    })
    .filter((m) => {
      if (!m.scheduledAt) return false; // pas d'horaire → non affichable dans un calendrier
      return parisDateKeyOf(m.scheduledAt) === dateKey;
    })
    .sort((a, b) => (a.scheduledAt || "").localeCompare(b.scheduledAt || ""));
}
