// Leaderboard statistiques joueurs (inspiré de l'ATP Tour Stats Leaderboard)
// — agrégation des stats service / retour / sous pression depuis la table
// `tennis_matches_internal` (pariscore.db, ouverte en lecture seule).
//
// 3 boards :
//   - serve    : Serve Rating, % 1er service, % pts gagnés 1er, % pts gagnés 2e,
//                % jeux de service gagnés, aces/match, DF/match
//   - return   : Return Rating, % pts retour 1er, % pts retour 2e,
//                % jeux de retour gagnés, % balles de break converties
//   - pressure : Under Pressure Rating, % BP sauvées, % BP converties,
//                % tie-breaks gagnés, % sets décisifs gagnés
//
// Formule Serve Rating — vérifiée sur les valeurs publiques ATP (2026-07) :
//   Serve Rating = %1er service + %pts 1er + %pts 2e + %jeux service gagnés
//                  + aces/match − DF/match
//   (ex. Opelka : 66.7+81.1+53.3+91.6+19.5−4.3 = 307.9 ✓)
// Return Rating et Under Pressure Rating = somme des 4 pourcentages du board.
//
// Approximation documentée : sans données point-par-point, un jeu de service
// perdu est approché par (bpFaced − bpSaved). Cela sur-estime légèrement les
// breaks quand un même jeu a vu plusieurs balles de break — convention déjà
// utilisée par le pipeline SPS (cf. .context/doc-sps-surface-power-score.md).
// Les matchs terminés sur abandon (RET/WO/DEF) sont exclus de l'agrégation.
//
// Conception défensive : base absente, vide ou illisible → résultat vide,
// jamais d'exception vers l'appelant (l'UI dégrade en état vide).

import path from "node:path";

// ─── Types publics ───────────────────────────────────────────────────────────

export type BoardType = "serve" | "return" | "pressure";
export type TourFilter = "atp" | "wta";
export type SurfaceFilter = "all" | "hard" | "clay" | "grass";
export type PeriodFilter = "52w" | "ytd" | "all";
export type VsRankFilter = "all" | "top5" | "top10" | "top20" | "top50" | "top100";

export interface LeaderboardParams {
  board: BoardType;
  tour: TourFilter;
  surface: SurfaceFilter;
  period: PeriodFilter;
  vsRank: VsRankFilter;
  /** Seuil minimum de matchs dans le périmètre pour figurer au classement. */
  minMatches: number;
}

export const DEFAULT_MIN_MATCHES = 5;

export const BOARD_TYPES: readonly BoardType[] = ["serve", "return", "pressure"];
export const TOUR_FILTERS: readonly TourFilter[] = ["atp", "wta"];
export const SURFACE_FILTERS: readonly SurfaceFilter[] = ["all", "hard", "clay", "grass"];
export const PERIOD_FILTERS: readonly PeriodFilter[] = ["52w", "ytd", "all"];
export const VS_RANK_FILTERS: readonly VsRankFilter[] = [
  "all",
  "top5",
  "top10",
  "top20",
  "top50",
  "top100",
];

/** Ligne du leaderboard — toutes les stats des 3 boards, null si indisponible. */
export interface LeaderboardRow {
  rank: number;
  player: string;
  playerId: string | null;
  /** Code pays ISO alpha-2 minuscules (converti depuis l'IOC base via iocToIso2). */
  ioc: string | null;
  matches: number;
  rating: number | null;
  // Board service
  firstServePct: number | null;
  firstServeWonPct: number | null;
  secondServeWonPct: number | null;
  serviceGamesWonPct: number | null;
  acesPerMatch: number | null;
  dfsPerMatch: number | null;
  // Board retour
  returnFirstWonPct: number | null;
  returnSecondWonPct: number | null;
  returnGamesWonPct: number | null;
  bpConvertedPct: number | null;
  // Board sous pression
  bpSavedPct: number | null;
  tiebreaksWonPct: number | null;
  decidingSetsWonPct: number | null;
}

export interface LeaderboardResult {
  rows: LeaderboardRow[];
  meta: LeaderboardParams & {
    players: number;
    generatedAt: string;
    /** true si la base est absente/vide — l'UI affiche l'état vide. */
    dataUnavailable: boolean;
  };
}

