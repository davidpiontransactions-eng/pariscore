/**
 * basketball-entity-match.ts — matching d'entités multi-source basket.
 *
 * Alignement strict des noms d'équipes / de compétitions entre le hub Vitibet
 * (scraping HTML) et l'API BSD (sports.bzzoiro.com/basketball) — voir
 * scripts/pipeline-basketball-vitibet-bsd.ts.
 *
 * Zéro dépendance (le projet n'installe aucune lib de similarité) :
 *   - Levenshtein (distance brute + ratio 1 - d / maxLen)
 *   - Jaro-Winkler (similarité de chaînes, biais préfixe commun)
 *   - score final = max(des deux) + bonus containment (« Lega A » ⊂
 *     « Lega A Basket ») — le tout normalisé ∈ [0, 1].
 *
 * Politique : en cas de doute → `entity: null` (jamais d'entité inventée),
 * le consommateur garde `bsd_team_id: null` et le fallback initiales.
 */

// ─── Normalisation ───────────────────────────────────────────────────────────

/** Tokens génériques de clubs retirés en tête/fin (« KK Partizan » ≈ « Partizan »). */
const GENERIC_TOKENS = new Set([
  "bc", "kk", "cb", "bk", "mbk", "as", "ac", "sc", "us", "club", "team",
  "basket", "basketball", "baloncesto", "pallacanestro",
]);

/**
 * Normalisation insensible à la casse/diacritiques/ponctuation :
 * « Bàsquet Manresa » ≈ « BAXI MANRESA » → « manresa » (token BAXI reste, c'est
 * le sponsor — géré par la similarité, pas par le strip).
 */
export function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // dé-diagonalisation (à, é, ü…)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");
}

/** Tokens génériques en tête/fin retirés (si d'autres tokens restent). */
export function stripGenericTokens(normalized: string): string {
  const tokens = normalized.split(" ").filter(Boolean);
  while (tokens.length > 1 && GENERIC_TOKENS.has(tokens[0])) tokens.shift();
  while (tokens.length > 1 && GENERIC_TOKENS.has(tokens[tokens.length - 1])) tokens.pop();
  return tokens.join(" ");
}

/**
 * « United States: NBA » → « NBA » ; « Germany: BBL » → « BBL ».
 * Une seule séparation (les titres Vitibet sont « Pays: Ligue »).
 */
export function stripLeagueCountry(title: string): string {
  const m = title.match(/^\s*([^:]{2,40}):\s*(.+)$/);
  // Le préfixe n'est un pays que s'il ne contient pas d'indicateur de ligue
  // (« ABA League: ABA League » a un 2e ':'… on prend la partie la plus longue).
  if (!m) return title.trim();
  const prefix = m[1].trim();
  const suffix = m[2].trim();
  if (!suffix) return prefix;
  return suffix || prefix;
}

// ─── Levenshtein ─────────────────────────────────────────────────────────────

/** Distance d'édition classique (complexité O(len·len), strings ≤ ~100 chars). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = new Array<number>(b.length + 1);
  let curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    const tmp = prev; prev = curr; curr = tmp;
  }
  return prev[b.length];
}

// ─── Jaro-Winkler ────────────────────────────────────────────────────────────

function jaro(a: string, b: string): number {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  const matchWindow = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const aMatched = new Array<boolean>(a.length).fill(false);
  const bMatched = new Array<boolean>(b.length).fill(false);
  let matches = 0;
  for (let i = 0; i < a.length; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, b.length);
    for (let j = start; j < end; j++) {
      if (bMatched[j] || a[i] !== b[j]) continue;
      aMatched[i] = true; bMatched[j] = true; matches++;
      break;
    }
  }
  if (matches === 0) return 0;
  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < a.length; i++) {
    if (!aMatched[i]) continue;
    while (!bMatched[k]) k++;
    if (a[i] !== b[k]) transpositions++;
    k++;
  }
  const m = matches;
  return (m / a.length + m / b.length + (m - transpositions / 2) / m) / 3;
}

/** Jaro-Winkler : Jaro + boost prefixe commun (4 premiers chars, p = 0.1). */
export function jaroWinkler(a: string, b: string): number {
  const j = jaro(a, b);
  if (j < 0.7) return j; // seuil classique : pas de boost sous 0.7
  let prefix = 0;
  const max = Math.min(4, a.length, b.length);
  while (prefix < max && a[prefix] === b[prefix]) prefix++;
  return j + prefix * 0.1 * (1 - j);
}

// ─── Score combiné ───────────────────────────────────────────────────────────

/**
 * Similarité finale ∈ [0,1] entre deux libellés (déjà normalisables).
 * = max(Jaro-Winkler, ratio Levenshtein) + bonus containment (0.08) plafonné.
 */
