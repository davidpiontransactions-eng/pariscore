"use client";

import { useMemo } from "react";
import type { TennisMatch } from "@/lib/tennis-data";
import { resolveTournamentPriority } from "@/lib/tournament-priority";

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
     * R5 hotfix (2026-07-21) : le critère primaire `tournamentPriority ASC`
     * (Grand Slam = 0 en premier) s'applique UNIQUEMENT au tri "default"
     * (vue principale = value-bet). Les tris explicites rank_asc/elo_asc
     * etc. honorent leur sémantique stricte — sinon un #10 ATP en ITF
     * passerait avant un #200 ATP en Grand Slam sous "rank_asc", ce qui
     * serait contre-intuitif pour l'utilisateur qui a explicitement
     * demandé ce tri. Ajustement après revue QA + Code Reviewer.
     *
     * Décision produit : "Toujours prioriser" s'applique à la vue par
     * défaut (value-bet). Pour les tris explicites, on honore l'intention.
     */
    const filtered = result
      .sort((a, b) => {
        // Critère primaire — prestige du tournoi (default seulement)
        if (sortKey === "default") {
          const pa = matchTournamentPriority(a.match);
          const pb = matchTournamentPriority(b.match);
          if (pa !== pb) return pa - pb;
        }

        // Critère secondaire (ou primaire pour les tris explicites)
        switch (sortKey) {
          case "rank_asc":
            return matchRank(a.match) - matchRank(b.match);
          case "rank_desc":
            return matchRank(b.match) - matchRank(a.match);
          case "elo_asc":
            return matchAvgElo(a.match) - matchAvgElo(b.match);
          case "elo_desc":
            return matchAvgElo(b.match) - matchAvgElo(a.match);
          default:
            // "default" — biggest edge first, then highest probA
            return b.edge - a.edge || b.match.probA - a.match.probA;
        }
      })
      .map(({ match }) => match);

    return { filtered, valueBetCount };
  }, [filter, matches, favorites, sortKey]);
}
