"use client";

/**
 * SWR — cache 1xBet BSD Basketball (`/api/basketball/bsd`).
 *
 * ⚠️ PAS DE SPINNER. La donnée vient d'un cache LOCAL écrit par cron
 * (`scripts/fetch-basketball-bsd.ts`) : il n'y a rien à attendre de réseau
 * externe. Le premier rendu affiche donc soit la donnée, soit l'absence de
 * cache — les trois états sont distincts et l'UI doit pouvoir les afficher.
 *
 * `stale` est un faite du serveur (âge > `staleAfterMinutes`), pas calculé
 * côté client : l'horloge affichée doit venir d'un seul endroit.
 */

import useSWR from "swr";

import type {
  BsdBasketballPrediction,
  BsdBasketballStandingRow,
} from "@/lib/api/bzzoiro-client";
import type { CachedOdds, CachedTeam } from "@/lib/basketball-bsd-cache";

export type BsdPreMatchFixture = {
  bsdEventId: number;
  leagueBsdId: number;
  leagueName: string;
  scheduledAt: string;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  home: CachedTeam;
  away: CachedTeam;
  prediction: BsdBasketballPrediction | null;
  predictionSource: string | null;
  pregame: {
    homeStanding: BsdBasketballStandingRow | null;
    awayStanding: BsdBasketballStandingRow | null;
    last10ScoredHome: number | null;
    last10ScoredAway: number | null;
    last10TotalHome: number | null;
    last10TotalAway: number | null;
    venue: { name: string; city: string; country: string; capacity: number | null } | null;
    homeCoach: string | null;
    awayCoach: string | null;
  } | null;
  odds: CachedOdds[];
  oddsSource: string | null;
};

export type BsdCacheResponse = {
  source: string;
  fetchedAt: string;
  ageMinutes: number | null;
  staleAfterMinutes: number;
  stale: boolean;
  fixtures: BsdPreMatchFixture[];
  counts: {
    served: number;
    withPrediction: number;
    withPregame: number;
    withOdds: number;
    withHomeLogo: number;
  };
  freshnessNote: string | null;
  predictionsAvailable: boolean;
  error?: string;
  details?: string;
};

/**
 * Lecture de la route cache, avec SÉPARATION des deux échecs.
 *
 * C'est la distinction qui permet de ne pas invalider la popup :
 *
 *  (a) Notre route répond un JSON en 400/503 (cache absent, paramètre
 *      invalide) → c'est une ABSENCE SIGNALÉE. On la normalise en payload :
 *      le composant affiche « aucune donnée », pas une erreur.
 *
 *  (b) Un corps non-JSON (nginx 502, page d'erreur Next) OU une exception
 *      réseau → ce n'est PAS notre route, c'est l'infrastructure. On THROW :
 *      SWR conserve alors la dernière donnée valide (`keepPreviousData`), et le
 *      composant peut afficher ses sections + un avis non bloquant.
 *
 * ⚠️ Rétrogression corrigée : l'ancien code RETOURNAIT un objet synthétique
 * vide sur tout `!res.ok`. Résultat : un simple 502 dû au redémarrage PM2
 * écrasait une donnée par ailleurs lisible, et la popup s'affichait vide avec
 * « HTTP 502 » en rouge.
 */
const fetcher = async (url: string): Promise<BsdCacheResponse> => {
  const res = await fetch(url, { cache: "no-store" });
  const text = await res.text();

  let body: Partial<BsdCacheResponse> | null = null;
  try {
    body = JSON.parse(text) as Partial<BsdCacheResponse>;
  } catch {
    body = null;
  }

  // (b) Pas de JSON ⇒ pas notre route. On laisse SWR gérer l'erreur.
  if (!res.ok && !body) throw new Error(`HTTP ${res.status}`);

  // (a) JSON mais statut d'erreur ⇒ absence annoncée par NOTRE route.
  if (!res.ok && body) {
    return {
      source: "bsd-cache",
      fetchedAt: "",
      ageMinutes: null,
      staleAfterMinutes: 0,
      stale: true,
      fixtures: [],
      counts: { served: 0, withPrediction: 0, withPregame: 0, withOdds: 0, withHomeLogo: 0 },
      freshnessNote: body.details ?? null,
      predictionsAvailable: false,
      error: body.error ?? `HTTP ${res.status}`,
      details: body.details,
    };
  }

  if (!body) throw new Error(`réponse illisible (HTTP ${res.status})`);
  return body as BsdCacheResponse;
};

