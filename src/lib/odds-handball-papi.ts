// Cotes handball OddsPapi (oddspapi.io) — enrichissement du snapshot Flashscore.
//
// Finding G6-2 : le feed Flashscore livre `"odds": []` → 2/3 bets prédictifs
// handball tournent en "prob seule". Ce module lit le snapshot secondaire
// data/odds_handball_papi.json (produit par scripts/fetch-odds-papi.js, cron
// quotidien 04:40 UTC, free tier 250 req/mois → 2 req/run) et branche ses
// cotes sur les HandballMatch de la route /api/handball/matches.
//
// Lecture readonly + cache module à TTL (pattern handball-players de G2, TTL
// 5 min aligné sur le cache route pour ne pas servir un snapshot périmé entre
// deux runs de cron). Jamais de mutation de l'input (retour = nouveaux objets).

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { normHandballName } from "./handball-logos";
import { resolveHandballDataFile } from "./handball-flashscore";
import type { HandballMatch, HandballOpeningOdds } from "./handball-data";

/** Cotes 1X2 (marché 223) ou 2 voies (221 → draw absent). */
export type OddsPapiPrice1x2 = {
  home?: number;
  draw?: number;
  away?: number;
};

/** Une ligne de totaux : côtés absents = non couverts par les books. */
export type OddsPapiTotalsLine = {
  line: number;
  over?: number;
  under?: number;
  quotes?: number;
};

/** Meilleure paire over/under (affichage) — line/over/under toujours présents. */
export type OddsPapiTotal = {
  line: number;
  over: number;
  under: number;
};

export type OddsPapiHandicap = {
  /** Ligne côté domicile (ex. -4.5 = favori domicile pose 4,5 buts). */
  line: number;
  home: number;
  away: number;
};

export type OddsPapiEvent = {
  home: string;
  away: string;
  league: string;
  kickoff: string;
  country?: string;
  fixtureId?: string;
  /** Book retenu : "consensus" (moyenne ≥2 books 223), slug unique, "pinnacle". */
  bookmaker: string;
  winner: OddsPapiPrice1x2;
  /** Meilleure paire over/under (couverture max). */
  total: OddsPapiTotal | null;
  /** Toutes lignes vues — over55/under62 se cherchent ICI (lignes fixes). */
  totals?: OddsPapiTotalsLine[];
  /** 1X2 mi-temps (marché 10208, best-effort). */
  ht?: OddsPapiPrice1x2 | null;
  handicap?: OddsPapiHandicap | null;
};

export type OddsPapiSnapshot = {
  scraped_at: string;
  source: string;
  budget?: {
    requests_used: number;
    free_tier_remaining_estimate: number;
    free_tier_limit?: number;
    free_tier_used?: number;
  };
  events: OddsPapiEvent[];
};

export type PapiOddsMatch = {
  event: OddsPapiEvent;
  /** "exact" = noms normalisés identiques ; "fuzzy" = inclusion (ex. "Stuttgart"). */
  matchConfidence: "exact" | "fuzzy";
};

// ─── Loader (cache module TTL 5 min) ─────────────────────────────────────────
const CACHE_TTL_MS = 5 * 60_000;
let _cache: { snap: OddsPapiSnapshot | null; ts: number } | undefined;

/**
 * Résout data/odds_handball_papi.json : helper resolveHandballDataFile d'abord
 * (cwd standalone .next/standalone), puis DATA_DIR (VPS), puis cwd/data.
 */
function resolveSnapshotFile(): string | null {
  const fromHelper = resolveHandballDataFile("odds_handball_papi.json");
  if (fromHelper) return fromHelper;
  try {
    const dataDir = process.env.DATA_DIR || join(process.cwd(), "data");
    const file = join(dataDir, "odds_handball_papi.json");
    return existsSync(file) ? file : null;
  } catch {
    return null;
  }
}

/** Lit le snapshot Papi. null = fichier absent/invalide (state caché, TTL 5 min). */
export function loadOddsPapiSnapshot(): OddsPapiSnapshot | null {
  const now = Date.now();
  if (_cache && now - _cache.ts < CACHE_TTL_MS) return _cache.snap;
  let snap: OddsPapiSnapshot | null = null;
  try {
    const file = resolveSnapshotFile();
    if (file) {
      const data = JSON.parse(readFileSync(file, "utf8")) as OddsPapiSnapshot;
      snap = data && Array.isArray(data.events) ? data : null;
    }
  } catch {
    snap = null;
  }
  _cache = { snap, ts: now };
  return snap;
}

/** Purge du cache (tests / hot-reload après un scrape). */
export function clearOddsPapiCache(): void {
  _cache = undefined;
}

// ─── Matching noms + kickoff ─────────────────────────────────────────────────
/** Tolérance kickoff : au-delà, refus (deux matchs homonymes ≠). */
const KICKOFF_TOLERANCE_MS = 6 * 3_600_000;
/** Garde-fou fuzzy : chaîne normalisée la plus courte ≥ 4 (anti "hc"). */
const MIN_FUZZY_LEN = 4;

/**
 * Égalité normalisée d'abord → "exact" ; sinon inclusion bidirectionnelle
 * (comme teamsMatch de handball-players : "tvbstuttgart" ⊃ "stuttgart") →
 * "fuzzy" ; sinon null.
 */
function namesMatch(papiName: string, matchName: string): "exact" | "fuzzy" | null {
  const a = normHandballName(papiName || "");
  const b = normHandballName(matchName || "");
  if (!a || !b) return null;
  if (a === b) return "exact";
  if (Math.min(a.length, b.length) < MIN_FUZZY_LEN) return null;
  if (a.includes(b) || b.includes(a)) return "fuzzy";
  return null;
}

