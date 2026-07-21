"use client";

import { useMemo } from "react";
import type { TennisMatch } from "@/lib/tennis-data";
import { resolveTournamentPriority } from "@/lib/tournament-priority";
import { resolveRoundPriority } from "@/lib/round-priority";

/**
 * Keys for the prematch filter bar.
 */
export type FilterKey = "all" | "favorites" | "balanced" | "starred";

/** Sort options for the prematch match list. */
export type SortKey = "default" | "rank_asc" | "rank_desc" | "elo_asc" | "elo_desc";

/** Internal accumulator attached to every match. */
interface MatchWithEdge {
  match: TennisMatch;
  /** Highest edge (probA − impliedProbA) across all bookmakers. */
  edge: number;
}

/* ──────────────────────────────────────────
 *  Filter predicates with NaN/undefined guard
 * ────────────────────────────────────────── */

/** "Favoris clairs" — the model considers player A a solid favourite. */
const IS_CLEAR_FAVOURITE = (m: TennisMatch) => (m.probA ?? 50) >= 70;

/** "Matchs serrés" — very balanced contest. */
const IS_BALANCED = (m: TennisMatch) => (m.probA ?? 50) < 60;

/* ──────────────────────────────────────────
 *  Public hook
 * ────────────────────────────────────────── */

/**
 * Reactive filter + sorting for the prematch match list.
 *
 * Returns:
 *  - `filtered` — match objects in display order
 *  - `valueBetCount` — matches where at least one bookmaker offers
 *    odds implying a probability 3+ points below the model's probA
 */
/**
 * Helper: best available rank for a match (lower = better).
 * Uses player A's rank as the primary indicator.
 *
 * Synthetic cards carry rank=0 (placeholder, not null). The `??` operator
 * would treat 0 as valid, polluting rank_asc sort with synthetic cards placed
 * ahead of real ATP/WTA #1. We exclude synthetic cards explicitly and treat
 * rank=0/null/undefined as missing.
 */
function matchRank(m: TennisMatch): number {
  // Synthetic cards have rank=0 placeholder — exclude them from rank sort by pushing to end
  if (m.synthetic) return 999;
  const r = m.playerA.rank || m.playerB.rank; // || catches 0, null, undefined
  return r && r > 0 ? r : 999;
}

/**
 * Helper: average Elo of both players (higher = stronger match).
 *
 * Synthetic cards push to end (Elo is a placeholder) to avoid polluting
 * elo_asc/elo_desc sort.
 */
function matchAvgElo(m: TennisMatch): number {
  if (m.synthetic) return 0; // push to end
  return ((m.playerA.elo ?? 1500) + (m.playerB.elo ?? 1500)) / 2;
}

/**
 * Helper (R5 hotfix) : priorité de tournoi pour le tri par prestige.
 *
 * Inférieur = trié en premier. Règles :
 *   - Si `tournamentPriority` est déjà peuplé (BSD/Odds), on l'utilise.
 *   - Sinon (mocks, anciennes data), on résout à la volée depuis le nom.
 *   - Les cartes LIVE synthétiques (`tournament === "Live"`) reçoivent une
 *     priorité haute (1, équivalente ATP Finals) : l'utilisateur veut voir
 *     en premier les matchs en cours, peu importe le tournoi réel.
 */
function matchTournamentPriority(m: TennisMatch): number {
  if (m.tournamentPriority != null) return m.tournamentPriority;
  if (m.tournament === "Live") return 1; // LIVE synthétique = haute priorité
  return resolveTournamentPriority(m.tournament);
}

/**
 * Helpers R8 curation — métriques de qualité de match.
 *
 * Le tri "relevance" (nouveau default) combine :
 *   1. Tournament priority ASC (GS=0, ITF=10)
 *   2. max(Elo Surface P1, Elo Surface P2) DESC — le "meilleur" joueur
 *      sur la surface remonte (utilise dbEloSurface si présent, sinon elo global)
 *   3. max(SPS P1, SPS P2) DESC
 *   4. Round priority ASC (Finale=0, Qualif=7)
 *
 * Fallbacks défensifs :
 *   - surfaceElo absent → elo global (1500 si synthetic)
 *   - SPS absent → -1 (poussé en fin au sein du même tier)
 *   - Synthetic → valeurs basses (poussé en fin)
 */

/** Surface Elo d'un joueur (dbEloSurface > elo global > 1500 synthetic). */
function playerSurfaceElo(
  elo: number,
  dbEloSurface: number | null | undefined,
  isSynthetic: boolean | undefined,
): number {
  if (isSynthetic) return 0;
  return dbEloSurface ?? elo ?? 1500;
}

/** SPS d'un joueur (null/absent → -1). */
function playerSps(
  sps: number | null | undefined,
  isSynthetic: boolean | undefined,
): number {
  if (isSynthetic) return -1;
  return sps ?? -1;
}

/** Score combiné (Elo Surface + SPS normalisé) d'un joueur individuel.
 * Utilisé pour identifier le "meilleur joueur" du match (P1 ou P2). */
function playerQualityScore(
  elo: number,
  dbEloSurface: number | null | undefined,
  sps: number | null | undefined,
  isSynthetic: boolean | undefined,
): number {
  const surfaceElo = playerSurfaceElo(elo, dbEloSurface, isSynthetic);
  const spsVal = playerSps(sps, isSynthetic);
  // Elo ~1500-2500, SPS ~50-95. On normalise pour que les 2 contribuent.
  // Elo/100 = 15-25, SPS/10 = 5-9.5. Total ~20-34.
  return surfaceElo / 100 + Math.max(0, spsVal) / 10;
}