export type UseBsdCacheResult = {
  data: BsdCacheResponse | null;
  /** true SEULEMENT en premier rendu. Dès que le fetch est résolu, false —
   *  jamais de spinner après coup (le cache est local). */
  isLoading: boolean;
  error: string | null;
  /** Le cache est absent/illisible — à afficher comme état vide motivé. */
  isUnavailable: boolean;
  /** Le cache existe mais est périmé — à afficher comme avertissement. */
  isStale: boolean;
};

export function useBsdCache(): UseBsdCacheResult {
  const { data, error, isLoading } = useSWR<BsdCacheResponse>(
    "/api/basketball/bsd",
    fetcher,
    {
      // Cache local + cron : pas de rafraîchissement agressif. Le rafraîchir
      // à chaque ouverture de popup gaspillerait le cycle réseau pour rien.
      revalidateOnFocus: false,
      dedupingInterval: 60_000,
      keepPreviousData: true,
    },
  );

  const unavailable = data ? data.fixtures.length === 0 && !data.predictionsAvailable : false;

  return {
    data: data ?? null,
    isLoading,
    error: error ? (error as Error).message : (data?.error ?? null),
    isUnavailable: unavailable || (data?.predictionsAvailable === false),
    isStale: data?.stale ?? false,
  };
}

/**
 * Trouve la fixture contenant UNE équipe nommée (clic sur un nom dans le
 * calendrier).
 *
 * Le calendrier ne fournit qu'un `(team, venue, leagueId)`, pas la rencontre
 * complète : on résout depuis le cache. Ambiguïté = refus — si l'équipe apparaît
 * sur deux fixtures (deux matchs dans la fenêtre du cron), on ne choisit pas
 * au hasard, on renvoie null et le popup ne s'ouvre pas.
 */
export function findBsdFixtureByTeam(
  data: BsdCacheResponse | null,
  teamName: string | null,
): BsdPreMatchFixture | null {
  if (!data || !teamName) return null;
  const n = teamName.trim().toLowerCase();
  if (!n) return null;
  const cands = data.fixtures.filter(
    (f) => f.home.name.trim().toLowerCase() === n || f.away.name.trim().toLowerCase() === n,
  );
  return cands.length === 1 ? cands[0] : null;
}

/**
 * Retrouve la fixture correspondant à un match de calendrier.
 *
 * ⚠️ Joign par `(leagueBsdId, noms normalisés)` — pas par nom seul : « Roma »
 * existe en NBA et en EuroCup. Le nom est normalisé côté serveur ? Non :
 * on compare telle quelle + casse insensible, et `null` si ambigu.
 */
export function findBsdFixture(
  data: BsdCacheResponse | null,
  leagueBsdId: number | null,
  homeName: string | null,
  awayName: string | null,
): BsdPreMatchFixture | null {
  if (!data || !homeName || !awayName) return null;
  const norm = (s: string) => s.trim().toLowerCase();
  const h = norm(homeName);
  const a = norm(awayName);
  const cands = data.fixtures.filter((f) => {
    if (leagueBsdId !== null && f.leagueBsdId !== leagueBsdId) return false;
    const fh = norm(f.home.name);
    const fa = norm(f.away.name);
    return (fh === h && fa === a) || (fh === a && fa === h);
  });
  // Ambiguïté = refus : deux fixtures sur la même rencontre → on ne choisit
  // pas au hasard, on renvoie null.
  return cands.length === 1 ? cands[0] : null;
}
