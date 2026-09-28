// Matrice de backtest tennis — type de marché × segments.
//
// Source : table `tennis_matches_internal` (pariscore.db, ~18 700 matchs
// 2026-02 → 2026-08, ATP+WTA, cotes moneyline réelles sur ~16 400 d'entre
// elles, source BSD). Le backtest porte sur 9 marchés alignés sur l'offre
// tennis 1xbet (cf. `prediction/tennis-market-map.ts`) et 4 dimensions de
// filtre demandées : surface, homme/femme, type de tournoi, bande de cote.
//
// Sémantique DB vérifiée par sondage (2026-09-28) :
//   - `score` est écrit du point de vue du JOUEUR 1 (odds_player1) ;
//   - `sets_winner` / `sets_loser` = sets du 1er / 2e joueur du score
//     (cohérent sur 18 174/18 675 lignes — le reste = abandons ou formats
//     inconnus, EXCLUS ici) ;
//   - `tour` est constant à l'intérieur d'un tourney_id (0 id mixte) mais
//     faux sur les UTR « Women » (marqués ATP) → genre déduit des marqueurs
//     de nom d'abord, `tour` ensuite ;
//   - le favori (cote la plus basse) gagne 70,2 % des matchs cotés
//     (88 % / 71 % / 59 % par bande <1,2 / 1,2-1,5 / 1,5-2) → alignement
//     odds/résultat sain.
//
// Protocole : mise plate 1u, marchés moneyline réglés aux cotes RÉELLES du
// match, marchés dérivés réglés à des cotes moyennes 1xbet SIMULÉES (protocole
// handball-backtest.ts — ROI indicatif). Sélection sans variable post-match →
// anti-lookahead trivial.
//
// Verdict par cellule (filtres définis face à l'offre 1xbet) :
//   ⚪ low  : n < 30 paris (échantillon faible — bruit)
//   🟢 good : hit − 1/coteMoyenne ≥ +5 pts
//   🟡 ok   : hit − 1/coteMoyenne ≥ −3 pts
//   🔴 bad  : sinon

import path from "node:path";

// ─── Types publics ───────────────────────────────────────────────────────────

export type TennisBtWindow = "full" | "d30";
export type TennisBtVerdict = "good" | "ok" | "bad" | "low";
export type TennisBtDimKey = "surface" | "gender" | "tier" | "band";
export type TennisBtMarketGroup = "moneyline" | "sets" | "jeux";

/** Cellule de la matrice : perf d'un marché sur un segment (ou global). */
export interface TennisBtCell {
  n: number;
  wins: number;
  /** Hit rate 0-1, null si n = 0. */
  hit: number | null;
  /** Cote moyenne des paris de la cellule (réelle pour la moneyline). */
  avgOdds: number | null;
  /** ROI en % sur mise plate 1u, null si n = 0. */
  roi: number | null;
  sampleOk: boolean;
  verdict: TennisBtVerdict;
}

export interface TennisBtMarket {
  key: string;
  label: string;
  group: TennisBtMarketGroup;
  /** Cote simulée fixe (null = cote réelle par pari). */
  odds: number | null;
  oddsKind: "real" | "simulated";
  /** Lien avec une stratégie Top 10 existante, le cas échéant. */
  note?: string;
}

export interface TennisBtSegment {
  key: string;
  label: string;
  nMatches: number;
  cells: Record<string, TennisBtCell>;
}

export interface TennisBtDimension {
  key: TennisBtDimKey;
  label: string;
  segments: TennisBtSegment[];
}

export interface TennisBtResult {
  window: TennisBtWindow;
  from: string | null;
  to: string | null;
  /** Lignes brutes lues dans la fenêtre. */
  nRows: number;
  /** Matchs valides (complets + cotes exploitables). */
  nValid: number;
  markets: TennisBtMarket[];
  global: Record<string, TennisBtCell>;
  dimensions: TennisBtDimension[];
  thresholds: { minSample: number; goodEdge: number; okEdge: number };
  methodology: string;
  simulatedOdds: true;
  source: "tennis_matches_internal";
  computedAt: string;
}

/** Ligne brute de `tennis_matches_internal` (colonnes nécessaires). */
export interface TennisBtRow {
  match_date: number;
  tourney_name: string;
  tour: string;
  surface: string | null;
  round: string | null;
  score: string | null;
  sets_winner: number | null;
  sets_loser: number | null;
  odds_player1: number | null;
  odds_player2: number | null;
}

