// Leaderboards officiels ATP/WTA (data/tour-leaderboards/*.json) — source de
// repli pour /api/tennis/stats-leaderboard tant que les stats internes par
// match (tennis_matches_internal.w_svpt…) ne sont pas peuplées (ETL Phase
// 4.1.1). Les JSON sont produits par scripts/scrape-tour-leaderboards.py
// (hebdo) : ATP via Camoufox (Cloudflare), WTA via api.wtatennis.com.
//
// Couverture des filtres (limites des sources officielles) :
//   ATP : period=52w uniquement · surfaces all/hard/clay/grass · vsRank
//         all/top10/top20 · 3 boards complets (pression inclut TB + sets
//         décisifs, contrairement à la WTA).
//   WTA : period=ytd (année civile) uniquement · surface=all · vsRank=all ·
//         board "pressure" approximé sur 2 composantes (BP sauvées + BP
//         converties) — tie-breaks et sets décisifs non publiés par la WTA.
//
// Conception défensive : cache absent/illisible/incomplet → null, jamais
// d'exception (l'appelant retombe sur l'état vide existant).

import fs from "node:fs";
import path from "node:path";
import {
  iocToIso2,
  type BoardType,
  type LeaderboardParams,
  type LeaderboardRow,
  type LeaderboardSource,
} from "./leaderboard";

export type OfficialSource = Exclude<LeaderboardSource, "internal">;

export interface OfficialLeaderboardResult {
  rows: LeaderboardRow[];
  source: OfficialSource;
  /** Date de génération du cache par le scraper (fraîcheur affichée en UI). */
  generatedAt: string;
  /** Filtres réellement couverts par la donnée servie (transparence). */
  coverage: { period: string; surface: string; vsRank: string };
}

const DATA_DIR = (() => {
  // 1. Override explicite (tests, config custom)
  if (process.env.LEADERBOARD_DATA_DIR) return process.env.LEADERBOARD_DATA_DIR;
  // 2. Relatif au cwd (dev local + standalone si copié par outputFileTracingIncludes)
  const cwdBased = path.join(process.cwd(), "data", "tour-leaderboards");
  try {
    if (fs.existsSync(cwdBased)) return cwdBased;
  } catch {
    /* ignore */
  }
  // 3. Repli : déduire la racine projet depuis DATABASE_PATH (VPS standalone)
  if (process.env.DATABASE_PATH) {
    const projectRoot = path.dirname(process.env.DATABASE_PATH);
    const projectBased = path.join(projectRoot, "data", "tour-leaderboards");
    try {
      if (fs.existsSync(projectBased)) return projectBased;
    } catch {
      /* ignore */
    }
  }
  // 4. Dernier recours — readJsonSafe retournera null (dégradation gracieuse)
  return cwdBased;
})();

function readJsonSafe<T>(file: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf8")) as T;
  } catch {
    return null;
  }
}

function round1(x: number): number {
  return Math.round(x * 10) / 10;
}

/** "65.9%" → 65.9 · nombre ou null si non parsable. */
function parsePct(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return round1(v);
  if (typeof v === "string") {
    const n = Number(v.replace("%", "").trim());
    return Number.isFinite(n) ? round1(n) : null;
  }
  return null;
}