/** Kickoffs compatibles (±6h). Signal absent des deux côtés → tolérant. */
function kickoffCompat(a: string | undefined, b: string | undefined): boolean {
  const ta = a ? Date.parse(a) : NaN;
  const tb = b ? Date.parse(b) : NaN;
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) return true;
  return Math.abs(ta - tb) <= KICKOFF_TOLERANCE_MS;
}

/**
 * Trouve l'event Papi correspondant à un HandballMatch : kickoffs ±6h puis
 * noms d'équipes normalisés (home↔home, away↔away). Retourne aussi la
 * confiance du matching. Premier hit gagnant (les events sont triés kickoff).
 */
export function findPapiOddsForMatch(
  snapshot: OddsPapiSnapshot | null | undefined,
  match: HandballMatch
): PapiOddsMatch | null {
  const events = snapshot?.events;
  if (!events || !events.length || !match?.home || !match?.away) return null;
  for (const ev of events) {
    if (!kickoffCompat(ev.kickoff, match.kickoff)) continue;
    const h = namesMatch(ev.home, match.home.name);
    if (!h) continue;
    const a = namesMatch(ev.away, match.away.name);
    if (!a) continue;
    return { event: ev, matchConfidence: h === "exact" && a === "exact" ? "exact" : "fuzzy" };
  }
  return null;
}

// ─── Mapping vers la shape HandballMatch ─────────────────────────────────────
/** Prix d'une ligne de totaux : lit `totals` (toutes lignes) puis repli `total`. */
function totalSideFor(ev: OddsPapiEvent, line: number, side: "over" | "under"): number | null {
  const fromTotals = ev.totals?.find((t) => t.line === line);
  const src = fromTotals ?? (ev.total && ev.total.line === line ? ev.total : null);
  if (!src) return null;
  const v = side === "over" ? src.over : src.under;
  return typeof v === "number" && v > 1 ? v : null;
}

/**
 * Cote du FAVORI au handicap -4.5 (shape HandballOpeningOdds.handicap) :
 * line < 0 → favori domicile (cote home) ; line > 0 → favori extérieur.
 * |line| ≠ 4.5 → null (marché non comparable à la cote d'ouverture 1xbet).
 */
function favHandicapPrice(ev: OddsPapiEvent): number | null {
  const h = ev.handicap;
  if (!h || Math.abs(Math.abs(h.line) - 4.5) > 1e-9) return null;
  const price = h.line < 0 ? h.home : h.away;
  return typeof price === "number" && price > 1 ? price : null;
}

/**
 * Applique les cotes Papi aux matchs matchés — retourne un NOUVEAU tableau,
 * input jamais muté. Règles :
 *  - uniquement les matchs `not_started` (jamais d'injection en cours/fini :
 *    ça polluerait le proxy CLV openingOdds des matchs terminés) ;
 *  - `odds` (1X2 courant) : REMPLACÉ par Papi — c'est le fix G6-2 (feed
 *    Flashscore vide) ;
 *  - `openingOdds` : COMPLÉTÉ seulement là où Flashscore n'a rien (jamais
 *    d'écrasement des vraies ouvertures 1xbet) : fav1x2 en miroir des odds
 *    (convention toHandballMatch), over55 (ligne 55.5), under62 (ligne 62.5),
 *    handicap fav -4.5. Ce sont des cotes COURANTES Papi en fallback — les
 *    matchs ainsi remplis comptent pour le CLV avec cette réserve.
 *  - btts30 non mappé : le BTTS Papi (marché 104 = "les 2 équipes marquent")
 *    n'est pas "30+ buts par équipe" → pas de mapping honnête.
 *  - snapshot absent/empty → identity (même référence retournée).
 */
export function applyPapiOdds(
  matches: HandballMatch[],
  snapshot: OddsPapiSnapshot | null | undefined
): HandballMatch[] {
  if (!snapshot || !Array.isArray(snapshot.events) || snapshot.events.length === 0) {
    return matches;
  }
  if (!matches.length) return matches;

  return matches.map((m) => {
    if (m.status !== "not_started") return m;
    const hit = findPapiOddsForMatch(snapshot, m);
    if (!hit) return m;
    const ev = hit.event;
    const w = ev.winner;
    const next: HandballMatch = { ...m };

    // 1X2 courant : remplacé par Papi dès qu'au moins home/away est couvert.
    if (w.home != null || w.away != null) {
      next.odds = {
        home: w.home ?? undefined,
        draw: w.draw ?? undefined,
        away: w.away ?? undefined,
      };
    }

    const opening: HandballOpeningOdds = { ...m.openingOdds };
    let touched = false;
    if (!opening.fav1x2 && next.odds && (next.odds.home != null || next.odds.away != null)) {
      // Miroir fav1x2 = même convention que toHandballMatch (flashscore copie odds → fav1x2)
      opening.fav1x2 = { ...next.odds };
      touched = true;
    }
    if (opening.over55 == null) {
      const over = totalSideFor(ev, 55.5, "over");
      if (over != null) {
        opening.over55 = over;
        touched = true;
      }
    }
    if (opening.under62 == null) {
      const under = totalSideFor(ev, 62.5, "under");
      if (under != null) {
        opening.under62 = under;
        touched = true;
      }
    }
    if (opening.handicap == null) {
      const hcp = favHandicapPrice(ev);
      if (hcp != null) {
        opening.handicap = hcp;
        touched = true;
      }
    }
    if (touched) next.openingOdds = opening;
    return next;
  });
}