// ─── Couche DB (même pattern que src/lib/tennis-stats/db.ts) ─────────────────

/** Interface minimale commune à better-sqlite3 (prod) et bun:sqlite (tests). */
export type SqliteLike = {
  prepare: (sql: string) => { all: (...params: unknown[]) => unknown[] };
};

const SQLITE_FILE =
  process.env.DATABASE_PATH || path.join(process.cwd(), "pariscore.db");

let _db: SqliteLike | null = null;
let _dbUnavailable = false;

/**
 * Ouvre pariscore.db en lecture seule (singleton). Retourne null si absente —
 * l'appelant dégrade alors gracieusement (état vide côté UI).
 */
function getDb(): SqliteLike | null {
  if (_dbUnavailable) return null;
  if (_db) return _db;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require("better-sqlite3") as unknown as {
      new (file: string, opts?: { readonly?: boolean; fileMustExist?: boolean }): SqliteLike;
    };
    _db = new Database(SQLITE_FILE, { readonly: true, fileMustExist: true });
    return _db;
  } catch (err) {
    _dbUnavailable = true;
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        `[tennis-leaderboard] pariscore.db non lisible (${SQLITE_FILE}) — ` +
          `leaderboard désactivé. Détail: ${(err as Error).message}`
      );
    }
    return null;
  }
}


// ─── Extraction SQL ──────────────────────────────────────────────────────────

/**
 * Une ligne par (joueur × match), du point de vue du joueur :
 * stats de service du joueur + stats de service de l'adversaire (= retour).
 * `score` reste exprimé côté winner — `won_match` permet de l'inverser.
 */
export interface PlayerMatchRow {
  player: string;
  player_id: string | null;
  ioc: string | null;
  match_date: number | null;
  opp_rank: number | null;
  svpt: number | null;
  first_in: number | null;
  first_won: number | null;
  second_won: number | null;
  aces: number | null;
  dfs: number | null;
  sv_gms: number | null;
  bp_saved: number | null;
  bp_faced: number | null;
  opp_svpt: number | null;
  opp_first_in: number | null;
  opp_first_won: number | null;
  opp_second_won: number | null;
  opp_sv_gms: number | null;
  opp_bp_saved: number | null;
  opp_bp_faced: number | null;
  score: string | null;
  sets_won: number | null;
  sets_lost: number | null;
  best_of: number | null;
  won_match: number;
}

/** Filtres WHERE communs aux deux branches de l'UNION (colonnes table d'origine). */
function buildFilters(p: LeaderboardParams): { where: string; args: unknown[] } {
  const clauses: string[] = [
    // Abandons exclus — stats incomplètes (convention ATP).
    "(score IS NULL OR (UPPER(score) NOT LIKE '%RET%' AND UPPER(score) NOT LIKE '%W/O%' AND UPPER(score) NOT LIKE '%DEF%' AND UPPER(score) NOT LIKE '%ABD%'))",
  ];
  const args: unknown[] = [];

  clauses.push("UPPER(tour) = ?");
  args.push(p.tour.toUpperCase());

  if (p.surface !== "all") {
    clauses.push("LOWER(surface) = ?");
    args.push(p.surface);
  }
  if (p.period === "52w") {
    clauses.push("match_date IS NOT NULL AND match_date >= ?");
    args.push(Date.now() - 52 * 7 * 24 * 3600 * 1000);
  } else if (p.period === "ytd") {
    clauses.push("match_date IS NOT NULL AND match_date >= ?");
    args.push(new Date(new Date().getFullYear(), 0, 1).getTime());
  }
  if (p.vsRank !== "all") {
    const cap = Number(p.vsRank.replace("top", ""));
    clauses.push("opp_rank IS NOT NULL AND opp_rank <= ?");
    args.push(cap);
  }
  return { where: clauses.join("\n    AND "), args };
}

/**
 * Construit la requête UNION ALL (perspective winner + perspective loser).
 * Les args des filtres sont dupliqués pour les deux branches (params `?`).
 */
