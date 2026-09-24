// Snapshot BetExplorer handball — scores mi-temps, H2H, forme récente.
//
// Source : data/betexplorer_handball.json, produit par
// scripts/scrape-betexplorer-handball.js (fetch direct betexplorer.com,
// fallback FlareSolverr via FLARE_URL). Lecture readonly + cache mémoire
// module — pattern handball-players (DATA_DIR env prioritaire, VPS
// : /opt/pariscorebis/data).
//
// Format mi-temps BetExplorer (vérifié empiriquement 2026-09-24) :
// « 28:29 (14:14, 14:15) » = (1re MT, 2e MT) → halftime = PREMIER bloc,
// soit le score à la mi-temps. Ex. Stuttgart-Erlangen 22:17 (7:9, 15:8) :
// 7+15=22 et 9+8=17 ✓.

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { normHandballName } from "./handball-logos";

/** Score home/away (mi-temps ou final). */
export type BeScore = { home: number; away: number };

/** Statut dans le snapshot : FT = terminé, NS = à venir. */
export type BeMatchStatus = "FT" | "NS";

export type BeMatch = {
  home: string;
  away: string;
  league: string;
  /** Date ISO « murale » (heure locale BetExplorer) ou date seule, parfois null. */
  date: string | null;
  status: BeMatchStatus;
  score: BeScore | null;
  /** Score à la mi-temps (1re MT) — null si non capturé. */
  halftime: BeScore | null;
  /** Chemin relatif BetExplorer (ex. /handball/germany/bundesliga/...). */
  url?: string;
};

export type BeLeague = {
  slug: string;
  name: string;
  matches: BeMatch[];
};

export type BeH2H = {
  home: string;
  away: string;
  meeting_date: string | null;
  league: string;
  score: BeScore;
  halftime: BeScore | null;
  url?: string;
  /** Paire upcoming enrichie (sens du match à venir). */
  pair_home?: string;
  pair_away?: string;
};

export type BetExplorerHandballSnapshot = {
  scraped_at: string;
  source: string;
  days?: number;
  leagues: BeLeague[];
  /** Pool global des matchs récents terminés (avec MT), trié date desc. */
  recent: BeMatch[];
  h2h: BeH2H[];
};

/** Cible minimale d'un helper : HandballMatch est structurellement compatible. */
export type HalftimeQuery = {
  home: { name: string };
  away: { name: string };
};

// Cache mémoire module : undefined = pas encore lu, null = fichier absent.
let _cache: BetExplorerHandballSnapshot | null | undefined;

/** Lit data/betexplorer_handball.json (DATA_DIR env prioritaire, comme le VPS). */
export function loadBetExplorerHandball(): BetExplorerHandballSnapshot | null {
  if (_cache !== undefined) return _cache;
  try {
    const dataDir = process.env.DATA_DIR || join(process.cwd(), "data");
    const file = join(dataDir, "betexplorer_handball.json");
    if (!existsSync(file)) {
      _cache = null;
      return null;
    }
    const data = JSON.parse(readFileSync(file, "utf8")) as BetExplorerHandballSnapshot;
    _cache =
      data && Array.isArray(data.leagues) && Array.isArray(data.h2h) ? data : null;
  } catch {
    _cache = null;
  }
  return _cache;
}

/** Purge du cache (tests / hot-reload après un scrape). */
export function clearBetExplorerCache(): void {
  _cache = undefined;
}

/**
 * Matching tolérant : égalité normalisée d'abord, puis inclusion réciproque
 * (« TVB Stuttgart » ⊂ « stuttgart »), garde-fou ≥ 4 caractères normalisés —
 * règles identiques à teamsMatch de handball-players.
 */
export function beNamesMatch(a: string, b: string): boolean {
  const x = normHandballName(a);
  const y = normHandballName(b);
  if (!x || !y) return false;
  if (x === y) return true;
  if (Math.min(x.length, y.length) < 4) return false;
  return x.includes(y) || y.includes(x);
}

/** Tous les matchs du snapshot (ligues cibles + pool récent), date desc. */
function allMatches(snapshot: BetExplorerHandballSnapshot | null | undefined): BeMatch[] {
  if (!snapshot) return [];
  const fromLeagues = (snapshot.leagues ?? []).flatMap((l) => l.matches ?? []);
  const pool = [...fromLeagues, ...(snapshot.recent ?? [])];
  return pool.sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")));
}

/**
 * Score de mi-temps (1re MT) du match fourni, résolu dans le snapshot
 * BetExplorer par les noms des deux équipes (sens conservé).
 *
 * Match terminé sans MT capturé, match à venir ou snapshot absent → null.
 */
export function getHalftimeScores(
  snapshot: BetExplorerHandballSnapshot | null | undefined,
  match: HalftimeQuery
): BeScore | null {
  if (!snapshot || !match?.home || !match?.away) return null;
  const home = match.home.name;
  const away = match.away.name;
  if (!home || !away) return null;
  const hit = allMatches(snapshot).find(
    (m) =>
      m.status === "FT" &&
      m.score &&
      beNamesMatch(m.home, home) &&
      beNamesMatch(m.away, away)
  );
  return hit?.halftime ?? null;
}

/**
 * Confrontations directes entre deux équipes (les deux sens), triées date
 * desc, plafonnées à `n`. Aucune donnée → [].
 */
export function getH2H(
  snapshot: BetExplorerHandballSnapshot | null | undefined,
  homeTeam: string,
  awayTeam: string,
  n: number = 5
): BeH2H[] {
  if (!snapshot?.h2h?.length || n < 1) return [];
  if (!homeTeam || !awayTeam) return [];
  return snapshot.h2h
    .filter(
      (h) =>
        (beNamesMatch(h.home, homeTeam) && beNamesMatch(h.away, awayTeam)) ||
        (beNamesMatch(h.home, awayTeam) && beNamesMatch(h.away, homeTeam))
    )
    .sort((a, b) => String(b.meeting_date ?? "").localeCompare(String(a.meeting_date ?? "")))
    .slice(0, n);
}

/**
 * Derniers matchs terminés d'une équipe (domicile ou extérieur), score + MT,
 * triés date desc, dédoublonnés par URL, plafonnés à `n`. Aucun → [].
 */
export function getRecentForm(
  snapshot: BetExplorerHandballSnapshot | null | undefined,
  teamName: string,
  n: number = 5
): BeMatch[] {
  if (!teamName) return [];
  const out: BeMatch[] = [];
  const seen = new Set<string>();
  for (const m of allMatches(snapshot)) {
    if (m.status !== "FT" || !m.score) continue;
    if (!beNamesMatch(m.home, teamName) && !beNamesMatch(m.away, teamName)) continue;
    const key = m.url || `${m.date}|${m.home}|${m.away}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(m);
    if (out.length >= n) break;
  }
  return out;
}
