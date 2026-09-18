import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { normTeam } from "./football-elo";

/**
 * Historique chronologique par match — généré par scripts/scrape_footballdata.py
 * (clé `history` dans public/data/fd/{slug}.json, T10). Scores/cotes null si à venir.
 */

export type HistoryRow = {
  date: string;
  home: string;
  away: string;
  hg: number | null;
  ag: number | null;
  ftr: "H" | "D" | "A" | null;
  hy: number | null;
  ay: number | null;
  hr: number | null;
  ar: number | null;
  referee: string | null;
  avgH: number | null;
  avgD: number | null;
  avgA: number | null;
  psH: number | null;
  psD: number | null;
  psA: number | null;
};

type FdFile = {
  meta?: Record<string, unknown>;
  seasons: Record<string, { history?: HistoryRow[] } & Record<string, unknown>>;
};

const cache = new Map<string, FdFile | null>();

function readFd(slug: string): FdFile | null {
  if (cache.has(slug)) return cache.get(slug) ?? null;
  let data: FdFile | null = null;
  try {
    const file = join(process.cwd(), "public", "data", "fd", `${slug}.json`);
    if (existsSync(file)) data = JSON.parse(readFileSync(file, "utf-8")) as FdFile;
  } catch {
    data = null;
  }
  cache.set(slug, data);
  return data;
}

/** Lignes d'une saison (triées par date), null si absentes. */
export function fdHistory(slug: string, season: string): HistoryRow[] | null {
  const h = readFd(slug)?.seasons?.[season]?.history;
  return Array.isArray(h) ? h : null;
}

/** n derniers matchs JOUÉS d'une équipe (scores renseignés), ordre anté-chronologique. */
export function teamLastMatches(
  slug: string,
  season: string,
  team: string,
  n: number,
): HistoryRow[] {
  const key = normTeam(team);
  const rows = fdHistory(slug, season) ?? [];
  return rows
    .filter(
      (r) =>
        r.hg != null &&
        r.ag != null &&
        (normTeam(r.home) === key || normTeam(r.away) === key),
    )
    .slice(-n)
    .reverse();
}