export function similarity(rawA: string, rawB: string): number {
  const a = stripGenericTokens(normalizeName(rawA));
  const b = stripGenericTokens(normalizeName(rawB));
  if (!a || !b) return 0;
  if (a === b) return 1;
  const levRatio = 1 - levenshtein(a, b) / Math.max(a.length, b.length);
  const jw = jaroWinkler(a, b);
  let score = Math.max(levRatio, jw);
  // Containment (« lega a » ⊂ « lega a basket ») : bonus minoré pour éviter
  // les faux positifs sur tokens courts (< 4 chars).
  if ((a.length >= 4 && b.includes(a)) || (b.length >= 4 && a.includes(b))) {
    score = Math.min(1, score + 0.08);
  }
  // Couverture par tokens EXACTS : « BBL » ⊂ « Germany BBL » (token-level,
  // donc « man » ne couvre pas « manresa »). Un côté intégralement couvert →
  // plancher 0.88 (au-dessus du seuil d'acceptation 0.84).
  const aTokens = new Set(a.split(" "));
  const bTokens = new Set(b.split(" "));
  const covered = [...aTokens].filter((t) => bTokens.has(t)).length;
  const coveredRev = [...bTokens].filter((t) => aTokens.has(t)).length;
  if (a.length >= 3 && covered === aTokens.size) score = Math.max(score, 0.88);
  if (b.length >= 3 && coveredRev === bTokens.size) score = Math.max(score, 0.88);
  // Règle « ville/suffixe » : dernier token identique (≥ 4 chars) alors que le
  // reste diffère — cas sponsors réels : « Olimpia Milano » (Vitibet) vs
  // « EA7 Emporio Armani Milano » (BSD). Plancher 0.86 (> seuil 0.84) :
  // le pairing exige en plus même ligue, même date et les DEUX côtés d'accord.
  const lastA = a.slice(a.lastIndexOf(" ") + 1);
  const lastB = b.slice(b.lastIndexOf(" ") + 1);
  if (lastA === lastB && lastA.length >= 4 && a !== b) score = Math.max(score, 0.86);
  return score;
}

// ─── Meilleur candidat ───────────────────────────────────────────────────────

/**
 * Similarité dédiée aux LIGUES : uniquement égalité normalisée (1.0) ou
 * couverture complète des tokens du plus court dans le plus long (0.95).
 * Toute autre ressemblance est plafonnée à 0.5 — limite stricte :
 * « Liga A » (Argentine) ≉ « Liga ACB » (Espagne) malgré Jaro ≈ 0.95,
 * « Super League » (Russie) ≉ « Euroleague » (Jaro ≈ 0.85), « NBA » ≉ « WNBA ».
 *
 * Cas réel 2026-10-05 : le titre Vitibet « United States: NBA W » (féminin)
 * tombait sur « NBA » via la couverture de tokens ([nba] ⊂ {nba, w}) — et
 * PAS sur le vrai BSD « WNBA ». On canonalise donc le marqueur féminin en
 * suffixe « w » : « NBA W » → « wnba » (égalité parfaite avec BSD « WNBA »,
 * et plus aucune couverture sur « NBA »).
 */
function canonicalLeague(normalized: string): string {
  const tokens = normalized.split(" ").filter(Boolean);
  if (tokens.length > 1 && tokens[tokens.length - 1] === "w") {
    tokens.pop();
    tokens[0] = `w${tokens[0]}`;
    return tokens.join(" ");
  }
  return normalized;
}

export function leagueSimilarity(rawQuery: string, rawCandidate: string): number {
  const a = canonicalLeague(
    stripGenericTokens(normalizeName(stripLeagueCountry(rawQuery))),
  );
  const b = canonicalLeague(
    stripGenericTokens(normalizeName(stripLeagueCountry(rawCandidate))),
  );
  if (!a || !b) return 0;
  if (a === b) return 1;
  const at = a.split(" ");
  const bt = b.split(" ");
  const [short, long] = at.length <= bt.length ? [at, bt] : [bt, at];
  const longSet = new Set(long);
  if (short.every((t) => longSet.has(t))) return 0.95;
  return Math.min(similarity(rawQuery, rawCandidate), 0.5);
}

export type EntityCandidate<T> = {
  entity: T;
  score: number;
};

export type EntityMatch<T> = {
  /** Meilleur candidat au-dessus du seuil, sinon null (jamais inventé). */
  entity: T | null;
  score: number;
  /** Top des scores (diagnostic QA), trié décroissant. */
  ranking: EntityCandidate<T>[];
};

export type MatchOptions = {
  /** Seuil d'acceptation (défaut 0.84). */
  minScore?: number;
  /** Nombre de candidats gardés dans ranking (défaut 5). */
  rankingSize?: number;
  /** Scoreur personnalisé (défaut : similarity équipes). */
  scorer?: (query: string, candidateName: string) => number;
};

/**
 * Retourne le meilleur candidat pour `query` parmi `candidates`.
 * `toNames` peut renvoyer plusieurs libellés par candidat (name + short_name).
 */
export function matchBest<T>(
  query: string,
  candidates: T[],
  toNames: (candidate: T) => string | string[],
  opts: MatchOptions = {},
): EntityMatch<T> {
  const minScore = opts.minScore ?? 0.84;
  const rankingSize = opts.rankingSize ?? 5;
  const scorer = opts.scorer ?? similarity;
  const scored: EntityCandidate<T>[] = [];
  for (const entity of candidates) {
    const names = toNames(entity);
    const list = Array.isArray(names) ? names : [names];
    let best = 0;
    for (const name of list) {
      if (!name) continue;
      best = Math.max(best, scorer(query, name));
    }
    if (best > 0) scored.push({ entity, score: best });
  }
  scored.sort((x, y) => y.score - x.score);
  const top = scored[0];
  return {
    entity: top && top.score >= minScore ? top.entity : null,
    score: top ? top.score : 0,
    ranking: scored.slice(0, rankingSize),
  };
}