/** max((Elo Surface + SPS) P1, (Elo Surface + SPS) P2) — le meilleur joueur.
 * R8 review : aligné avec le brief 'max(Elo+SPS) de P1 ou P2'. Avant on
 * prenait max(Elo) + max(SPS) indépendamment, ce qui pouvait attribuer le
 * score Elo d'un joueur et le SPS de l'autre. Maintenant le score est
 * calculé PAR joueur puis on prend le max. */
function matchQualityScore(m: TennisMatch): number {
  return Math.max(
    playerQualityScore(m.playerA.elo, m.playerA.dbEloSurface, m.playerA.sps, m.synthetic),
    playerQualityScore(m.playerB.elo, m.playerB.dbEloSurface, m.playerB.sps, m.synthetic),
  );
}

/** Round priority (Finale=0, Qualif=7, défaut=8). */
function matchRoundPriority(m: TennisMatch): number {
  return resolveRoundPriority(m.round);
}

export function useMatchFilter(
  matches: TennisMatch[],
  filter: FilterKey,
  favorites: Set<string>,
  sortKey: SortKey = "default",
): { filtered: TennisMatch[]; valueBetCount: number } {
  return useMemo(() => {
    /* 1. Attach edge to every match ─────────────────── */
    const withEdge: MatchWithEdge[] = matches.map((m) => {
      let maxEdge = 0;
      if (m.allOdds) {
        for (const o of m.allOdds) {
          const edge = (m.probA ?? 0) - o.impliedProbA;
          if (edge > maxEdge) maxEdge = edge;
        }
      }
      return { match: m, edge: maxEdge };
    });

    /* 2. Dev-only diagnostics ───────────────────────── */
    if (process.env.NODE_ENV !== "production") {
      const suspicious = withEdge.filter(
        ({ match }) => match.probA == null || Number.isNaN(match.probA),
      );
      if (suspicious.length > 0) {
        console.warn(
          `[useMatchFilter] ${suspicious.length} match(es) with undefined/NaN probA — ` +
            "filter result may be incomplete.",
          suspicious.map(
            ({ match }) =>
              `${match.id}: ${match.playerA.name} vs ${match.playerB.name}`,
          ),
        );
      }
    }

    /* 3. Compute valueBetCount before filtering ──────── */
    const valueBetCount = withEdge.filter(({ edge }) => edge >= 3).length;

    /* 4. Apply active filter ────────────────────────── */
    let result = withEdge;

    if (filter === "favorites") {
      result = result.filter(({ match }) => IS_CLEAR_FAVOURITE(match));
    } else if (filter === "balanced") {
      result = result.filter(({ match }) => IS_BALANCED(match));
    } else if (filter === "starred") {
      result = result.filter(({ match }) => favorites.has(match.id));
    }

    /* 5. Sort ────────────────────────────────────────
     * R8 curation (2026-07-22) : le tri "default" devient "relevance" =
     * tous les matchs du jour classés par :
     *   1. Tournament priority ASC (GS=0, Masters=2, ATP 500=3, ATP 250=4,
     *      Challenger=8, ITF=9, Autres=10)
     *   2. Au sein du même tier tournoi : max(Elo Surface + SPS de P1 ou P2)
     *      DESC — les meilleurs joueurs du tournoi remontent
     *   3. Round ASC (Finale > Demi > Quart > 8èmes > ...)
     *   4. Edge value-bet DESC (tiebreaker final)
     *
     * Décision produit : "Tu classes tous les matchs du jour par tournoi
     * et du + grand ELO+SPS de P1 ou P2 au plus petit". Les tris explicites
     * (rank_asc/elo_desc) honorent toujours leur sémantique stricte.
     */
    const filtered = result
      .sort((a, b) => {
        // Tris explicites : honorer la sémantique stricte (pas de groupement tournoi)
        switch (sortKey) {
          case "rank_asc":
            return matchRank(a.match) - matchRank(b.match);
          case "rank_desc":
            return matchRank(b.match) - matchRank(a.match);
          case "elo_asc":
            return matchAvgElo(a.match) - matchAvgElo(b.match);
          case "elo_desc":
            return matchAvgElo(b.match) - matchAvgElo(a.match);
        }

        // Tri "default" (= relevance R8) — groupement par tournoi puis qualité
        // 1. Tournament priority ASC
        const pa = matchTournamentPriority(a.match);
        const pb = matchTournamentPriority(b.match);
        if (pa !== pb) return pa - pb;

        // 2. max(Elo Surface + SPS) DESC — meilleur joueur du match
        const qa = matchQualityScore(a.match);
        const qb = matchQualityScore(b.match);
        if (qa !== qb) return qb - qa;

        // 3. Round priority ASC (Finale avant Quart avant 8èmes)
        const ra = matchRoundPriority(a.match);
        const rb = matchRoundPriority(b.match);
        if (ra !== rb) return ra - rb;

        // 4. Edge value-bet DESC (tiebreaker final)
        return b.edge - a.edge;
      })
      .map(({ match }) => match);

    return { filtered, valueBetCount };
  }, [filter, matches, favorites, sortKey]);
}
