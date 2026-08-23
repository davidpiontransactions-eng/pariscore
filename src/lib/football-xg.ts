import { readFileSync, existsSync } from "fs";
import { join } from "path";
import type { BSDFootballMatch } from "@/lib/bsd-football-fetcher";
import { formKey } from "@/lib/football-form";

/**
 * xG réel par équipe (données Opta via understat.com) — scrapé par
 * scripts/scrape_understat.py → public/data/xg/{slug}.json.
 *
 * Chaque équipe porte un historique match par match avec le contexte Home/Away
 * (`h_a`) : on filtre sur le contexte, on prend les N derniers matchs et on
 * moyenne. Fenêtres servies : L5 et L10.
 */

type XgMatchRow = {
  date: string;
  h_a: "h" | "a";
  xG: number | null;
  xGA: number | null;
  scored: number | null;
  missed: number | null;
  result?: string;
};

type XgFile = {
  meta: { leagueId: string; season: string; teamCount: number };
  teams: Record<string, XgMatchRow[]>;
};

export type XgWindowStats = {
  /** Nombre de matchs réellement agrégés (peut être < N en début de saison). */
  gp: number;
  /** xG moyen marqués. */
  xgFor: number;
  /** xG moyen concédés (xGA). */
  xgAgainst: number;
  /** Buts moyens marqués. */
  goalsFor: number;
  /** Buts moyens encaissés. */
  goalsAgainst: number;
};

export type TeamXgStats = { l5: XgWindowStats | null; l10: XgWindowStats | null };

export type MatchXgStats = { home: TeamXgStats; away: TeamXgStats };

const XG_DIR = join(process.cwd(), "public", "data", "xg");

const cache = new Map<string, XgFile | null>();

function readXg(slug: string): XgFile | null {
  if (cache.has(slug)) return cache.get(slug) ?? null;
  let data: XgFile | null = null;
  try {
    const file = join(XG_DIR, `${slug}.json`);
    if (existsSync(file)) data = JSON.parse(readFileSync(file, "utf-8")) as XgFile;
  } catch {
    data = null;
  }
  cache.set(slug, data);
  return data;
}

function windowStats(matches: XgMatchRow[], n: number): XgWindowStats | null {
  const rows = matches.slice(0, n);
  if (!rows.length) return null;
  const num = (v: number | null | undefined) => (v != null && Number.isFinite(v) ? v : 0);
  const sum = rows.reduce(
    (acc, r) => ({
      xgFor: acc.xgFor + num(r.xG),
      xgAgainst: acc.xgAgainst + num(r.xGA),
      gf: acc.gf + num(r.scored),
      ga: acc.ga + num(r.missed),
    }),
    { xgFor: 0, xgAgainst: 0, gf: 0, ga: 0 },
  );
  const n2 = Math.max(rows.length, 1);
  return {
    gp: rows.length,
    xgFor: Math.round((sum.xgFor / n2) * 100) / 100,
    xgAgainst: Math.round((sum.xgAgainst / n2) * 100) / 100,
    goalsFor: Math.round((sum.gf / n2) * 100) / 100,
    goalsAgainst: Math.round((sum.ga / n2) * 100) / 100,
  };
}

/**
 * Stats xG/buts L5 & L10 du match, dans le contexte Domicile (recevant) /
 * Extérieur (visiteur). Retourne null si la ligue n'est pas couverte par
 * Understat ou si une des deux équipes est introuvable.
 */
export function matchXg(leagueSlug: string | undefined, match: BSDFootballMatch): MatchXgStats | null {
  if (!leagueSlug) return null;
  const file = readXg(leagueSlug);
  if (!file?.teams) return null;

  const homeKey = formKey(match.home_team_obj?.name ?? match.home_team);
  const awayKey = formKey(match.away_team_obj?.name ?? match.away_team);

  const findTeam = (key: string): XgMatchRow[] | null => {
    if (!key) return null;
    const direct = file.teams[key];
    if (direct) return direct;
    for (const [title, matches] of Object.entries(file.teams)) {
      if (formKey(title) === key) return matches;
    }
    return null;
  };

  const homeMatches = findTeam(homeKey);
  const awayMatches = findTeam(awayKey);
  if (!homeMatches || !awayMatches) return null;

  const side = (matches: XgMatchRow[], ctx: "h" | "a"): TeamXgStats => {
    const scoped = matches.filter((m) => m.h_a === ctx);
    return { l5: windowStats(scoped, 5), l10: windowStats(scoped, 10) };
  };

  return { home: side(homeMatches, "h"), away: side(awayMatches, "a") };
}

// ── Classements xG par saison ──

/** Associe une date ISO à son label de saison ("2026-08-15" → "2026/27"). */
function seasonOf(dateIso: string): string | null {
  const y = Number(dateIso?.slice(0, 4));
  if (!Number.isFinite(y)) return null;
  const startYear = Number(dateIso.slice(5, 7)) >= 7 ? y : y - 1;
  return `${startYear}/${String(startYear + 1).slice(2).padStart(2, "0")}`;
}

export type XgRankRow = {
  team: string;
  gp: number;
  /** xG moyen marqués. */
  xgFor: number;
  /** xGA moyen (xG défensif). */
  xgAgainst: number;
};

/**
 * Classement xG moyen / xG défensif moyen des équipes d'une ligue pour une
 * saison ("2025/26") et un contexte ("overall" | "home" | "away").
 * Null si la ligue n'est pas couverte par Understat.
 */
export function leagueXgRanking(
  slug: string,
  seasonLabel: string,
  scope: "overall" | "home" | "away" = "overall",
): XgRankRow[] | null {
  const file = readXg(slug);
  if (!file?.teams) return null;
  const ctx = scope === "home" ? "h" : scope === "away" ? "a" : null;

  const rows: XgRankRow[] = [];
  for (const [team, matches] of Object.entries(file.teams)) {
    const scoped = matches.filter((m) => {
      if (seasonOf(m.date) !== seasonLabel) return false;
      return ctx == null || m.h_a === ctx;
    });
    if (!scoped.length) continue;
    const num = (v: number | null | undefined) => (v != null && Number.isFinite(v) ? v : 0);
    const sum = scoped.reduce(
      (acc, m) => ({ xgFor: acc.xgFor + num(m.xG), xgAgainst: acc.xgAgainst + num(m.xGA) }),
      { xgFor: 0, xgAgainst: 0 },
    );
    const n = scoped.length;
    rows.push({
      team,
      gp: n,
      xgFor: Math.round((sum.xgFor / n) * 100) / 100,
      xgAgainst: Math.round((sum.xgAgainst / n) * 100) / 100,
    });
  }
  return rows.length ? rows : null;
}

/** Saisons dispo dans le fichier understat d'une ligue (par dates observées). */
export function xgSeasons(slug: string): string[] {
  const file = readXg(slug);
  if (!file?.teams) return [];
  const set = new Set<string>();
  for (const matches of Object.values(file.teams)) {
    for (const m of matches) {
      const s = seasonOf(m.date);
      if (s) set.add(s);
    }
  }
  return [...set].sort().reverse();
}
