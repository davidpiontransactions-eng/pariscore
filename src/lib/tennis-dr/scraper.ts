// Scraper TennisAbstract — colonne DR (Dominance Ratio) du tableau "Recent Results".
//
// Source : https://www.tennisabstract.com/jsfrags/{Slug}.js
// Ce fichier JS contient un template literal `var player_frag = \`...<table
// id="recent-results">...\`` pré-rendu côté serveur — pas de JS à exécuter.
//
// ⚠️  CONFORMITÉ : /jsfrags/ est **interdit** par le robots.txt de
// TennisAbstract. Ce scraper ne s'exécute QUE via le flag d'environnement
// `LEGAL_OVERRIDE_CONFIRMED=1` (CLI scripts/scrape-tennis-dr.ts), jamais en
// runtime depuis l'app Next.js. Le runtime lit uniquement le cache JSON
// (lookup.ts). Throttle conservateur (1 req / 1.5s) + retry exponentiel.
//
// Structure HTML confirmée (16 colonnes, indexes 0-based) :
//   0=Date · 1=Tournament · 2=Surface · 3=Rd · 4=Rk · 5=vRk · 6=(desc match)
//   7=Score · 8=DR · 9=A% · 10=DF% · 11=1stIn · 12=1st% · 13=2nd% · 14=BPSvd · 15=Time

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const JSFRAGS_BASE = "https://www.tennisabstract.com/jsfrags/";
const USER_AGENT =
  "Mozilla/5.0 (compatible; SetPoint-TennisBot/1.0; +https://setpoint.app)";

/** Surfaces TennisAbstract → clé DB Sackmann (Hard/Clay/Grass). */
export type DrSurface = "Hard" | "Clay" | "Grass";

/** Bucket de DR pour une surface (ou "all"). */
export type DrBucket = {
  /** DR des 5 derniers matchs (ordre chronologique DESC = plus récent d'abord). */
  drs: number[];
  /** Médiane des `drs` (null si vide). */
  median: number | null;
  /** Nombre de matchs avec DR non-null pris en compte. */
  n: number;
};

export type DrPlayerEntry = {
  name: string;
  /** DR tous-surfaces confondus (médiane des 5 derniers). */
  all: DrBucket;
  /** DR filtré par surface. */
  Hard: DrBucket;
  Clay: DrBucket;
  Grass: DrBucket;
  /** Stats de service par surface — alimentent le modèle Over/Under Games
   *  (src/lib/prediction/total-games.ts). Absent pour les joueurs sans match
   *  avec PBP sur la surface. */
  serveStats?: {
    all: ServeStatsBucket;
    Hard: ServeStatsBucket;
    Clay: ServeStatsBucket;
    Grass: ServeStatsBucket;
  };
};

export type DrCache = {
  generatedAt: string;
  lastUpdate: string;
  players: Record<string, DrPlayerEntry>;
};

// ---------------------------------------------------------------------------
// Helpers de parsing (copiés depuis tennis-elo/scraper.ts pour éviter couplage)
// ---------------------------------------------------------------------------

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
}

function extractNumeric(s: string): number {
  return parseFloat(stripHtml(s).replace(/[^0-9.\-]/g, "")) || 0;
}

/** Normalise un nom pour clé de cache (jannik_sinner). Réutilise le contrat
 *  de tennis-elo/scraper.ts:normalizeKey — on garde la même signature pour
 *  permettre une recherche croisée entre les deux caches. */
export function normalizeKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

// ---------------------------------------------------------------------------
// Slug TennisAbstract : "Jannik Sinner" → "JannikSinner"
// ---------------------------------------------------------------------------

/**
 * Construit le slug TennisAbstract à partir du nom complet.
 * Règle observée : concaténer le nom complet sans espaces, en préservant la
 * capitalisation et en stripant les accents (NFD).
 *   "Jannik Sinner"     → "JannikSinner"
 *   "Carlos Alcaraz"    → "CarlosAlcaraz"
 *   "Iga Świątek"       → "IgaSwiatek"
 *   "Alex de Minaur"    → "AlexdeMinaur"
 */
export function toAbstractSlug(fullName: string): string {
  return fullName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z]/g, "") // lettres uniquement, on garde la casse d'origine
    .trim();
}

/** URL du jsfrags pour un joueur. */
export function jsfragsUrl(slug: string): string {
  return `${JSFRAGS_BASE}${slug}.js`;
}

// ---------------------------------------------------------------------------
// Médiane
// ---------------------------------------------------------------------------

