/**
 * basketball-bsd-cache.ts — lecture du cache local BSD Basketball.
 *
 * ⚠️ PRINCIPE : la route `/api/basketball/bsd` ne fait JAMAIS d'appel direct à
 * BSD. Elle ne lit que ce fichier, écrit par `scripts/fetch-basketball-bsd.ts`
 * (cron). Conséquences voulues :
 *   - le popup s'ouvre sans latence réseau externe ;
 *   - le quota BSD est consommé par le cron, pas par le nombre de clics ;
 *   - une panne BSD laisse le popup servir la dernière cache, datée.
 *
 * Cache absent ⇒ `null` (et l'API répond 503), PAS un objet vide : « pas de
 * cache » et « cache sans match » sont deux faits distincts.
 */

import fs from "node:fs";
import path from "node:path";

import type {
  BsdBasketballPrediction,
  BsdBasketballStandingRow,
} from "./api/bzzoiro-client";

/**
 * Origine d'une valeur. Permet à l'UI d'afficher la provenance sans deviner.
 * `null` = la donnée n'existe pas.
 */
export type FieldSource = "bsd" | "pariscore" | "vitibet";

/** Valeur + sa provenance. `null` ⇒ la donnée est ABSENTE, pas nulle. */
export type Sourced<T> = {
  value: T;
  source: FieldSource | null;
};

/** Équipe dans notre modèle, avec blason vérifié. */
export type CachedTeam = {
  /** id BSD — sert à construire l'URL du blason. */
  bsdId: number;
  name: string;
  shortName: string;
  countryCode: string;
  logo: {
    /** `null` si l'image n'existe pas (204) — jamais une URL cassée. */
    url: string | null;
    available: boolean;
  };
};

export type CachedOdds = {
  bookmaker: string;
  slug: string;
  oddsHome: number | null;
  oddsAway: number | null;
  /** Devig PROPRE : moyenne pondérée après retrait de la marge. */
  fairHome: number | null;
  fairAway: number | null;
  /** Marge du bookmaker en %, telle que mesurée. */
  vigPct: number | null;
  updatedAt: string | null;
};

export type CachedFixture = {
  bsdEventId: number;
  leagueBsdId: number;
  leagueName: string;
  scheduledAt: string;
  status: "scheduled" | "live" | "finished" | "postponed" | "cancelled";
  homeScore: number | null;
  awayScore: number | null;
  home: CachedTeam;
  away: CachedTeam;

  /** Prédiction BSD, FILTRÉE (prob_over_* absents). null si non publiée. */
  prediction: BsdBasketballPrediction | null;
  /** Provenance de la prédiction : `bsd` ici, `pariscore` si notre modèle. */
  predictionSource: FieldSource | null;

  /** Contexte pré-match issu de BSD. */
  pregame: {
    homeStanding: BsdBasketballStandingRow | null;
    awayStanding: BsdBasketballStandingRow | null;
    /** « Scored points average (Last 10) » → points marqués, moyenne 10. */
    last10ScoredHome: number | null;
    last10ScoredAway: number | null;
    last10TotalHome: number | null;
    last10TotalAway: number | null;
    venue: { name: string; city: string; country: string; capacity: number | null } | null;
    homeCoach: string | null;
    awayCoach: string | null;
  } | null;

  odds: CachedOdds[];
  oddsSource: FieldSource | null;
};

export type BsdCache = {
  /** ISO — sert à calculer la fraîcheur affichée dans l'UI. */
  fetchedAt: string;
  /** Durée de vie au-delà de laquelle l'UI doit signaler « cache ancienne ». */
  staleAfterMinutes: number;
  fixtures: CachedFixture[];
};

const CACHE_FILE = "basketball_bsd_cache.json";

/**
 * Candidats évalués À L'APPEL (pas à l'import) : sous pm2 le cwd du process
 * Next standalone est `.next/standalone`, dont la copie `data/` est tracée au
 * build. Même piège que `basketball-history-db` et `basketball-vitibet-data`.
 */
function cacheCandidates(): string[] {
  return [
    path.join(process.cwd(), "data", CACHE_FILE),
    path.join(process.cwd(), "..", "data", CACHE_FILE),
  ];
}

/** Age du cache en minutes, ou `null` si la date est illisible. */
export function cacheAgeMinutes(fetchedAt: string, now = Date.now()): number | null {
  const t = Date.parse(fetchedAt);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.round((now - t) / 60_000));
}

/** Le cache est-il périmé ? L'UI doit alors le dire. */
export function isCacheStale(fetchedAt: string, staleAfterMinutes: number, now = Date.now()): boolean {
  const age = cacheAgeMinutes(fetchedAt, now);
  return age === null || age > staleAfterMinutes;
}

/**
 * Devig proportionnel : `fair = 1 / (somme des cotes inverses)`.
 *
 * Forme identique à `devigMl` de `basketball-odds.ts` — on ne réinvente pas une
 * deuxième méthode de retrait de marge dans le projet. `vigPct` est la marge
 * MESURÉE, jamais supposée.
 */
export function devigTwoWay(
  oddsHome: number,
  oddsAway: number,
): { fairHome: number; fairAway: number; vigPct: number } | null {
  if (!(oddsHome > 0) || !(oddsAway > 0)) return null;
  const ih = 1 / oddsHome;
  const ia = 1 / oddsAway;
  const sum = ih + ia;
  if (!(sum > 0)) return null;
  return {
    fairHome: ih / sum,
    fairAway: ia / sum,
    vigPct: (sum - 1) * 100,
  };
}

/**
 * Lit le cache. `null` si absent ou illisible — jamais un cache vide fabriqué,
 * qui ferait croire à une journée sans match.
 */
export function loadBsdCache(): BsdCache | null {
  for (const file of cacheCandidates()) {
    let raw: string;
    try {
      // turbopackIgnore : candidats calculés à l'exécution — bead ParisScorebis-r4g8.
      if (!fs.existsSync(/*turbopackIgnore: true*/ file)) continue;
      raw = fs.readFileSync(/*turbopackIgnore: true*/ file, "utf8");
    } catch {
      continue;
    }
    try {
      const parsed = JSON.parse(raw) as BsdCache;
      if (!Array.isArray(parsed.fixtures)) continue;
      return parsed;
    } catch {
      // Fichier corrompu : on essaie le candidat suivant puis `null`.
      continue;
    }
  }
  return null;
}
