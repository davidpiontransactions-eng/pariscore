"use client";

// Panneau 5 BETS prédictifs — se déploie au clic sur une ligne de match dans
// le widget Document PiP.
//
// Les 5 bets (live, recalculés à chaque maj SSE) :
//   #1  Vainqueur du match     ← liveProbA/liveProbB (BSD implied prob)
//   #2  Vainqueur du set actuel ← Markov set (set-prediction.ts)
//   #3  Over games match        ← predictTotalGames (total-games.ts) — recommendedBet
//   #4  Over games set actuel   ← Markov set (set-prediction.ts) — recommendedBet
//
// Pour chaque bet : barre % + highlight visuel "value" (proba ∈ [60%, 70%]).
//
// IMPORTANT : le "value bet" est heuristique (proba dans une fenêtre), PAS un
// calcul d'EV réel (qui nécessiterait comparer aux cotes 1xWin+). C'est une
// AIDE à la décision, pas un signal de trading. Affiché comme tel.

import { memo, useMemo } from "react";
import type { TennisMatch } from "@/lib/tennis-data";
import type { LiveMatchState } from "@/hooks/use-live-matches";
import {
  predictTotalGames,
  type PredictionSurface,
  type LiveGamesContext,
  type ServeStats,
} from "@/lib/prediction/total-games";
import { predictSet } from "@/lib/prediction/set-prediction";
import { cn } from "@/lib/utils";

type Props = {
  match: TennisMatch;
  liveState?: LiveMatchState;
  serveStatsA?: ServeStats | null;
  serveStatsB?: ServeStats | null;
};

const VALUE_MIN = 0.6;
const VALUE_MAX = 0.7;

/** Mappe surface UI (FR) → surface modèle (cf. predictive-bets.ts:43). */
function toModelSurface(s: string): PredictionSurface {
  if (s === "Gazon") return "Grass";
  if (s === "Terre battue") return "Clay";
  return "Hard";
}

/** Build le contexte live pour le recalcul de λ match (cf. predictive-bets.ts:51). */
function buildLiveContext(state: LiveMatchState): LiveGamesContext {
  const completedSetsGames =
    state.scoreA.sets.reduce((a, b) => a + b, 0) +
    state.scoreB.sets.reduce((a, b) => a + b, 0);
  const currentSetGames = state.scoreA.games + state.scoreB.games;
  return {
    gamesPlayed: completedSetsGames + currentSetGames,
    setsWon: [state.scoreA.sets.length, state.scoreB.sets.length],
    currentSetGames: [state.scoreA.games, state.scoreB.games],
  };
}

/** Badge "value bet" : ✅ si la proba est dans la fenêtre value. */
function ValueBadge({ prob, show }: { prob: number; show: boolean }) {
  if (!show) return null;
  // prob ∈ [0, 100] ; value window = [60, 70].
  const isValue = prob >= VALUE_MIN * 100 && prob <= VALUE_MAX * 100;
  if (!isValue) return null;
  return <span className="text-emerald-400 text-[10px] font-bold">✅ value</span>;
}

/** Barre horizontale compacte pour une proba binaire (P1 vs P2). */
function DualBar({
  probA,
  probB,
  colorA = "#22c55e",
  colorB = "#3b82f6",
}: {
  probA: number;
  probB: number;
  colorA?: string;
  colorB?: string;
}) {
  return (
    <div className="flex h-2.5 rounded-full overflow-hidden bg-muted/30">
      <div style={{ width: `${probA}%`, backgroundColor: colorA }} />
      <div style={{ width: `${probB}%`, backgroundColor: colorB }} />
    </div>
  );
}

/** Barre single-value (pour Over games : proba que le Over passe). */
function SingleBar({ prob, color = "#10b981" }: { prob: number; color?: string }) {
  return (
    <div className="flex h-2.5 rounded-full overflow-hidden bg-muted/30">
      <div style={{ width: `${prob}%`, backgroundColor: color }} />
    </div>
  );
}

function shortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return (parts[parts.length - 1] || fullName).toUpperCase();
}