/** Médiane d'un tableau de nombres. Retourne null si vide. */
export function computeMedian(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  if (n % 2 === 1) return sorted[(n - 1) / 2];
  return (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
}

// ---------------------------------------------------------------------------
// Fetch + parse
// ---------------------------------------------------------------------------

/** Match d'une ligne du tableau "Recent Results". */
type ParsedRow = {
  date: string;
  surface: string; // "Hard" | "Clay" | "Grass" (TennisAbstract labels)
  dr: number | null; // null si cellule vide (match sans PBP)
  // Stats de service (indices 9-13 du tableau TennisAbstract) — alimentent les
  // modèles Over/Under Games + Most Aces (src/lib/prediction/). Null si absentes.
  acesPct: number | null; // % d'aces (colonne A%, idx 9) [0..100]
  dfPct: number | null; // % de double fautes (colonne DF%, idx 10) [0..100]
  firstIn: number | null; // % premières balles (1stIn, idx 11) [0..100]
  firstWon: number | null; // % points gagnés sur 1re balle (1st%, idx 12) [0..100]
  secondWon: number | null; // % points gagnés sur 2e balle (2nd%, idx 13) [0..100]
};

/**
 * Calcule le % global de points gagnés au service depuis les 3 stats de service.
 * Formule : servePtsWon% = 1st%×1stIn + 2nd%×(1−1stIn), tout en fraction [0..1].
 * Retourne null si l'une des 3 stats manque.
 */
export function computeServePtsWonPct(
  firstIn: number | null,
  firstWon: number | null,
  secondWon: number | null,
): number | null {
  if (firstIn == null || firstWon == null || secondWon == null) return null;
  // Les colonnes TennisAbstract sont en % (ex: 64.0), on convertit en fraction.
  const p1in = firstIn / 100;
  const p1won = firstWon / 100;
  const p2won = secondWon / 100;
  return p1in * p1won + (1 - p1in) * p2won;
}

/** Stats de service agrégées par surface.
 *  - servePtsWonPct/returnPtsWonPct : médiane sur les 5 derniers matchs (modèle games).
 *  - acesPct/dfPct : médiane sur les 10 derniers matchs (modèle most aces, spec). */
export type ServeStatsBucket = {
  /** Fraction de points gagnés au service [0..1], médiane 5 derniers matchs. */
  servePtsWonPct: number | null;
  /** % d'aces [0..100], médiane 10 derniers matchs surface. Alimente Most Aces. */
  acesPct: number | null;
  /** % de double fautes [0..100], médiane 10 derniers matchs surface. */
  dfPct: number | null;
  /** Nombre de matchs pris en compte (le min des 2 fenêtres). */
  n: number;
};

/**
 * Récupère le body du jsfrags. Retourne "" si 404 (joueur inconnu) ou erreur
 * réseau (l'appelant décide quoi faire).
 */
export async function fetchPlayerFrag(slug: string): Promise<string> {
  const url = jsfragsUrl(slug);
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "text/html,*/*;q=0.8" },
    redirect: "follow",
  });
  if (res.status === 404) return "";
  if (!res.ok) throw new Error(`jsfrags ${slug}: HTTP ${res.status}`);
  return res.text();
}

/**
 * Extrait le tableau "Recent Results" du template literal et retourne les
 * lignes parsées (DR null si absent). Le tableau est pré-trié chronologiquement
 * DESC par TennisAbstract (plus récent d'abord) — on préserve cet ordre.
 */
