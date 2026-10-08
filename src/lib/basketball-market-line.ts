/**
 * basketball-market-line.ts — sélection de la ligne de marché la plus liquide.
 *
 * Source : structure mesurée sur `/events/{id}/odds/` le 2026-10-08
 * (event 7504, Real Madrid — Partizan) :
 *
 *   { market_kind: "AH" | "OU" | "WINNER",
 *     market_line: -9.5 | 173.5 | null,
 *     market_period: "FT",
 *     selections: ["HOME","AWAY"]  pour AH/WINNER,
 *                 ["OVER","UNDER"] pour OU,
 *     bookmakers: [{ bookmaker, prices: { <selection>: { price, movement } } }] }
 *
 * Trois pièges constatés, d'où ces règles :
 *  1. La PREMIÈRE entrée d'un type peut porter `market_line: null` → jamais
 *     retenue, sinon la ligne affichée est une coquille.
 *  2. Les clés de prix ne sont PAS toujours HOME/AWAY : OU est OVER/UNDER.
 *     On les lit dans `market.selections`.
 *  3. Un marché peut avoir ~50 lignes. Choisir la première = choisir au
 *     hasard. On retient la ligne qui a le plus de bookmakers exploitables.
 *
 * Module PUR : aucun accès réseau, aucune base. Testable sans fixture live.
 */

export type MarketBook = {
  bookmaker?: string;
  bookmaker_slug?: string;
  prices?: Record<string, { price?: number; movement?: string | null }>;
};

export type RawMarket = {
  market_kind?: string;
  market_line?: number | null;
  market_period?: string;
  selections?: string[];
  bookmakers?: MarketBook[];
};

/** Ligne retenue, avec la mesure qui va avec. */
export type SelectedLine = {
  /** Ligne de points (AH) ou de total (OU). */
  line: number;
  /** Nombre de bookmakers exploitables (les deux prix présents et > 0). */
  books: number;
  /** Probabilité juste du premier côté (après retrait de la marge). */
  fairFirst: number;
  /** Probabilité juste du second côté. */
  fairSecond: number;
  /** Marge moyenne en % — moyenne PAR livre, pas somme sur les livres. */
  vigPct: number;
  /** Libellés des deux côtés, tels que la source les nomme. */
  firstLabel: string;
  secondLabel: string;
  /** Meilleur prix observé pour chaque côté (celui que peut capturer un parieur). */
  bestFirst: number;
  bestSecond: number;
};

/** Paires de prix exploitables d'une ligne : les deux côtés présents et > 0. */
function pairsOf(m: RawMarket): Array<[number, number]> {
  const sel = m.selections && m.selections.length === 2 ? m.selections : ["HOME", "AWAY"];
  const out: Array<[number, number]> = [];
  for (const b of m.bookmakers ?? []) {
    const p = b.prices?.[sel[0]]?.price;
    const q = b.prices?.[sel[1]]?.price;
    if (p && q && p > 0 && q > 0) out.push([p, q]);
  }
  return out;
}

/**
 * Devig proportionnel sur les prix MOYENS.
 *
 * ⚠️ Piège de la première version : sommer `1/p` sur TOUS les livres donnait
 * une marge de 1493 % (facteur N). La marge se moyenne, elle ne se somme pas.
 */
function devigMean(pairs: Array<[number, number]>): { fairA: number; fairB: number; vig: number } | null {
  if (!pairs.length) return null;
  const invA = pairs.reduce((s, p) => s + 1 / p[0], 0) / pairs.length;
  const invB = pairs.reduce((s, p) => s + 1 / p[1], 0) / pairs.length;
  const sum = invA + invB;
  if (!(sum > 0)) return null;
  return { fairA: invA / sum, fairB: invB / sum, vig: (sum - 1) * 100 };
}

/**
 * Retient la ligne la plus liquide d'un type de marché.
 *
 * Critères, dans l'ordre : période FT · `market_line` non nul · maximum de
 * bookmakers exploitables. `null` si aucune ligne n'est exploitable — on ne
 * fabrique pas de ligne de repli.
 */
export function selectLiquidLine(
  markets: RawMarket[] | undefined | null,
  kind: "AH" | "OU" | "WINNER",
): SelectedLine | null {
  if (!markets || !markets.length) return null;

  let best: SelectedLine | null = null;
  let bestBooks = 0;

  for (const m of markets) {
    if (m.market_kind !== kind) continue;
    if ((m.market_period ?? "FT") !== "FT") continue;
    if (m.market_line == null || !Number.isFinite(m.market_line)) continue;

    const pairs = pairsOf(m);
    if (pairs.length < 2) continue; // un seul livre : pas de devig fiable
    const d = devigMean(pairs);
    if (!d) continue;
    if (pairs.length <= bestBooks) continue;

    const sel = m.selections && m.selections.length === 2 ? m.selections : ["HOME", "AWAY"];
    bestBooks = pairs.length;
    best = {
      line: m.market_line,
      books: pairs.length,
      fairFirst: d.fairA,
      fairSecond: d.fairB,
      vigPct: d.vig,
      firstLabel: sel[0],
      secondLabel: sel[1],
      bestFirst: Math.max(...pairs.map((p) => p[0])),
      bestSecond: Math.max(...pairs.map((p) => p[1])),
    };
  }
  return best;
}

/** Confort d'affichage : AH → « Domicile/Extérieur », OU → « Over/Under ». */
export function lineLabels(kind: "AH" | "OU"): { first: string; second: string } {
  return kind === "OU"
    ? { first: "Over", second: "Under" }
    : { first: "Domicile", second: "Extérieur" };
}