// ─── Seuils ──────────────────────────────────────────────────────────────────

/** Paris minimum par cellule — sous ce seuil, verdict ⚪ (bruit). */
export const MIN_SAMPLE = 30;
/** Segment affiché seulement si ≥ ce nombre de matchs. */
export const MIN_SEGMENT_MATCHS = 20;
/** Écart hit − cote implicite pour verdict 🟢 / 🟡. */
const GOOD_EDGE = 0.05;
const OK_EDGE = -0.03;

// ─── Marchés (offre tennis 1xbet) ────────────────────────────────────────────

/**
 * Cotes simulées = prix moyens 1xbet tennis (sep. 2026), protocole identique
 * à handball-backtest.ts : ROI indicatif.
 */
export const TENNIS_BT_MARKETS: readonly TennisBtMarket[] = [
  { key: "favMl", label: "Favori (moneyline)", group: "moneyline", odds: null, oddsKind: "real" },
  { key: "dogMl", label: "Outsider (moneyline)", group: "moneyline", odds: null, oddsKind: "real" },
  {
    key: "favStraight",
    label: "Favori sans set perdu (2-0 / 3-0)",
    group: "sets",
    odds: 1.65,
    oddsKind: "simulated",
    note: "= stratégie Top 10 « Favori 2-0 »",
  },
  { key: "firstSetFav", label: "1er set : favori", group: "sets", odds: 1.45, oddsKind: "simulated" },
  {
    key: "doubleFav",
    label: "Double favori (1er set + match)",
    group: "sets",
    odds: 1.35,
    oddsKind: "simulated",
  },
  { key: "over2_5sets", label: "Total sets Over 2,5", group: "sets", odds: 2.0, oddsKind: "simulated" },
  {
    key: "over215",
    label: "Total jeux Over 21,5",
    group: "jeux",
    odds: 1.9,
    oddsKind: "simulated",
    note: "= stratégie Top 10 « Over 21,5 »",
  },
  {
    key: "under215",
    label: "Total jeux Under 21,5",
    group: "jeux",
    odds: 1.9,
    oddsKind: "simulated",
    note: "= stratégie Top 10 « Under 21,5 »",
  },
  { key: "favGamesHcp", label: "Handicap jeux favori −3,5", group: "jeux", odds: 1.87, oddsKind: "simulated" },
];

const MARKET_BY_KEY = new Map(TENNIS_BT_MARKETS.map((m) => [m.key, m]));

// ─── Parsing score ───────────────────────────────────────────────────────────

type ParsedScore = {
  setsP1: number;
  setsP2: number;
  gamesP1: number;
  gamesP2: number;
  setsPlayed: number;
  firstSetP1Won: boolean;
};

/**
 * Parse un score type « 7-6 3-6 4-6 » (perspective joueur 1).
 * Retourne null si : score vide, aucun set parsable, dernière set incomplète
 * (abandon en cours de set), match non décidé, ou sets incohérents avec les
 * colonnes sets_winner/sets_loser (format inconnu → hors échantillon).
 */