export function parseRecentResults(jsBody: string): ParsedRow[] {
  if (!jsBody) return [];

  const tableMatch = jsBody.match(
    /<table id="recent-results"[^>]*>([\s\S]*?)<\/table>/,
  );
  if (!tableMatch) return [];

  const tbody = tableMatch[1];
  const rows: ParsedRow[] = [];

  // Itère chaque <tr> (le regex non-gourdi [\s\S]*? gère le multiligne).
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRe.exec(tbody)) !== null) {
    const cells = rowMatch[1].match(/<td[^>]*>[\s\S]*?<\/td>/g);
    if (!cells || cells.length < 9) continue; // header ou ligne incomplète

    const date = stripHtml(cells[0]);
    // On n'accepte que les vraies lignes de données (date commence par un chiffre).
    if (!/^\d/.test(date)) continue;

    const surface = stripHtml(cells[2]); // "Hard" | "Clay" | "Grass"
    const drRaw = stripHtml(cells[8]); // "1.24" | "" si absent
    const dr = drRaw ? extractNumeric(cells[8]) : null;

    // Stats de service (colonnes 9-13 : A%, DF%, 1stIn, 1st%, 2nd%). Null si
    // absentes (matchs sans PBP ou colonnes vides).
    const pctOrNull = (cell: string): number | null => {
      const raw = stripHtml(cell);
      if (!raw || !/^\d/.test(raw)) return null;
      const v = extractNumeric(cell);
      return v > 0 ? v : null;
    };
    const acesPct = cells[9] ? pctOrNull(cells[9]) : null;
    const dfPct = cells[10] ? pctOrNull(cells[10]) : null;
    const firstIn = cells[11] ? pctOrNull(cells[11]) : null;
    const firstWon = cells[12] ? pctOrNull(cells[12]) : null;
    const secondWon = cells[13] ? pctOrNull(cells[13]) : null;

    rows.push({
      date,
      surface,
      dr: dr && dr > 0 ? dr : null,
      acesPct,
      dfPct,
      firstIn,
      firstWon,
      secondWon,
    });
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Agrégation par surface
// ---------------------------------------------------------------------------

/** Construit un bucket à partir des N dernières valeurs de DR. */
function buildBucket(drs: number[]): DrBucket {
  const last5 = drs.slice(0, 5); // déjà trié DESC = plus récent d'abord
  return {
    drs: last5,
    median: computeMedian(last5),
    n: last5.length,
  };
}

const EMPTY_BUCKET: DrBucket = { drs: [], median: null, n: 0 };

/**
 * Agrège les lignes parsées en buckets par surface + "all".
 * Chaque bucket contient la médiane des 5 derniers matchs de cette surface.
 */
export function aggregatePlayerDr(
  name: string,
  rows: ParsedRow[],
): DrPlayerEntry | null {
  // On ne garde que les lignes avec DR non-null (matchs avec point-by-point).
  const valid = rows.filter((r) => r.dr != null) as {
    date: string;
    surface: string;
    dr: number;
    acesPct: number | null;
    dfPct: number | null;
    firstIn: number | null;
    firstWon: number | null;
    secondWon: number | null;
  }[];

  if (valid.length === 0) return null;

  const bySurface = (s: DrSurface) =>
    valid.filter((r) => r.surface === s).map((r) => r.dr);

  // Stats de service agrégées par surface :
  //   - servePtsWonPct : médiane sur 5 derniers matchs (modèle games).
  //   - acesPct/dfPct : médiane sur 10 derniers matchs (modèle most aces, spec).
  const buildServeBucket = (subset: typeof valid): ServeStatsBucket => {
    // servePtsWonPct (fenêtre 5).
    const pcts = subset
      .map((r) => computeServePtsWonPct(r.firstIn, r.firstWon, r.secondWon))
      .filter((p): p is number => p != null)
      .slice(0, 5);
    const servePtsWonPct = pcts.length > 0 ? computeMedian(pcts) : null;

    // acesPct / dfPct (fenêtre 10, spécification Most Aces).
    const aces = subset
      .map((r) => r.acesPct)
      .filter((p): p is number => p != null)
      .slice(0, 10);
    const dfs = subset
      .map((r) => r.dfPct)
      .filter((p): p is number => p != null)
      .slice(0, 10);

    if (servePtsWonPct == null && aces.length === 0) {
      return { servePtsWonPct: null, acesPct: null, dfPct: null, n: 0 };
    }
    return {
      servePtsWonPct,
      acesPct: aces.length > 0 ? computeMedian(aces) : null,
      dfPct: dfs.length > 0 ? computeMedian(dfs) : null,
      n: Math.max(pcts.length, aces.length),
    };
  };

  const serveStats = {
    all: buildServeBucket(valid),
    Hard: buildServeBucket(valid.filter((r) => r.surface === "Hard")),
    Clay: buildServeBucket(valid.filter((r) => r.surface === "Clay")),
    Grass: buildServeBucket(valid.filter((r) => r.surface === "Grass")),
  };

  return {
    name,
    all: buildBucket(valid.map((r) => r.dr)),
    Hard: buildBucket(bySurface("Hard")),
    Clay: buildBucket(bySurface("Clay")),
    Grass: buildBucket(bySurface("Grass")),
    serveStats,
  };
}

/**
 * Pipeline complet pour un joueur : fetch + parse + aggregate.
 * Retourne null si le joueur est introuvable ou n'a aucun match avec DR.
 */
export async function scrapePlayerDr(
  fullName: string,
): Promise<{ key: string; entry: DrPlayerEntry } | null> {
  const slug = toAbstractSlug(fullName);
  if (!slug) return null;

  const body = await fetchPlayerFrag(slug);
  const rows = parseRecentResults(body);
  const entry = aggregatePlayerDr(fullName, rows);
  if (!entry) return null;

  return { key: normalizeKey(fullName), entry };
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

/** Résout le path du cache — accessible depuis scripts/ et src/. */
export function cacheFilePath(cwd?: string): string {
  return resolve(cwd ?? process.cwd(), "src/lib/tennis-dr/dr-cache.json");
}

/** Écrit le cache sur disque (atomic via writeFileSync). */
export function writeCache(cache: DrCache, cwd?: string): void {
  writeFileSync(cacheFilePath(cwd), JSON.stringify(cache, null, 2), "utf8");
}

/** Cache vide (pour initialisation ou fallback). */
export function emptyCache(): DrCache {
  const today = new Date().toISOString().slice(0, 10);
  return { generatedAt: new Date().toISOString(), lastUpdate: today, players: {} };
}