export function buildLeaderboardQuery(p: LeaderboardParams): {
  sql: string;
  args: unknown[];
} {
  const { where, args } = buildFilters(p);
  const branch = (side: "w" | "l") => {
    const o = side === "w" ? "l" : "w";
    const nameCol = side === "w" ? "winner_name" : "loser_name";
    const pidCol = side === "w" ? "winner_player_id" : "loser_player_id";
    const iocCol = side === "w" ? "winner_ioc" : "loser_ioc";
    const oppRankCol = side === "w" ? "loser_rank" : "winner_rank";
    const setsWonCol = side === "w" ? "sets_winner" : "sets_loser";
    const setsLostCol = side === "w" ? "sets_loser" : "sets_winner";
    return `
  SELECT ${nameCol} AS player, ${pidCol} AS player_id, ${iocCol} AS ioc,
         match_date, ${oppRankCol} AS opp_rank,
         ${side}_svpt AS svpt, ${side}_1stIn AS first_in,
         ${side}_1stWon AS first_won, ${side}_2ndWon AS second_won,
         ${side}_ace AS aces, ${side}_df AS dfs, ${side}_SvGms AS sv_gms,
         ${side}_bpSaved AS bp_saved, ${side}_bpFaced AS bp_faced,
         ${o}_svpt AS opp_svpt, ${o}_1stIn AS opp_first_in,
         ${o}_1stWon AS opp_first_won, ${o}_2ndWon AS opp_second_won,
         ${o}_SvGms AS opp_sv_gms, ${o}_bpSaved AS opp_bp_saved,
         ${o}_bpFaced AS opp_bp_faced,
         score, ${setsWonCol} AS sets_won, ${setsLostCol} AS sets_lost,
         best_of, ${side === "w" ? 1 : 0} AS won_match
  FROM tennis_matches_internal
  WHERE ${where}`;
  };
  const sql = `${branch("w")}\nUNION ALL\n${branch("l")}`;
  return { sql, args: [...args, ...args] };
}

/** Exécute l'extraction. L'erreur SQL est catchée par l'appelant (défensif). */
export function extractPlayerMatchRows(
  db: SqliteLike,
  p: LeaderboardParams
): PlayerMatchRow[] {
  const { sql, args } = buildLeaderboardQuery(p);
  return db.prepare(sql).all(...args) as PlayerMatchRow[];
}

// ─── Parsing du score (tie-breaks, sets décisifs) ────────────────────────────

/** Un set "6-4", "7-6(5)", "10-8"… (le score du TB entre parenthèses est ignoré). */
const SET_TOKEN_RE = /^(\d+)-(\d+)(?:\(\d+\))?$/;

/**
 * Compte les tie-breaks gagnés/perdus du joueur depuis le score (exprimé côté
 * winner — `wonMatch` inverse la perspective). Les "match tie-breaks" (10-8…)
 * sont comptés comme des tie-breaks.
 */
export function parseTiebreaks(
  score: string | null,
  wonMatch: boolean
): { tbWon: number; tbLost: number } {
  let tbWon = 0;
  let tbLost = 0;
  if (!score) return { tbWon, tbLost };
  for (const token of score.trim().split(/\s+/)) {
    const m = SET_TOKEN_RE.exec(token);
    if (!m) continue;
    const w = Number(m[1]);
    const l = Number(m[2]);
    const isSetTb = (w === 7 && l === 6) || (w === 6 && l === 7);
    const isMatchTb = w >= 10 || l >= 10;
    if (!isSetTb && !isMatchTb) continue;
    const winnerWonTb = w > l;
    const playerWonTb = wonMatch ? winnerWonTb : !winnerWonTb;
    if (playerWonTb) tbWon += 1;
    else tbLost += 1;
  }
  return { tbWon, tbLost };
}

/**
 * Vrai si le match s'est joué au set décisif (3e en BO3, 5e en BO5).
 * `bestOf` peut être null — on infère alors depuis le nombre de sets joués.
 */
export function isDecidingSetMatch(
  bestOf: number | null,
  setsWon: number,
  setsLost: number
): boolean {
  const total = setsWon + setsLost;
  if (total < 3) return false;
  const maxSets = bestOf === 5 ? 5 : bestOf === 3 ? 3 : total >= 4 ? 5 : 3;
  return total === maxSets;
}

