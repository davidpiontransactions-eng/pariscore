/**
 * Feature « valeur de marché des effectifs » (Transfermarkt) —
 * Csurilla & Csató, arXiv:2609.21674 (18/09/2026) :
 * signal ORTHOGONAL à l'Elo (capture les mercatos — l'Elo au 1er septembre y est
 * aveugle) ; gain « modest but real » en pooling (poids0.35-0.40 sur pool2 signaux ;
 * ici composant faible parmi 4 signaux + cotes déjà présentes → MV_WEIGHT = 0.10,
 * à recalibrer par RPS walk-forward).
 *
 * Source : data/football_market_values.json — scripts/scrape-football-market-values.mjs
 * (pages Transfermarkt « marktwerte » : valeur d'effectif total par club, M€).
 * Fichier absent/vide → signal indisponible = identité stricte (zéro régression).
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/** Poids du signal valeur-marché dans l'ensemble (% déplacés max = MV_WEIGHT*100 borné ±5pp). */
export const MV_WEIGHT = 0.10;

export type ClubMarketValues = {
  scraped_at?: string;
  /** club normalisé → valeur effectif en M€. */
  leagues: Record<string, Record<string, number>>;
};

let cache: ClubMarketValues | null | undefined;

/** Charge (avec cache mémoire) le JSON des valeurs d'effectif. null = indisponible. */
export function loadClubMarketValues(): ClubMarketValues | null {
  if (cache !== undefined) return cache;
  try {
    const p = join(process.cwd(), "data", "football_market_values.json");
    if (!existsSync(p)) {
      cache = null;
      return null;
    }
    cache = JSON.parse(readFileSync(p, "utf-8")) as ClubMarketValues;
    return cache;
  } catch {
    cache = null;
    return null;
  }
}

/** Test only — purge le cache mémoire. */
export function clearMarketValueCache(): void {
  cache = undefined;
}

/** Normalisation noms de clubs (accents/casse/ponctuation → clé unique ; «-» → espace). */
export function normalizeClub(name: string): string {
  return (name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Cherche la valeur M€ d'un club (scan toutes ligues, clé normalisée). */
function findClubValue(all: ClubMarketValues, team: string): number | null {
  const key = normalizeClub(team);
  if (!key) return null;
  for (const lg of Object.values(all.leagues ?? {})) {
    const direct = lg[key];
    if (typeof direct === "number" && direct > 0) return direct;
    const hit = Object.entries(lg).find(([k]) => normalizeClub(k) === key)?.[1];
    if (typeof hit === "number" && hit > 0) return hit;
  }
  return null;
}

export type MarketValueSignal = {
  /** -1..1 — positif = avantage domicile (log-ratio borné). */
  signal: number;
  available: boolean;
  homeValueM: number | null;
  awayValueM: number | null;
};

/**
 * Signal pur à partir des valeurs (M€) — testable sans IO.
 * Relatif uniquement : le papier rappelle que TM sous-estime les transferts de
 * façon hétérogène → on n'utilise jamais la valeur en absolu.
 */
export function signalFromValues(vH: number | null, vA: number | null): MarketValueSignal {
  if (vH == null || vA == null || vH <= 0 || vA <= 0) {
    return { signal: 0, available: false, homeValueM: vH, awayValueM: vA };
  }
  const raw = Math.log(vH / vA);
  // Borné ±1 (≈ ratio e:1 au-delà = saturé — différences extrêves non surestimées)
  return { signal: Math.max(-1, Math.min(1, raw)), available: true, homeValueM: vH, awayValueM: vA };
}

/** Valeur d'effectif M€ d'un club (UI popup équipe) — null si absent/indisponible. */
export function clubMarketValueM(team: string): number | null {
  const all = loadClubMarketValues();
  if (!all) return null;
  return findClubValue(all, team);
}

/** Signal valeur d'effectif pour un match (lookup JSON → signalFromValues). */
export function marketValueSignal(homeTeam: string, awayTeam: string): MarketValueSignal {
  const all = loadClubMarketValues();
  if (!all) return { signal: 0, available: false, homeValueM: null, awayValueM: null };
  return signalFromValues(findClubValue(all, homeTeam), findClubValue(all, awayTeam));
}

export type Ensemble3 = { home: number; draw: number; away: number };

/**
 * Ajuste l'ensemble (%) par le signal : déplacement borné ±5pp
 * (home += δ, away -= δ) puis renormalisation (Σ =100 conservé).
 * Signal indisponible → identité stricte.
 */
export function blendMarketValue(ens: Ensemble3, mv: MarketValueSignal): Ensemble3 {
  if (!mv.available) return ens;
  const delta = Math.max(-5, Math.min(5, mv.signal * MV_WEIGHT * 100));
  const next = { home: ens.home + delta, draw: ens.draw, away: ens.away - delta };
  const sum = next.home + next.draw + next.away;
  if (!(sum > 0)) return ens;
  return {
    home: Math.round((next.home / sum) * 10000) / 100,
    draw: Math.round((next.draw / sum) * 10000) / 100,
    away: Math.round((next.away / sum) * 10000) / 100,
  };
}