function PipBetPanelImpl({ match, liveState, serveStatsA, serveStatsB }: Props) {
  const nameA = shortName(match.playerA.name);
  const nameB = shortName(match.playerB.name);

  // === BET #1 : Vainqueur du match (liveProbA/liveProbB de BSD) ===
  // BSD dérive ces probas des cotes en temps réel (bsd-fetcher.ts:300-311).
  const bet1 = useMemo(() => {
    if (!liveState) return { probA: match.probA, probB: match.probB };
    return { probA: liveState.liveProbA, probB: liveState.liveProbB };
  }, [liveState, match.probA, match.probB]);

  // === BET #2 + #4 : Modèle set (Markov) ===
  // Besoin de pHoldA/pHoldB. On appelle predictTotalGames pour récupérer ces
  // valeurs (et au passage le bet #3). Coût O(1), recalcul à chaque maj.
  const setAndGames = useMemo(() => {
    if (!liveState) return null;
    const surface = toModelSurface(match.stats.surface);
    const liveCtx = buildLiveContext(liveState);

    // Bet #3 : Over games match.
    const totalGames = predictTotalGames(
      serveStatsA ?? { servePtsWonPct: null, returnPtsWonPct: null },
      serveStatsB ?? { servePtsWonPct: null, returnPtsWonPct: null },
      surface,
      3, // best-of-3
      match.playerA.elo,
      match.playerB.elo,
      liveCtx,
    );

    // Bet #2 + #4 : set en cours (Markov).
    // pHold est exposé par predictTotalGames (forme fermée Barnett).
    const setPred = predictSet({
      gamesA: liveState.scoreA.games,
      gamesB: liveState.scoreB.games,
      pHoldA: totalGames.pHoldA,
      pHoldB: totalGames.pHoldB,
    });

    return { totalGames, setPred };
  }, [
    liveState?.scoreA.games,
    liveState?.scoreB.games,
    match.stats.surface,
    match.playerA.elo,
    match.playerB.elo,
    serveStatsA,
    serveStatsB,
  ]);

  // Détection du set decisif (3e set en best-of-3 = setsWonA + setsWonB === 2).
  // Au set decisif, vainqueur du set === vainqueur du match → les 2 probas
  // DOIVENT être identiques. On force donc le bet ② à utiliser les cotes BSD
  // (liveProbA/B, même source que le bet ①) au lieu du modèle Markov, sinon on
  // affiche une contradiction visible (ex: 80% match vs 66% set, impossible).
  // Sur les sets 1 et 2, le Markov reste pertinent (le match peut encore basculer).
  const isDecisiveSet = !!liveState && liveState.scoreA.sets.length + liveState.scoreB.sets.length >= 2;

  // Bet ② : source unique selon le contexte (décisif → marché, sinon → Markov).
  const bet2 = useMemo(() => {
    if (!liveState) return { probA: 50, probB: 50, source: "markov" as const };
    if (isDecisiveSet) {
      // Set decisif → synchronisé sur les cotes (cohérent avec le bet ①).
      return { probA: liveState.liveProbA, probB: liveState.liveProbB, source: "market" as const };
    }
    if (!setAndGames) return { probA: 50, probB: 50, source: "markov" as const };
    return {
      probA: setAndGames.setPred.probAWinsSet,
      probB: setAndGames.setPred.probBWinsSet,
      source: "markov" as const,
    };
  }, [liveState, isDecisiveSet, setAndGames]);

  const currentSetNumber = liveState ? liveState.currentSet + 1 : 1;

  return (
    <div className="mt-1.5 rounded-lg border border-primary/40 bg-muted/20 px-2.5 py-2">
      <div className="text-[10px] font-bold text-primary mb-2 flex items-center gap-1">
        <span>🎯</span>
        <span>BETS PRÉDICTIFS LIVE</span>
        <span className="text-muted-foreground/70 font-normal">· {nameA} vs {nameB}</span>
      </div>

      {/* BET #1 — Vainqueur du match */}
      <div className="mb-2.5">
        <div className="flex items-center justify-between text-[10px] mb-1">
          <span className="text-muted-foreground">① Vainqueur du match</span>
          <ValueBadge prob={Math.max(bet1.probA, bet1.probB)} show={!!liveState} />
        </div>
        <div className="flex items-center gap-2">
          <span className="w-[60px] truncate text-[10px] font-semibold">{nameA}</span>
          <div className="flex-1"><DualBar probA={bet1.probA} probB={bet1.probB} /></div>
          <span className="w-8 text-right font-mono tabular-nums text-[10px] text-emerald-300">{bet1.probA}%</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="w-[60px] truncate text-[10px] font-semibold">{nameB}</span>
          <div className="flex-1" />
          <span className="w-8 text-right font-mono tabular-nums text-[10px] text-blue-300">{bet1.probB}%</span>
        </div>
      </div>

      <div className="border-t border-border/30 my-2" />

      {/* BET #2 — Vainqueur du set actuel */}
      <div className="mb-2.5">
        <div className="flex items-center justify-between text-[10px] mb-1">
          <span className="text-muted-foreground">
            ② Vainqueur du set (Set {currentSetNumber})
            {/* Indicateur de source : 📊 marché (cotes BSD) au set decisif,
                🧮 modèle (Markov) aux sets 1-2. Transparence sur la divergence. */}
            {liveState && (
              <span className="ml-1 text-[8px] text-muted-foreground/50" title={bet2.source === "market" ? "Synchronisé sur les cotes du marché (set decisif = vainqueur du match)" : "Modèle Markov (Barnett-Clarke + chaîne de Markov set)"}>
                {bet2.source === "market" ? "📊 marché" : "🧮 modèle"}
              </span>
            )}
          </span>
          <ValueBadge prob={liveState ? Math.max(bet2.probA, bet2.probB) : 0} show={!!liveState} />
        </div>
        {liveState ? (
          <>
            <div className="flex items-center gap-2">
              <span className="w-[60px] truncate text-[10px] font-semibold">{nameA}</span>
              <div className="flex-1">
                <DualBar probA={bet2.probA} probB={bet2.probB} />
              </div>
              <span className="w-8 text-right font-mono tabular-nums text-[10px] text-emerald-300">
                {bet2.probA}%
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="w-[60px] truncate text-[10px] font-semibold">{nameB}</span>
              <div className="flex-1" />
              <span className="w-8 text-right font-mono tabular-nums text-[10px] text-blue-300">
                {bet2.probB}%
              </span>
            </div>
          </>
        ) : (
          <p className="text-[10px] text-muted-foreground/60 italic">En attente du live…</p>
        )}
      </div>

      <div className="border-t border-border/30 my-2" />

      {/* BET #3 — Over games match */}
      <div className="mb-2.5">
        <div className="flex items-center justify-between text-[10px] mb-1">
          <span className="text-muted-foreground">
            ③ Over games match {setAndGames?.totalGames.recommendedBet.threshold ?? "—"}
          </span>
          <ValueBadge prob={setAndGames?.totalGames.recommendedBet.prob ?? 0} show={!!setAndGames} />
        </div>
        {setAndGames ? (
          <div className="flex items-center gap-2">
            <span className="w-[60px] text-[10px] text-muted-foreground/80">Over {setAndGames.totalGames.recommendedBet.threshold}</span>
            <div className="flex-1">
              <SingleBar prob={setAndGames.totalGames.recommendedBet.prob} />
            </div>
            <span className="w-8 text-right font-mono tabular-nums text-[10px] text-amber-300">
              {setAndGames.totalGames.recommendedBet.prob}%
            </span>
          </div>
        ) : (
          <p className="text-[10px] text-muted-foreground/60 italic">En attente du live…</p>
        )}
      </div>

      <div className="border-t border-border/30 my-2" />

      {/* BET #4 — Over games set actuel */}
      <div>
        <div className="flex items-center justify-between text-[10px] mb-1">
          <span className="text-muted-foreground">
            ④ Over games set {setAndGames?.setPred.recommendedBet.threshold ?? "—"}
          </span>
          <ValueBadge prob={setAndGames?.setPred.recommendedBet.prob ?? 0} show={!!setAndGames} />
        </div>
        {setAndGames ? (
          <div className="flex items-center gap-2">
            <span className="w-[60px] text-[10px] text-muted-foreground/80">Over {setAndGames.setPred.recommendedBet.threshold}</span>
            <div className="flex-1">
              <SingleBar prob={setAndGames.setPred.recommendedBet.prob} color="#f59e0b" />
            </div>
            <span className="w-8 text-right font-mono tabular-nums text-[10px] text-amber-300">
              {setAndGames.setPred.recommendedBet.prob}%
            </span>
          </div>
        ) : (
          <p className="text-[10px] text-muted-foreground/60 italic">En attente du live…</p>
        )}
      </div>

      <div className="border-t border-border/30 mt-2 pt-1.5">
        <p className="text-[9px] text-muted-foreground/60 italic">
          ✅ value = proba ∈ [60%, 70%] · heuristique, pas un calcul d&apos;EV réel
        </p>
      </div>
    </div>
  );
}

export const PipBetPanel = memo(PipBetPanelImpl);