// ─── Agrégation ──────────────────────────────────────────────────────────────

/** Normalisation identique à db.ts (NFD → sans diacritics → lower) — dupliquée
 *  pour garder le module autonome (merge des variantes de noms). */
function normalizeName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function round1(x: number): number {
  return Math.round(x * 10) / 10;
}

/**
 * Conversion IOC (3 lettres, format Sackmann en base) → ISO 3166-1 alpha-2
 * attendu par `CountryFlag`. Pays couvrant l'essentiel du top 200 ATP/WTA ;
 * inconnu → null (pas de badge drapeau plutôt qu'un drapeau faux).
 */
const IOC_TO_ISO2: Record<string, string> = {
  ALG: "DZ", ARG: "AR", ARM: "AM", AUS: "AU", AUT: "AT", AZE: "AZ",
  BAH: "BS", BAR: "BB", BEL: "BE", BIH: "BA", BLR: "BY", BOL: "BO",
  BRA: "BR", BUL: "BG", CAN: "CA", CHI: "CL", CHN: "CN", COL: "CO",
  CRC: "CR", CRO: "HR", CUB: "CU", CYP: "CY", CZE: "CZ", DEN: "DK",
  DOM: "DO", ECU: "EC", EGY: "EG", ESP: "ES", EST: "EE", FIN: "FI",
  FRA: "FR", GBR: "GB", GEO: "GE", GER: "DE", GRE: "GR", GUA: "GT",
  HKG: "HK", HUN: "HU", INA: "ID", IND: "IN", IRI: "IR", IRL: "IE",
  ISR: "IL", ITA: "IT", JPN: "JP", KAZ: "KZ", KOR: "KR", LAT: "LV",
  LIB: "LB", LTU: "LT", LUX: "LU", MAR: "MA", MAS: "MY", MDA: "MD",
  MEX: "MX", MKD: "MK", MNE: "ME", MON: "MC", NED: "NL", NOR: "NO",
  NZL: "NZ", PER: "PE", PHI: "PH", POL: "PL", POR: "PT", PUR: "PR",
  QAT: "QA", ROU: "RO", RSA: "ZA", RUS: "RU", SEN: "SN", SLO: "SI",
  SRB: "RS", SUI: "CH", SVK: "SK", SWE: "SE", THA: "TH", TPE: "TW",
  TUN: "TN", TUR: "TR", UKR: "UA", URU: "UY", USA: "US", UZB: "UZ",
  VEN: "VE", VIE: "VN", ZIM: "ZW",
};

/** "ESP" → "es" (minuscules, convention CountryFlag), null si inconnu. */
export function iocToIso2(ioc: string | null): string | null {
  if (!ioc) return null;
  const iso = IOC_TO_ISO2[ioc.trim().toUpperCase()];
  return iso ? iso.toLowerCase() : null;
}

/** Pourcentage 0-100 arrondi au dixième, null si dénominateur nul. */
function pct(num: number, den: number): number | null {
  return den > 0 ? round1((num / den) * 100) : null;
}

interface Acc {
  nameFreq: Map<string, number>;
  playerId: string | null;
  ioc: string | null;
  iocDate: number;
  matches: number;
  serveMatches: number; // matchs avec stats de service (svpt > 0)
  svpt: number;
  firstIn: number;
  firstWon: number;
  secondWon: number;
  aces: number;
  dfs: number;
  svGms: number;
  bpSaved: number;
  bpFaced: number;
  oppSvpt: number;
  oppFirstIn: number;
  oppFirstWon: number;
  oppSecondWon: number;
  oppSvGms: number;
  oppBpSaved: number;
  oppBpFaced: number;
  tbWon: number;
  tbLost: number;
  decWon: number;
  decTotal: number;
}

