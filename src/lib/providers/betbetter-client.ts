/**
 * Client Bet Better (betbetter.world) — feed modèle ouvert, $0, CC BY 4.0.
 *
 * Auth : aucune clé. API = `?format=json` sur toute page picks.
 *   - Picks        : https://betbetter.world/{path}/picks?format=json
 *   - Scores prédis: https://betbetter.world/predicted-scores/{sport}?format=json
 *
 * Licence : CC BY 4.0 — usage libre AVEC attribution obligatoire
 * ("Bet Better — https://betbetter.world"). La mention doit accompagner tout
 * affichage des données (constante BETBETTER_ATTRIBUTION ci-dessous).
 *
 * Comportement (docs + observé le 2026-10-08) : cacheable 15 min ; matchs
 * commencés exclus (feed vide hors saison = normal, pas une erreur) ; en cas
 * d'erreur de données le feed renvoie un document valide avec un champ
 * `error` (pas de 500). Picks payants : `locked: true`, selection/confidence
 * vides et nombres null. PAS de cote bookmaker dans ce feed — le cross-check
 * se fait contre NOS probabilités dévigées (devig1x2 de football-devig).
 */

const BASE = "https://betbetter.world";
const TIMEOUT_MS = 15_000;

/** Attribution obligatoire (CC BY 4.0) — à afficher près des données. */
export const BETBETTER_ATTRIBUTION = "Bet Better — https://betbetter.world";
export const BETBETTER_LICENCE = "CC BY 4.0";

/** Lignes 1X2 dévigées Pariscore (sortie de devig1x2, en %). */
export type DevigProbs1x2 = { home: number; draw: number; away: number };

// ─── Types (payload observé le 2026-10-08) ───────────────────────────────

export type BetBetterConfidence = "HIGH" | "LEAN" | "LONG-SHOT";

export type BetBetterPick = {
  game: string;
  gameTimeUtc: string;
  market: string;
  selection: string;
  line: number | null;
  winProbabilityPct?: number;
  /** Libellé source de la proba (observé : "our prediction"). */
  probabilityLabel?: string;
  modelProbabilityPct: number | null;
  fairOdds: number | null;
  confidence: BetBetterConfidence | "";
  verdict: string;
  locked: boolean;
  unlocksAtUtc: string | null;
};

export type BetBetterPicksResponse = {
  sport: string;
  type: string;
  updatedUtc?: string;
  licence?: string;
  attribution?: string;
  count: number;
  picks: BetBetterPick[];
};

export type BetBetterPredictedScore = {
  date_utc: string;
  time_utc: string;
  away_team: string;
  home_team: string;
  pred_away_score: number;
  pred_home_score: number;
  home_margin: number;
  total: number;
  home_win_prob: number;
};

export type BetBetterPredictedScoresResponse = {
  sport: string;
  source?: string;
  games: BetBetterPredictedScore[];
};

// ─── Cache 15 min (docs : "responses are cacheable for 15 minutes") ──────

type CacheEntry = { data: unknown; expiresAt: number };
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 15 * 60 * 1000;

/** Purge le cache (module-scoped, partagé entre les tests et les matchs). */
export function clearCache(): void {
  cache.clear();
}

// ─── Erreur typée ────────────────────────────────────────────────────────

export class BetBetterApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BetBetterApiError";
  }
}

// ─── Fetch interne ───────────────────────────────────────────────────────

async function bbFetch<T>(path: string, opts?: { signal?: AbortSignal }): Promise<T> {
  const url = BASE + path;
  const cached = cache.get(url);
  if (cached && Date.now() < cached.expiresAt) return cached.data as T;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: opts?.signal ?? AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw new BetBetterApiError(`Bet Better fetch failed: ${url} — ${(err as Error).message}`);
  }

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // corps non JSON : traité comme erreur HTTP
  }

  if (!res.ok) {
    throw new BetBetterApiError(`Bet Better HTTP ${res.status}: ${url}`);
  }

  // En cas d'erreur de données, le feed renvoie un document valide avec `error`.
  const errField = (body as { error?: string } | null)?.error;
  if (typeof errField === "string" && errField.length > 0) {
    throw new BetBetterApiError(`Bet Better data error: ${errField}`);
  }

  cache.set(url, { data: body, expiresAt: Date.now() + CACHE_TTL_MS });
  return body as T;
}