export function parseTennisScore(
  score: string | null | undefined,
  setsWinner: number | null | undefined,
  setsLoser: number | null | undefined,
): ParsedScore | null {
  if (!score || setsWinner == null || setsLoser == null) return null;
  const tokens = score.trim().split(/\s+/);
  let setsP1 = 0;
  let setsP2 = 0;
  let gamesP1 = 0;
  let gamesP2 = 0;
  let parsed = 0;
  let lastA = 0;
  let lastB = 0;
  let firstA = -1;
  let firstB = -1;
  for (const tok of tokens) {
    // Tolère tie-break entre parenthèses « 7-6(5) » et super TB « [10-8] ».
    const m = tok.match(/^[\[(]?(\d+)-(\d+)/);
    if (!m) continue; // « RET », « W/O », « DEF »…
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    if (parsed === 0) {
      firstA = a;
      firstB = b;
    }
    parsed++;
    lastA = a;
    lastB = b;
    gamesP1 += a;
    gamesP2 += b;
    if (a > b) setsP1++;
    else if (b > a) setsP2++;
  }
  if (parsed === 0) return null;
  // Dernière set incomplète (ex. « 2-6 0-3 » = abandon) → hors échantillon.
  if (Math.max(lastA, lastB) < 6) return null;
  // Décidé.
  if (setsP1 === setsP2) return null;
  // Cohérence avec les colonnes de résultat (garde-fou formats exotiques).
  if (setsP1 !== setsWinner || setsP2 !== setsLoser) return null;
  return {
    setsP1,
    setsP2,
    gamesP1,
    gamesP2,
    setsPlayed: setsP1 + setsP2,
    firstSetP1Won: firstA > firstB,
  };
}

// ─── Genre / type de tournoi / bande ─────────────────────────────────────────

/**
 * Genre Homme/Femme : marqueurs de nom d'abord (les UTR « Women » sont
 * marqués ATP en base), fallback colonne `tour` (constante par tourney_id).
 * ⚠️ /Men/ (M majuscule) ne matche pas « Women ».
 */
export function tennisGenderOf(tourneyName: string, tour: string): "M" | "F" {
  const n = tourneyName ?? "";
  if (/Billie Jean King|Fed Cup|Women|WTA|Girls|\sW\d{2}/.test(n)) return "F";
  if (/Davis Cup|Men|ATP|Boys|\sM\d{2}/.test(n)) return "M";
  return tour === "WTA" ? "F" : "M";
}

/** Segment « Type de tournoi » (classement par marqueurs de nom). */
export function tennisTierOf(
  tourneyName: string,
  round: string | null | undefined,
): string {
  const n = tourneyName ?? "";
  const r = round ?? "";
  // Les qualifications forment leur propre segment (1xbet les distingue).
  if (/qualif/i.test(r)) return "Qualifications";
  if (/Boys|Girls|Wheelchair|Wheelchairs|Junior/i.test(n)) return "Juniors / Handisport";
  if (/Australian Open|French Open|Roland Garros|US Open|Wimbledon/i.test(n)) {
    return "Grand Chelem";
  }
  if (/Masters|WTA 1000|ATP 1000/i.test(n)) return "Masters 1000 / WTA 1000";
  if (
    ["Miami", "Cincinnati", "Indian Wells", "Monte Carlo", "Montreal", "Toronto"].includes(n)
  ) {
    return "Masters 1000 / WTA 1000";
  }
  if (/Billie Jean King|Davis Cup|Hopman|United Cup/i.test(n)) return "Coupe d'équipe";
  if (/125K|Challenger/i.test(n)) return "Challenger / 125K";
  if (/UTR/i.test(n)) return "UTR Pro Series";
  return "Tour 250/500 & ITF";
}

const SURFACE_FR: Record<string, string> = {
  Hard: "Dur",
  Clay: "Terre battue",
  Grass: "Gazon",
  Carpet: "Moquette",
};

/** Bandes de cote du favori — filtres alignés sur la moneyline 1xbet. */
export const TENNIS_BT_BANDS: ReadonlyArray<{
  key: string;
  label: string;
  min: number;
  max: number;
}> = [
  { key: "b1", label: "< 1,20", min: 1.0, max: 1.2 },
  { key: "b2", label: "1,20 – 1,49", min: 1.2, max: 1.5 },
  { key: "b3", label: "1,50 – 1,99", min: 1.5, max: 2.0 },
  { key: "b4", label: "2,00 – 2,99", min: 2.0, max: 3.0 },
  { key: "b5", label: "3,00 et +", min: 3.0, max: Infinity },
];

function bandOf(favOdds: number): { key: string; label: string } {
  for (const b of TENNIS_BT_BANDS) {
    if (favOdds >= b.min && favOdds < b.max) return { key: b.key, label: b.label };
  }
  return { key: "b5", label: "3,00 et +" };
}

// ─── Match validé ────────────────────────────────────────────────────────────

type ParsedMatch = {
  date: string;
  surface: string;
  gender: "M" | "F";
  tier: string;
  band: { key: string; label: string };
  score: ParsedScore;
  favWon: boolean;
  favOdds: number;
  dogOdds: number;
  gamesFav: number;
  gamesDog: number;
  winnerLostSets: number;
  firstSetFavWon: boolean;
};

/** Cote « valide » : borne BDS observée [1.02, 7.8] → garde large. */
function validOdds(v: number | null | undefined): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 1.01 && v <= 100;
}

/** Valide une ligne DB → match exploitable, ou null (hors échantillon). */
export function parseTennisBtRow(row: TennisBtRow): ParsedMatch | null {
  if (!validOdds(row.odds_player1) || !validOdds(row.odds_player2)) return null;
  const score = parseTennisScore(row.score, row.sets_winner, row.sets_loser);
  if (!score) return null;
  const favIsP1 = row.odds_player1 <= row.odds_player2;
  const p1won = score.setsP1 > score.setsP2;
  const winnerLostSets = p1won ? score.setsP2 : score.setsP1;
  return {
    date: new Date(Number(row.match_date)).toISOString().slice(0, 10),
    surface: SURFACE_FR[row.surface ?? ""] ?? row.surface ?? "Inconnue",
    gender: tennisGenderOf(row.tourney_name, row.tour),
    tier: tennisTierOf(row.tourney_name, row.round),
    band: bandOf(Math.min(row.odds_player1, row.odds_player2)),
    score,
    favWon: p1won === favIsP1,
    favOdds: Math.min(row.odds_player1, row.odds_player2),
    dogOdds: Math.max(row.odds_player1, row.odds_player2),
    gamesFav: favIsP1 ? score.gamesP1 : score.gamesP2,
    gamesDog: favIsP1 ? score.gamesP2 : score.gamesP1,
    winnerLostSets,
    firstSetFavWon: score.firstSetP1Won === favIsP1,
  };
}

/** Résultat d'un marché (true/false) ou null = non applicable à ce match. */
export function settleMarket(key: string, m: ParsedMatch): boolean | null {
  switch (key) {
    case "favMl":
      return m.favWon;
    case "dogMl":
      return !m.favWon;
    case "favStraight":
      return m.favWon && m.winnerLostSets === 0;
    case "firstSetFav":
      return m.firstSetFavWon;
    case "doubleFav":
      return m.firstSetFavWon && m.favWon;
    case "over2_5sets":
      return m.score.setsPlayed > 2;
    case "over215":
      return m.score.gamesP1 + m.score.gamesP2 > 21.5;
    case "under215":
      return m.score.gamesP1 + m.score.gamesP2 < 21.5;
    case "favGamesHcp":
      return m.gamesFav - m.gamesDog >= 4; // −3,5 → marge ≥ 4 jeux
    default:
      return null;
  }
}

/** Cote appliquée à un pari (réelle pour la moneyline, sinon fixe). */
export function marketOdds(key: string, m: ParsedMatch): number {
  const def = MARKET_BY_KEY.get(key);
  if (def?.oddsKind === "real") return key === "dogMl" ? m.dogOdds : m.favOdds;
  return def?.odds ?? 1.9;
}

// ─── Accumulateurs / cellules ────────────────────────────────────────────────

type Acc = {
  n: number;
  wins: number;
  staked: number;
  returned: number;
  oddsSum: number;
  /** Somme des probabilités implicites (1/cote) — évite le biais de Jensen
   *  du verdict : 1/mean(o) < mean(1/o), l'edge serait surestimé. */
  impliedSum: number;
};

const newAcc = (): Acc => ({
  n: 0,
  wins: 0,
  staked: 0,
  returned: 0,
  oddsSum: 0,
  impliedSum: 0,
});

function pushInto(accs: Record<string, Acc>, key: string, hit: boolean, odds: number): void {
  let acc = accs[key];
  if (!acc) {
    acc = newAcc();
    accs[key] = acc;
  }
  acc.n++;
  if (hit) {
    acc.wins++;
    // Mise plate 1u : seul un pari GAGNANT verse la cote (sinon le ROI
    // réduirait à avgOdds − 1, indépendant des résultats — cf. handball).
    acc.returned += odds;
  }
  acc.staked += 1;
  acc.oddsSum += odds;
  acc.impliedSum += 1 / odds;
}

function cellOf(acc: Acc | undefined): TennisBtCell | null {
  if (!acc || acc.n === 0) return null;
  const hit = acc.wins / acc.n;
  const avgOdds = acc.oddsSum / acc.n;
  const roi = ((acc.returned - acc.staked) / acc.staked) * 100;
  const sampleOk = acc.n >= MIN_SAMPLE;
  // Cote implicite MOYENNE des paris (pas 1/cote moyenne — cf. impliedSum) :
  // sur la moneyline à cotes variables, le verdict colle alors au ROI.
  const edge = hit - acc.impliedSum / acc.n;
  const verdict: TennisBtVerdict = !sampleOk
    ? "low"
    : edge >= GOOD_EDGE
      ? "good"
      : edge >= OK_EDGE
        ? "ok"
        : "bad";
  return { n: acc.n, wins: acc.wins, hit, avgOdds, roi, sampleOk, verdict };
}

type SegBucket = { label: string; nMatches: number; accs: Record<string, Acc> };
type DimMap = Map<string, SegBucket>;

function getSeg(map: DimMap, key: string, label: string): SegBucket {
  let seg = map.get(key);
  if (!seg) {
    seg = { label, nMatches: 0, accs: {} };
    map.set(key, seg);
  }
  return seg;
}

// ─── Compute ─────────────────────────────────────────────────────────────────

const DIM_LABELS: Record<TennisBtDimKey, string> = {
  surface: "Surface",
  gender: "Hommes / Femmes",
  tier: "Type de tournoi",
  band: "Bande de cote 1xbet (favori)",
};

/** Ordre d'affichage des segments « type de tournoi ». */
const TIER_ORDER = [
  "Grand Chelem",
  "Masters 1000 / WTA 1000",
  "Tour 250/500 & ITF",
  "Challenger / 125K",
  "UTR Pro Series",
  "Qualifications",
  "Coupe d'équipe",
  "Juniors / Handisport",
];

function sortSegments(key: TennisBtDimKey, segs: TennisBtSegment[]): TennisBtSegment[] {
  if (key === "tier") {
    const rank = (t: string) => {
      const i = TIER_ORDER.indexOf(t);
      return i === -1 ? TIER_ORDER.length : i;
    };
    return segs.sort((a, b) => rank(a.label) - rank(b.label) || b.nMatches - a.nMatches);
  }
  // Du plus peuplé au moins peuplé (stable pour le rendu).
  return segs.sort((a, b) => b.nMatches - a.nMatches);
}

const METHODOLOGY =
  "Backtest sur tennis_matches_internal (pariscore.db) : matchs COMPLETS uniquement " +
  "(abandons, WO et formats inconnus exclus), cotes moneyline réelles pré-match " +
  "(source BSD, proxy 1xbet) pour favori/outsider ; marchés dérivés réglés à des " +
  "cotes moyennes 1xbet simulées (2-0 @1,65 · 1er set favori @1,45 · double @1,35 · " +
  ">2,5 sets @2,00 · O/U 21,5 jeux @1,90 · HC jeux −3,5 @1,87) — ROI indicatif. " +
  "Mise plate 1u ; sélection sans variable post-match (anti-lookahead). " +
  "Verdict : n ≥ 30 et écart hit − cote implicite moyenne ≥ +5 pts = fiable, ≥ −3 pts = " +
  "dans la norme, sinon sous le seuil ; échantillon < 30 = bruit. Bandes de cote = " +
  "filtres alignés sur la moneyline 1xbet (<1,20 · 1,20-1,49 · 1,50-1,99 ; les bandes " +
  "≥2,00 existent dans le modèle mais aucun favori n'y est coté dans la base actuelle, " +
  "segments < 20 matchs masqués).";

/**
 * Calcule la matrice backtest sur des lignes DB déjà chargées.
 * Pure : aucun accès base/disk — testable sur données synthétiques.
 */
export function computeTennisBacktestMatrix(
  rows: readonly TennisBtRow[],
  win: TennisBtWindow = "full",
): TennisBtResult {
  let source: readonly TennisBtRow[] = rows;
  if (win === "d30") {
    const cutoff = Date.now() - 30 * 86_400_000;
    source = rows.filter((r) => Number(r.match_date) >= cutoff);
  }

  const globalAccs: Record<string, Acc> = {};
  const dims: Record<TennisBtDimKey, DimMap> = {
    surface: new Map(),
    gender: new Map(),
    tier: new Map(),
    band: new Map(),
  };

  let nValid = 0;
  let minDate: string | null = null;
  let maxDate: string | null = null;

  for (const row of source) {
    const m = parseTennisBtRow(row);
    if (!m) continue;
    nValid++;
    if (!minDate || m.date < minDate) minDate = m.date;
    if (!maxDate || m.date > maxDate) maxDate = m.date;

    const segs: ReadonlyArray<readonly [TennisBtDimKey, string, string]> = [
      ["surface", m.surface, m.surface],
      ["gender", m.gender, m.gender === "M" ? "Hommes" : "Femmes"],
      ["tier", m.tier, m.tier],
      ["band", m.band.key, m.band.label],
    ];
    for (const [dim, segKey, segLabel] of segs) getSeg(dims[dim], segKey, segLabel).nMatches++;

    for (const def of TENNIS_BT_MARKETS) {
      const hit = settleMarket(def.key, m);
      if (hit === null) continue;
      const odds = marketOdds(def.key, m);
      pushInto(globalAccs, def.key, hit, odds);
      for (const [dim, segKey, segLabel] of segs) {
        pushInto(getSeg(dims[dim], segKey, segLabel).accs, def.key, hit, odds);
      }
    }
  }

  const markets = TENNIS_BT_MARKETS.map((mk) => ({ ...mk }));
  const global: Record<string, TennisBtCell> = {};
  for (const def of markets) {
    const cell = cellOf(globalAccs[def.key]);
    if (cell) global[def.key] = cell;
  }

  const dimensions: TennisBtDimension[] = (Object.keys(DIM_LABELS) as TennisBtDimKey[]).map(
    (dimKey) => {
      const map = dims[dimKey];
      const segments: TennisBtSegment[] = [];
      for (const [segKey, bucket] of map) {
        if (bucket.nMatches < MIN_SEGMENT_MATCHS) continue;
        const cells: Record<string, TennisBtCell> = {};
        for (const def of markets) {
          const cell = cellOf(bucket.accs[def.key]);
          if (cell) cells[def.key] = cell;
        }
        segments.push({
          key: segKey,
          label: bucket.label,
          nMatches: bucket.nMatches,
          cells,
        });
      }
      return { key: dimKey, label: DIM_LABELS[dimKey], segments: sortSegments(dimKey, segments) };
    },
  );

  return {
    window: win,
    from: minDate,
    to: maxDate,
    nRows: source.length,
    nValid,
    markets,
    global,
    dimensions,
    thresholds: { minSample: MIN_SAMPLE, goodEdge: GOOD_EDGE, okEdge: OK_EDGE },
    methodology: METHODOLOGY,
    simulatedOdds: true,
    source: "tennis_matches_internal",
    computedAt: new Date().toISOString(),
  };
}

// ─── Loader DB ───────────────────────────────────────────────────────────────

type BsdStmt = { all: (...params: unknown[]) => unknown[] };
type Bsd = { prepare: (sql: string) => BsdStmt; close: () => void };

/**
 * Charge les lignes utiles depuis `tennis_matches_internal` (lecture seule).
 * Double driver comme `handball-history-db.ts` : **bun:sqlite en priorité**
 * (runtime de prod — better-sqlite3 est REFUSÉ par Bun : « not yet supported »),
 * better-sqlite3 en repli (node). Défensif : base absente/illisible → []
 * (l'API répond indisponible, l'UI dégrade en état vide). Le filtre 30 jours
 * est appliqué par `computeTennisBacktestMatrix` (une seule branche SQL).
 */
export function loadTennisBtRows(): TennisBtRow[] {
  const dbFile = process.env.DATABASE_PATH || path.join(process.cwd(), "pariscore.db");
  let db: Bsd;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Database } = require("bun:sqlite") as {
      Database: new (file: string, opts?: object) => Bsd;
    };
    db = new Database(dbFile, { readonly: true, create: false });
  } catch {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Database = require("better-sqlite3") as unknown as {
        new (file: string, opts?: { readonly?: boolean; fileMustExist?: boolean }): Bsd;
      };
      db = new Database(dbFile, { readonly: true, fileMustExist: true });
    } catch (err) {
      console.warn(
        `[tennis-backtest] ${dbFile} non lisible — backtest indisponible. ` +
          `Détail: ${(err as Error).message}`,
      );
      return [];
    }
  }
  try {
    const base =
      "SELECT match_date, tourney_name, tour, surface, round, score, " +
      "sets_winner, sets_loser, odds_player1, odds_player2 " +
      "FROM tennis_matches_internal " +
      "WHERE odds_player1 IS NOT NULL AND odds_player2 IS NOT NULL";
    return db.prepare(`${base} ORDER BY match_date`).all() as TennisBtRow[];
  } catch (err) {
    console.warn(
      `[tennis-backtest] lecture tennis_matches_internal échouée — backtest indisponible. ` +
        `Détail: ${(err as Error).message}`,
    );
    return [];
  } finally {
    db.close();
  }
}