function freshAcc(): Acc {
  return {
    nameFreq: new Map(),
    playerId: null,
    ioc: null,
    iocDate: 0,
    matches: 0,
    serveMatches: 0,
    svpt: 0,
    firstIn: 0,
    firstWon: 0,
    secondWon: 0,
    aces: 0,
    dfs: 0,
    svGms: 0,
    bpSaved: 0,
    bpFaced: 0,
    oppSvpt: 0,
    oppFirstIn: 0,
    oppFirstWon: 0,
    oppSecondWon: 0,
    oppSvGms: 0,
    oppBpSaved: 0,
    oppBpFaced: 0,
    tbWon: 0,
    tbLost: 0,
    decWon: 0,
    decTotal: 0,
  };
}

/** Nom d'affichage = variante la plus fréquente dans le périmètre. */
function displayNameOf(a: Acc): string {
  let best = "";
  let bestN = -1;
  for (const [name, n] of a.nameFreq) {
    if (n > bestN || (n === bestN && name.length > best.length)) {
      best = name;
      bestN = n;
    }
  }
  return best;
}

/** Calcule les 3 boards pour un joueur agrégé ; null si données insuffisantes. */
function buildRow(a: Acc): LeaderboardRow {
  // — Service
  const firstServePct = pct(a.firstIn, a.svpt);
  const firstServeWonPct = pct(a.firstWon, a.firstIn);
  const secondServeWonPct = pct(a.secondWon, a.svpt - a.firstIn);
  const serviceGamesWonPct =
    a.svGms > 0
      ? round1(Math.max(0, 100 * (1 - Math.max(0, a.bpFaced - a.bpSaved) / a.svGms)))
      : null;
  const acesPerMatch = a.serveMatches > 0 ? round1(a.aces / a.serveMatches) : null;
  const dfsPerMatch = a.serveMatches > 0 ? round1(a.dfs / a.serveMatches) : null;

  // — Retour (miroir du service adverse)
  const returnFirstWonPct = pct(a.oppFirstIn - a.oppFirstWon, a.oppFirstIn);
  const returnSecondWonPct = pct(
    a.oppSvpt - a.oppFirstIn - a.oppSecondWon,
    a.oppSvpt - a.oppFirstIn
  );
  const breaksConverted = Math.max(0, a.oppBpFaced - a.oppBpSaved);
  const returnGamesWonPct = pct(breaksConverted, a.oppSvGms);
  const bpConvertedPct = pct(breaksConverted, a.oppBpFaced);

  // — Sous pression
  const bpSavedPct = pct(a.bpSaved, a.bpFaced);
  const tiebreaksWonPct = pct(a.tbWon, a.tbWon + a.tbLost);
  const decidingSetsWonPct = pct(a.decWon, a.decTotal);

  return {
    rank: 0, // assigné après tri
    player: displayNameOf(a),
    playerId: a.playerId,
    ioc: iocToIso2(a.ioc),
    matches: a.matches,
    rating: null, // assigné selon le board actif
    firstServePct,
    firstServeWonPct,
    secondServeWonPct,
    serviceGamesWonPct,
    acesPerMatch,
    dfsPerMatch,
    returnFirstWonPct,
    returnSecondWonPct,
    returnGamesWonPct,
    bpConvertedPct,
    bpSavedPct,
    tiebreaksWonPct,
    decidingSetsWonPct,
  };
}

/** Rating du board actif — somme des composantes (formules en tête de fichier). */
function boardRating(row: LeaderboardRow, board: BoardType): number | null {
  if (board === "serve") {
    const parts = [
      row.firstServePct,
      row.firstServeWonPct,
      row.secondServeWonPct,
      row.serviceGamesWonPct,
    ];
    if (parts.some((v) => v == null) || row.acesPerMatch == null || row.dfsPerMatch == null) {
      return null;
    }
    return round1(
      (parts as number[]).reduce((s, v) => s + v, 0) + row.acesPerMatch - row.dfsPerMatch
    );
  }
  if (board === "return") {
    const parts = [
      row.returnFirstWonPct,
      row.returnSecondWonPct,
      row.returnGamesWonPct,
      row.bpConvertedPct,
    ];
    if (parts.some((v) => v == null)) return null;
    return round1((parts as number[]).reduce((s, v) => s + v, 0));
  }
  const parts = [
    row.bpSavedPct,
    row.bpConvertedPct,
    row.tiebreaksWonPct,
    row.decidingSetsWonPct,
  ];
  if (parts.some((v) => v == null)) return null;
  return round1((parts as number[]).reduce((s, v) => s + v, 0));
}