// ─── API publique ────────────────────────────────────────────────────────

/** Chemins soccer connus (docs) — `/soccer/{league}/picks?format=json`. */
export const SOCCER_LEAGUES = [
  "soccer/epl",
  "soccer/la-liga",
  "soccer/serie-a",
  "soccer/bundesliga",
  "soccer/ligue-1",
  "soccer/mls",
  "soccer/world-cup",
] as const;

/**
 * Picks d'un feed (ex. "soccer/epl" ou "nhl"). Retourne picks triés + count.
 * Un feed vide hors saison est normal : picks: [] sans erreur.
 */
export async function getPicksFeed(
  path: string,
  opts?: { signal?: AbortSignal },
): Promise<BetBetterPicksResponse> {
  const body = await bbFetch<{
    site?: string;
    sport?: string;
    type?: string;
    updatedUtc?: string;
    licence?: string;
    attribution?: string;
    count?: number;
    picks?: BetBetterPick[];
  }>(`/${path}/picks?format=json`, opts);

  return {
    sport: body.sport ?? path,
    type: body.type ?? "picks",
    updatedUtc: body.updatedUtc,
    licence: body.licence,
    attribution: body.attribution,
    count: body.count ?? body.picks?.length ?? 0,
    picks: body.picks ?? [],
  };
}

/**
 * Scores prédis d'un sport (`/predicted-scores/{sport}`). Les lignes sans
 * marge sont omises côté API — le parseur ne rencontre jamais de blancs.
 */
export async function getPredictedScores(
  sport: string,
  opts?: { signal?: AbortSignal },
): Promise<BetBetterPredictedScoresResponse> {
  const body = await bbFetch<{
    sport?: string;
    source?: string;
    games?: BetBetterPredictedScore[];
  }>(`/predicted-scores/${encodeURIComponent(sport)}?format=json`, opts);

  return {
    sport: body.sport ?? sport,
    source: body.source,
    games: body.games ?? [],
  };
}

// ─── Comparateur model Bet Better ← → dévig Pariscore ───────────────────

export type ModelVsMarketEdge = "value_externe" | "value_interne" | "aligne";

export type ModelVsMarketComparison = {
  modelProbabilityPct: number | null;
  marketProbabilityPct: number;
  /** modelProbabilityPct − marketProbabilityPct, en points de %. */
  edgePct: number | null;
  edge: ModelVsMarketEdge;
  pick: BetBetterPick;
};

/** Seuil (points de %) au-delà duquel un écart vaut un signalement. */
export const EDGE_THRESHOLD_PCT = 3;

function r1(v: number): number {
  return Math.round(v * 10) / 10;
}

/**
 * Compare la proba du modèle Bet Better d'un pick à NOTRE probabilité dévigée
 * du même côté ("home" | "draw" | "away"). Le mapping sélection ← → côté est
 * fait par l'appelant (match des noms flou = fiche de match). `null` sur un
 * pick payant verrouillé (modelProbabilityPct null) — jamais de valeur inventée.
 */
export function compareWithDevig(
  pick: BetBetterPick,
  devig: DevigProbs1x2,
  side: keyof DevigProbs1x2,
): ModelVsMarketComparison {
  const marketProbabilityPct = devig[side];
  const model = pick.modelProbabilityPct;
  if (model === null || !Number.isFinite(model)) {
    return {
      modelProbabilityPct: null,
      marketProbabilityPct,
      edgePct: null,
      edge: "aligne",
      pick,
    };
  }
  const edgePct = r1(model - marketProbabilityPct);
  const edge: ModelVsMarketEdge =
    edgePct >= EDGE_THRESHOLD_PCT
      ? "value_externe"
      : edgePct <= -EDGE_THRESHOLD_PCT
        ? "value_interne"
        : "aligne";
  return { modelProbabilityPct: model, marketProbabilityPct, edgePct, edge, pick };
}