/** "TEREZA" → "Tereza", "MARTINCOVA" → "Martincova" (gère tirets/apostrophes). */
function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/(^|[\s\-'])([a-zà-ÿ])/g, (_, sep, c) => sep + c.toUpperCase());
}

/** Tri par rating DESC + rangs, avec filtre minMatches (comme l'agrégation
 *  interne). matches=null (ATP : seuil appliqué côté source) passe toujours. */
function finalize(
  rows: LeaderboardRow[],
  minMatches: number,
  ratingOf: (r: LeaderboardRow) => number | null
): LeaderboardRow[] {
  const out: LeaderboardRow[] = [];
  for (const r of rows) {
    if (r.matches != null && r.matches < minMatches) continue;
    r.rating = ratingOf(r);
    if (r.rating == null) continue;
    out.push(r);
  }
  out.sort(
    (x, y) =>
      (y.rating ?? -Infinity) - (x.rating ?? -Infinity) ||
      (y.matches ?? 0) - (x.matches ?? 0)
  );
  out.forEach((r, i) => {
    r.rank = i + 1;
  });
  return out;
}

// ─── Structures des caches scrapés ───────────────────────────────────────────

export interface AtpEntry {
  Stats?: Record<string, unknown>;
  PlayerRank?: number;
  PlayerId?: string;
  PlayerName?: string;
  PlayerCountryCode?: string;
}

interface AtpCache {
  generatedAt?: unknown;
  period?: unknown;
  datasets?: Record<string, AtpEntry[] | undefined>;
}

/** Ligne brute WTA (36 champs : compteurs + pourcentages pré-calculés). */
export type WtaRawRow = Record<string, unknown>;

interface WtaCache {
  generatedAt?: unknown;
  year?: unknown;
  rows?: WtaRawRow[];
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? round1(v) : null;
}

/** Stat ATP : priorité au champ numérique `XxxSortField`, repli sur la chaîne "65.9%". */
function atpStat(stats: Record<string, unknown>, key: string): number | null {
  return num(stats[`${key}SortField`]) ?? parsePct(stats[key]);
}

/** Pourcentage WTA — déjà numérique dans le cache (ex. 54.1), défensif si chaîne. */
function wtaPct(row: WtaRawRow, key: string): number | null {
  return parsePct(row[key]);
}

/** Total → moyenne par match, arrondie au dixième (null si dénominateur nul). */
function perMatch(total: unknown, matches: unknown): number | null {
  const t = num(total);
  const m = num(matches);
  return t != null && m != null && m > 0 ? round1(t / m) : null;
}

// ─── Ratings (mêmes formules que l'agrégation interne, cf. leaderboard.ts) ───

function sumParts(parts: (number | null)[]): number | null {
  if (parts.some((p) => p == null)) return null;
  return round1((parts as number[]).reduce((s, v) => s + v, 0));
}

/** %1er + %pts 1er + %pts 2e + %jeux service gagnés + aces/match − DF/match. */
function serveRatingOf(r: LeaderboardRow): number | null {
  if (r.dfsPerMatch == null) return null;
  const base = sumParts([
    r.firstServePct,
    r.firstServeWonPct,
    r.secondServeWonPct,
    r.serviceGamesWonPct,
    r.acesPerMatch,
  ]);
  return base == null ? null : round1(base - r.dfsPerMatch);
}

function returnRatingOf(r: LeaderboardRow): number | null {
  return sumParts([
    r.returnFirstWonPct,
    r.returnSecondWonPct,
    r.returnGamesWonPct,
    r.bpConvertedPct,
  ]);
}

/** ATP : rating officiel publié, repli sur la formule par composantes si absent. */
const ATP_RATING_OF: Record<BoardType, (r: LeaderboardRow) => number | null> = {
  serve: (r) => r.rating ?? serveRatingOf(r),
  return: (r) => r.rating ?? returnRatingOf(r),
  pressure: (r) =>
    r.rating ??
    sumParts([
      r.bpSavedPct,
      r.bpConvertedPct,
      r.tiebreaksWonPct,
      r.decidingSetsWonPct,
    ]),
};

/** WTA : ratings calculés — pression sur 2 composantes (TB/sets décisifs non publiés). */
const WTA_RATING_OF: Record<BoardType, (r: LeaderboardRow) => number | null> = {
  serve: serveRatingOf,
  return: returnRatingOf,
  pressure: (r) => sumParts([r.bpSavedPct, r.bpConvertedPct]),
};

// ─── Mapping vers LeaderboardRow ─────────────────────────────────────────────

function emptyRow(
  player: string,
  playerId: string | null,
  iocRaw: string | null,
  matches: number | null
): LeaderboardRow {
  return {
    rank: 0,
    player,
    playerId,
    ioc: iocToIso2(iocRaw),
    matches,
    rating: null,
    firstServePct: null,
    firstServeWonPct: null,
    secondServeWonPct: null,
    serviceGamesWonPct: null,
    acesPerMatch: null,
    dfsPerMatch: null,
    returnFirstWonPct: null,
    returnSecondWonPct: null,
    returnGamesWonPct: null,
    bpConvertedPct: null,
    bpSavedPct: null,
    tiebreaksWonPct: null,
    decidingSetsWonPct: null,
  };
}

/** Entrée ATP (un board par dataset) → ligne, rating officiel pré-positionné. */
export function atpEntryToRow(
  entry: AtpEntry,
  board: BoardType
): LeaderboardRow | null {
  const stats = entry.Stats;
  const name = typeof entry.PlayerName === "string" ? entry.PlayerName.trim() : "";
  if (!stats || !name) return null;
  const row = emptyRow(
    name,
    typeof entry.PlayerId === "string" && entry.PlayerId !== ""
      ? entry.PlayerId
      : null,
    typeof entry.PlayerCountryCode === "string" ? entry.PlayerCountryCode : null,
    null // non publié par l'ATP — éligibilité déjà appliquée côté source
  );
  if (board === "serve") {
    row.firstServePct = atpStat(stats, "FirstServePct");
    row.firstServeWonPct = atpStat(stats, "FirstServePointsWonPct");
    row.secondServeWonPct = atpStat(stats, "SecondServePointsWonPct");
    row.serviceGamesWonPct = atpStat(stats, "ServiceGamesWonPct");
    row.acesPerMatch = atpStat(stats, "AvgAcesPerMatch");
    row.dfsPerMatch = atpStat(stats, "AvgDblFaultsPerMatch");
    row.rating = atpStat(stats, "ServeRating");
  } else if (board === "return") {
    row.returnFirstWonPct = atpStat(stats, "FirstServeReturnPointsWonPct");
    row.returnSecondWonPct = atpStat(stats, "SecondServeReturnPointsWonPct");
    row.returnGamesWonPct = atpStat(stats, "ReturnGamesWonPct");
    row.bpConvertedPct = atpStat(stats, "BrkPointsConvertedPct");
    row.rating = atpStat(stats, "ReturnRating");
  } else {
    row.bpConvertedPct = atpStat(stats, "BrkPointsConvertedPct");
    row.bpSavedPct = atpStat(stats, "BrkPointsSavedPct");
    row.tiebreaksWonPct = atpStat(stats, "TieBreaksWonPct");
    row.decidingSetsWonPct = atpStat(stats, "DecidingSetsWonPct");
    row.rating = atpStat(stats, "PressureRating");
  }
  return row;
}

/** Ligne WTA brute (tous compteurs) → ligne complète 3 boards ; rating calculé après. */
export function wtaRawToRow(raw: WtaRawRow): LeaderboardRow | null {
  const first = typeof raw.First_Name === "string" ? raw.First_Name.trim() : "";
  const last = typeof raw.Last_Name === "string" ? raw.Last_Name.trim() : "";
  const player = titleCase(`${first} ${last}`.trim());
  if (!player) return null;
  const row = emptyRow(
    player,
    raw.PlayerNbr != null && raw.PlayerNbr !== "" ? String(raw.PlayerNbr) : null,
    typeof raw.Nationality === "string" ? raw.Nationality : null,
    num(raw.MatchCount)
  );
  row.firstServePct = wtaPct(raw, "first_serve_percent");
  row.firstServeWonPct = wtaPct(raw, "first_serve_won_percent");
  row.secondServeWonPct = wtaPct(raw, "second_serve_won_percent");
  row.serviceGamesWonPct = wtaPct(raw, "service_games_won_percent");
  row.acesPerMatch = perMatch(raw.Aces, raw.MatchCount);
  row.dfsPerMatch = perMatch(raw.Double_Faults, raw.MatchCount);
  row.returnFirstWonPct = wtaPct(raw, "first_return_percent");
  row.returnSecondWonPct = wtaPct(raw, "second_return_percent");
  row.returnGamesWonPct = wtaPct(raw, "return_games_won_percent");
  row.bpConvertedPct = wtaPct(raw, "breakpoint_converted_percent");
  row.bpSavedPct = wtaPct(raw, "breakpoint_saved_percent");
  // tiebreaksWonPct / decidingSetsWonPct : non publiés par la WTA → null.
  return row;
}

// ─── Chargement des caches ───────────────────────────────────────────────────

function generatedAtOf(cache: { generatedAt?: unknown } | null): string {
  const v = cache?.generatedAt;
  return typeof v === "string" && v ? v : new Date().toISOString();
}

/** ATP : correspondance stricte board|surface|vsRank ; période toujours 52w. */
function officialAtp(params: LeaderboardParams): OfficialLeaderboardResult | null {
  const cache = readJsonSafe<AtpCache>("atp.json");
  const entries =
    cache?.datasets?.[`${params.board}|${params.surface}|${params.vsRank}`];
  if (!entries?.length) return null;
  const rows: LeaderboardRow[] = [];
  for (const e of entries) {
    const row = atpEntryToRow(e, params.board);
    if (row) rows.push(row);
  }
  const ranked = finalize(rows, params.minMatches, ATP_RATING_OF[params.board]);
  if (!ranked.length) return null;
  return {
    rows: ranked,
    source: "official-atp",
    generatedAt: generatedAtOf(cache),
    coverage: { period: "52w", surface: params.surface, vsRank: params.vsRank },
  };
}

/** WTA : un seul jeu annuel — surface et vsRank non filtrables côté source. */
function officialWta(params: LeaderboardParams): OfficialLeaderboardResult | null {
  if (params.surface !== "all" || params.vsRank !== "all") return null;
  const cache = readJsonSafe<WtaCache>("wta.json");
  if (!cache?.rows?.length) return null;
  const rows: LeaderboardRow[] = [];
  for (const raw of cache.rows) {
    const row = wtaRawToRow(raw);
    if (row) rows.push(row);
  }
  const ranked = finalize(rows, params.minMatches, WTA_RATING_OF[params.board]);
  if (!ranked.length) return null;
  return {
    rows: ranked,
    source: "official-wta",
    generatedAt: generatedAtOf(cache),
    coverage: { period: "ytd", surface: "all", vsRank: "all" },
  };
}

// ─── API publique ────────────────────────────────────────────────────────────

/**
 * Repli officiel ATP/WTA pour /api/tennis/stats-leaderboard. Retourne null si
 * le cache est absent, illisible ou ne couvre pas les filtres demandés —
 * l'appelant retombe alors sur l'état vide existant. Ne lève JAMAIS.
 */
export function getOfficialLeaderboard(
  params: LeaderboardParams
): OfficialLeaderboardResult | null {
  try {
    const result = params.tour === "atp" ? officialAtp(params) : officialWta(params);
    console.warn("[official-leaderboard] DATA_DIR:", DATA_DIR, "tour:", params.tour, "result:", result ? `${result.rows.length} rows` : "null");
    return result;
  } catch (err) {
    console.error("[official-leaderboard] ERREUR:", (err as Error).message, "DATA_DIR:", DATA_DIR);
    return null;
  }
}