/**
 * Agrège les lignes (joueur × match) en leaderboard trié par rating DESC.
 * Les joueurs sous le seuil `minMatches` ou sans rating calculable sont exclus.
 */
export function aggregateLeaderboard(
  rows: PlayerMatchRow[],
  params: LeaderboardParams
): LeaderboardRow[] {
  const byPlayer = new Map<string, Acc>();

  for (const r of rows) {
    if (!r.player) continue;
    const key = normalizeName(r.player);
    if (!key) continue;
    let a = byPlayer.get(key);
    if (!a) {
      a = freshAcc();
      byPlayer.set(key, a);
    }
    a.matches += 1;
    a.nameFreq.set(r.player, (a.nameFreq.get(r.player) ?? 0) + 1);
    if (r.player_id) a.playerId = r.player_id;
    if (r.ioc && (r.match_date ?? 0) >= a.iocDate) {
      a.ioc = r.ioc;
      a.iocDate = r.match_date ?? 0;
    }
    if ((r.svpt ?? 0) > 0) a.serveMatches += 1;
    a.svpt += r.svpt ?? 0;
    a.firstIn += r.first_in ?? 0;
    a.firstWon += r.first_won ?? 0;
    a.secondWon += r.second_won ?? 0;
    a.aces += r.aces ?? 0;
    a.dfs += r.dfs ?? 0;
    a.svGms += r.sv_gms ?? 0;
    a.bpSaved += r.bp_saved ?? 0;
    a.bpFaced += r.bp_faced ?? 0;
    a.oppSvpt += r.opp_svpt ?? 0;
    a.oppFirstIn += r.opp_first_in ?? 0;
    a.oppFirstWon += r.opp_first_won ?? 0;
    a.oppSecondWon += r.opp_second_won ?? 0;
    a.oppSvGms += r.opp_sv_gms ?? 0;
    a.oppBpSaved += r.opp_bp_saved ?? 0;
    a.oppBpFaced += r.opp_bp_faced ?? 0;
    const { tbWon, tbLost } = parseTiebreaks(r.score, r.won_match === 1);
    a.tbWon += tbWon;
    a.tbLost += tbLost;
    const sw = r.sets_won ?? 0;
    const sl = r.sets_lost ?? 0;
    if (isDecidingSetMatch(r.best_of, sw, sl)) {
      a.decTotal += 1;
      if (r.won_match === 1) a.decWon += 1;
    }
  }

  const out: LeaderboardRow[] = [];
  for (const a of byPlayer.values()) {
    if (a.matches < params.minMatches) continue;
    const row = buildRow(a);
    row.rating = boardRating(row, params.board);
    if (row.rating == null) continue;
    out.push(row);
  }
  out.sort(
    (x, y) =>
      (y.rating ?? -Infinity) - (x.rating ?? -Infinity) || y.matches - x.matches
  );
  out.forEach((r, i) => {
    r.rank = i + 1;
  });
  return out;
}

// ─── API publique ────────────────────────────────────────────────────────────

function emptyResult(
  params: LeaderboardParams,
  dataUnavailable: boolean
): LeaderboardResult {
  return {
    rows: [],
    meta: { ...params, players: 0, generatedAt: new Date().toISOString(), dataUnavailable },
  };
}

/**
 * Point d'entrée du leaderboard. Ne lève JAMAIS : base absente/illisible ou
 * requête en échec → `{ rows: [], meta.dataUnavailable: true }`.
 */
export function getStatsLeaderboard(params: LeaderboardParams): LeaderboardResult {
  const db = getDb();
  if (!db) return emptyResult(params, true);
  let rows: PlayerMatchRow[];
  try {
    rows = extractPlayerMatchRows(db, params);
  } catch (err) {
    console.error("[tennis-leaderboard] requête en échec:", (err as Error).message);
    return emptyResult(params, true);
  }
  const agg = aggregateLeaderboard(rows, params);
  return {
    rows: agg,
    meta: {
      ...params,
      players: agg.length,
      generatedAt: new Date().toISOString(),
      dataUnavailable: false,
    },
  };
}
