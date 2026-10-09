"use client";

// Panneau BETS PRÉDICTIFS LIVE — se déploie au clic sur une ligne de match dans
// le widget Document PiP.
//
// Les 8 marchés (live, recalculés à chaque maj SSE) :
//   ① Vainqueur du match       ← liveProbA/liveProbB (BSD implied prob)
//   ② Vainqueur du set actuel  ← Markov set + mélange bayésien marché
//   ③ Over games match         ← predictTotalGames (total-games.ts)
//   ④ Over games set actuel    ← Markov set (set-prediction.ts)
//   ⑤ PROCHAIN JEU (Hold/Break) ← gameWinProbFromScore + gameScoreDistribution
//   ⑥ PROCHAIN BREAK SET       ← breakProb, priorisé si DR momentum ≥ +15
//   ⑦ SCORE DU JEU             ← gameScoreDistribution (0/15, 30/40, Break)
//   ⑧ TIE-BREAK SET (Oui/Non)  ← tieBreakProbability (P 6-6)
//
// Modèle : src/lib/prediction/live-markov.ts (chaîne de Markov point-level,
// mémoïsée). Ce composant ne calcule AUCUNE probabilité — il lit le moteur.
//
// IMPORTANT : le badge "value" est heuristique (proba dans une fenêtre), PAS un
// calcul d'EV réel (qui nécessiterait comparer aux cotes 1xWin+). C'est une
// AIDE à la décision, pas un signal de trading. Affiché comme tel.

import { memo, useMemo, useState } from "react";
import type { TennisMatch } from "@/lib/tennis-data";
import type { LiveMatchState } from "@/hooks/use-live-matches";
import { useTennisLiveStats, type TennisLiveStats } from "@/hooks/use-tennis-live-stats";
import { estimateServePointsWon } from "@/lib/tennis-live-metrics";
import {
  predictTotalGames,
  type PredictionSurface,
  type LiveGamesContext,
  type ServeStats,
} from "@/lib/prediction/total-games";
import { predictSet } from "@/lib/prediction/set-prediction";
import {
  breakProb,
  clampMicroBetProb,
  gameScoreDistribution,
  gameWinProbFromScore,
  matchWinProbFromSets,
  setWinProb,
  tieBreakProbability,
  type GameScoreDistribution,
  type GameScoreOutcome,
} from "@/lib/prediction/live-markov";
import { cn } from "@/lib/utils";

/**
 * Borne chaque issue de la distribution de score PUIS renormalise pour que la
 * somme reste exactement 1. Sans ça, le bornage anti-binaire (mission
 * 2026-10-09) ferait sommer à 0.97+0.97+0.03 et l'UI afficherait 197 %.
 */
function normalizeGameScore(d: GameScoreDistribution): GameScoreDistribution {
  const bounded = {
    "hold-0": clampMicroBetProb(d["hold-0"]),
    "hold-30": clampMicroBetProb(d["hold-30"]),
    break: clampMicroBetProb(d.break),
  };
  const sum = bounded["hold-0"] + bounded["hold-30"] + bounded.break;
  if (sum <= 0) return bounded;
  return {
    "hold-0": bounded["hold-0"] / sum,
    "hold-30": bounded["hold-30"] / sum,
    break: bounded.break / sum,
  };
}

type Props = {
  match: TennisMatch;
  liveState?: LiveMatchState;
  serveStatsA?: ServeStats | null;
  serveStatsB?: ServeStats | null;
  /** Momentum DR des 2 joueurs (0-100). Optionnel : sans lui, ⑥ perd sa
   *  priorisation « en nette hausse ». */
  drMomentumA?: number;
  drMomentumB?: number;
};

const VALUE_MIN = 0.6;
const VALUE_MAX = 0.7;

/** Seuil de « nette hausse » du DR momentum qui priorise le marché ⑥. */
const DR_SURGE_THRESHOLD = 15;

/** Filtre par pilules : tout / micro-bets (jeux) / match & set. */
type MarketFilter = "all" | "micro" | "match";

const FILTERS: { id: MarketFilter; label: string; icon: string }[] = [
  { id: "all", label: "Tous", icon: "🎯" },
  { id: "match", label: "Match / Set", icon: "📈" },
  { id: "micro", label: "Micro-Bets", icon: "⚡" },
];

/** Seuils de visibilité : `micro` = les 4 marchés jeu, `match` = les 4 autres. */
const MICRO_IDS = ["prochain-jeu", "prochain-break", "score-jeu", "tie-break"] as const;
const MATCH_IDS = ["vainqueur-match", "vainqueur-set", "over-match", "over-set"] as const;

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
    liveProbA: state.liveProbA,
    liveProbB: state.liveProbB,
    server: state.server,
    // Points du jeu en cours → déroulé intra-jeu (pression balle de break).
    currentPoints: [state.scoreA.points, state.scoreB.points],
  };
}

/**
 * Force de service par joueur, bornée dans une plage réaliste.
 *
 * ⚠️ `ServeStats.servePtsWonPct` est une FRACTION (0.62 = 62 %), pas un
 * pourcentage — voir `computePServe` (`clamp(f, 0.5, 0.78)` dans total-games.ts).
 * Une division par 100 donnait 0.0062, borné à 0.05 : la chaîne de Markov
 * produisait alors ~0 % et l'UI affichait « KHACHANOV 0 % / FERY 100 % »
 * alors que le serveur était en pleine forme. Aucun `/100` ici.
 *
 * Bornes [5 %, 92 %] : sous 5 % un « service » est un défaut de données, au-delà
 * de 92 % le joueur dominerait le circuit — dans les deux cas la proba de
 * break affichée n'a plus de sens et le marché ⑤ perd toute valeur.
 */
const P_SERVE_MIN = 0.05;
const P_SERVE_MAX = 0.92;

function useServePoints(
  serveStatsA: ServeStats | null | undefined,
  serveStatsB: ServeStats | null | undefined,
  liveStats: TennisLiveStats | null,
): [number, number] | null {
  return useMemo(() => {
    if (!liveStats) return null;
    const obsA = estimateServePointsWon(liveStats, "A");
    const obsB = estimateServePointsWon(liveStats, "B");
    if (obsA == null || obsB == null) return null;
    const prematchA = serveStatsA?.servePtsWonPct;
    const prematchB = serveStatsB?.servePtsWonPct;
    // Sans stat prematch, l'observé seul suffit (dégradé, pas de blocage).
    const pA = prematchA != null ? prematchA : obsA;
    const pB = prematchB != null ? prematchB : obsB;
    return [
      Math.min(P_SERVE_MAX, Math.max(P_SERVE_MIN, pA)),
      Math.min(P_SERVE_MAX, Math.max(P_SERVE_MIN, pB)),
    ];
  }, [serveStatsA, serveStatsB, liveStats]);
}

// ─── Sous-composants visuels ───────────────────────────────────────────────

/** Badge "value bet" : ✅ si la proba est dans la fenêtre value. */
function ValueBadge({ prob, show }: { prob: number; show: boolean }) {
  if (!show) return null;
  if (!(prob >= VALUE_MIN * 100 && prob <= VALUE_MAX * 100)) return null;
  return (
    <span className="rounded-full bg-gradient-to-r from-emerald-500 to-green-600 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white shadow-lg shadow-emerald-500/20">
      value
    </span>
  );
}

/**
 * Jauge de probabilité néon : dégradé émeraude→sarcelle pour le joueur A,
 * bleu pour B. `min-w-0` sur le conteneur est indispensable : sans lui une
 * ligne de jauge force la largeur du parent et crée un scroll horizontal sur
 * mobile (le bug exact du composant précédent, `w-[60px]` fixes).
 */
function NeonBar({ pct, tone }: { pct: number; tone: "a" | "b" | "amber" }) {
  const cls =
    tone === "a"
      ? "from-emerald-400 to-teal-500"
      : tone === "b"
        ? "from-blue-400 to-indigo-500"
        : "from-amber-400 to-orange-500";
  return (
    <div className="h-2.5 w-full min-w-0 overflow-hidden rounded-full bg-slate-800/80">
      <div
        className={cn("h-full rounded-full bg-gradient-to-r transition-[width] duration-500", cls)}
        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
      />
    </div>
  );
}

/** En-tête de marché : pastille numérotée, libellé, badge value à droite. */
function MarketHead({
  n,
  label,
  hint,
  valueProb,
  showValue,
}: {
  n: string;
  label: string;
  hint?: string;
  valueProb?: number;
  showValue?: boolean;
}) {
  return (
    <div className="mb-1.5 flex items-center justify-between gap-2">
      <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-slate-300">
        <span className="shrink-0 font-black text-slate-500">{n}</span>
        <span className="truncate">{label}</span>
        {hint ? (
          <span className="shrink-0 text-[10px] text-slate-500" title={hint}>
            ⓘ
          </span>
        ) : null}
      </span>
      {showValue && valueProb != null ? <ValueBadge prob={valueProb} show /> : null}
    </div>
  );
}

/** Ligne joueur : nom + jauge + %, empilée (mobile) au lieu de colonnes fixes. */
function PlayerRow({
  name,
  pct,
  tone,
  emphasis,
}: {
  name: string;
  pct: number;
  tone: "a" | "b" | "amber";
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "w-[68px] shrink-0 truncate text-xs font-semibold sm:w-[76px]",
          emphasis ? "text-white" : "text-slate-300",
        )}
      >
        {name}
      </span>
      <div className="min-w-0 flex-1">
        <NeonBar pct={pct} tone={tone} />
      </div>
      <span
        className={cn(
          "w-9 shrink-0 text-right font-mono text-xs tabular-nums",
          tone === "a" ? "text-emerald-300" : tone === "b" ? "text-blue-300" : "text-amber-300",
        )}
      >
        {Math.round(pct)}%
      </span>
    </div>
  );
}

function WaitingLine() {
  return <p className="py-1 text-xs italic text-slate-500">En attente du live…</p>;
}

/** Étiquette lisible d'une issue de score de jeu. */
const GAME_SCORE_LABEL: Record<GameScoreOutcome, string> = {
  "hold-0": "Hold 0/15",
  "hold-30": "Hold 30/40",
  break: "Break",
};

function PipBetPanelImpl({
  match,
  liveState,
  serveStatsA,
  serveStatsB,
  drMomentumA,
  drMomentumB,
}: Props) {
  const [filter, setFilter] = useState<MarketFilter>("all");
  const nameA = shortName(match.playerA.name);
  const nameB = shortName(match.playerB.name);
  // Serve observé ce match (stats BSD via SSE partagé) → blend récence.
  const { stats: liveStats } = useTennisLiveStats(liveState?.matchId ?? "");

  // === BET ① : Vainqueur du match (liveProbA/liveProbB de BSD) ===
  // BSD dérive ces probas des cotes en temps réel (bsd-fetcher.ts:300-311).
  const bet1 = useMemo(() => {
    if (!liveState) return { probA: match.probA, probB: match.probB };
    return { probA: liveState.liveProbA, probB: liveState.liveProbB };
  }, [liveState, match.probA, match.probB]);

  // === BET ② + ④ : Modèle set (Markov) ===
  const setAndGames = useMemo(() => {
    if (!liveState) return null;
    const surface = toModelSurface(match.stats?.surface ?? "Hard");
    const liveCtx: LiveGamesContext = {
      ...buildLiveContext(liveState),
      observedServeA: liveStats ? estimateServePointsWon(liveStats, "A") : null,
      observedServeB: liveStats ? estimateServePointsWon(liveStats, "B") : null,
    };

    // Bet ③ : Over games match.
    const totalGames = predictTotalGames(
      serveStatsA ?? { servePtsWonPct: null, returnPtsWonPct: null },
      serveStatsB ?? { servePtsWonPct: null, returnPtsWonPct: null },
      surface,
      3, // best-of-3
      match.playerA.elo,
      match.playerB.elo,
      liveCtx,
    );

    // Bet ② + ④ : set en cours (Markov).
    const setPred = predictSet({
      gamesA: liveState.scoreA.games,
      gamesB: liveState.scoreB.games,
      pHoldA: totalGames.pHoldA,
      pHoldB: totalGames.pHoldB,
    });

    // Bet ② RÉACTIF : `setWinProb` descend la récursion Markov sur le score de
    // jeux ET le serveur (π = hold du serveur, 1-hold adverse sinon), là où
    // `predictSet` ne connaît que les deux totaux. Sans ça, à 3-0 comme à 5-2
    // le marché affichait la même chose que le multiplicateur bayésien.
    const setWinA = setWinProb(
      totalGames.pHoldA,
      totalGames.pHoldB,
      liveState.scoreA.sets.length,
      liveState.scoreB.sets.length,
      liveState.currentSet,
      liveState.scoreA.games,
      liveState.scoreB.games,
      liveState.server
    );

    return { totalGames, setPred, setWinA };
  }, [
    liveState?.scoreA.games,
    liveState?.scoreB.games,
    liveState?.scoreA.sets.length,
    liveState?.scoreB.sets.length,
    liveState?.currentSet,
    liveState?.server,
    match.stats?.surface ?? "Hard",
    match.playerA.elo,
    match.playerB.elo,
    serveStatsA,
    serveStatsB,
    liveStats,
  ]);

  // === BET ② — Vainqueur du set : MÉLANGE BAYÉSIEN entre Markov et cotes marché. ===
  // weightMarkov = clamp((gamesA + gamesB) / 12, 0, 1) : le Markov (réactif au
  // break) domine à mesure que le set avance, les cotes (force globale)
  // dominent au début où le Markov est peu informatif.
  const bet2 = useMemo(() => {
    if (!liveState) return { probA: 50, probB: 50 };
    if (!setAndGames) return { probA: bet1.probA, probB: bet1.probB };

    const gamesA = liveState.scoreA.games;
    const gamesB = liveState.scoreB.games;
    const weightMarkov = Math.min(1, Math.max(0, (gamesA + gamesB) / 12));

    const marketA = liveState.liveProbA;
    const marketB = liveState.liveProbB;
    const markovA = setAndGames.setWinA;
    const markovB = 1 - setAndGames.setWinA;

    let blendedA = markovA * weightMarkov + marketA * (1 - weightMarkov);
    let blendedB = markovB * weightMarkov + marketB * (1 - weightMarkov);
    const total = blendedA + blendedB;
    if (total > 0) {
      blendedA = Math.round((blendedA / total) * 100);
      blendedB = 100 - blendedA;
    }
    return { probA: blendedA, probB: blendedB };
  }, [liveState, setAndGames, bet1]);

  // === BET ① RÉACTIF : Vainqueur du MATCH. ===
  //
  // `liveProbA/liveProbB` de BSD sont des cotes de marché : elles bougent, mais
  // ne KNOWLEDGE pas qu'un set est déjà gagné. `matchWinProb` (l'export
  // historique) repart TOUJOURS de dp(0,0) et ferait donc abstraction d'un
  // A mène 1-0 — d'où `matchWinProbFromSets`, qui part de l'état réel.
  //
  // Même mélange bayésien que ② : le modèle Markov domine quand on sait
  // combien de sets séparent du titre, les cotes dominent au coup d'envoi.
  const bet1Reactive = useMemo(() => {
    if (!liveState || !setAndGames) return bet1;
    const gamesA = liveState.scoreA.games;
    const gamesB = liveState.scoreB.games;
    // Le set en cours est-il fini ? Un set se conclut à 6 jeux (ou 7-6/7-5).
    const currentSetFinished = gamesA >= 6 || gamesB >= 6;

    // Sets RÉELLEMENT GAGNÉS par chaque joueur.
    //
    // ⚠️ `scoreA.sets.length` NE VAUT PAS « sets gagnés par A » : les deux
    // tableaux font la MÊME longueur (celle des sets DÉCIDÉS), l'un comme
    // l'autre. Les comparer à leur longueur donnait donc un 1-1 imaginaire
    // pour tout match à un set décidé, et le poids du marché restait à 80 %
    // alors que le favori menait le set en cours.
    //
    // Symptôme observé (Mertens vs Swiatek, set 2, Swiatek 79 % au set) :
    //   ② Vainqueur du set 2 → Swiatek 79 %      (setWinA = 0,21 pour Mertens)
    //   ① Vainqueur du match → Mertens 82 %       ← INCOHÉRENT
    //
    // `setsDetail` ne publie que des sets DÉCIDÉS (cf. live-state-builder), donc
    // gagner un set = avoir strictement plus de jeux que l'autre à l'indice i.
    const setsA = liveState.scoreA.sets.filter(
      (g, i) => g > (liveState.scoreB.sets[i] ?? 0)
    ).length;
    const setsB = liveState.scoreB.sets.filter(
      (g, i) => g > (liveState.scoreA.sets[i] ?? 0)
    ).length;
    const decidedSets = setsA + setsB;

    const winner = setsA >= 2 ? "A" : setsB >= 2 ? "B" : null;
    // 100 % uniquement si le set qui rapporte le 2e set est RÉELLEMENT fini.
    if (winner && currentSetFinished) {
      return winner === "A" ? { probA: 100, probB: 0 } : { probA: 0, probB: 100 };
    }

    const modelA = matchWinProbFromSets(setAndGames.setWinA, setsA, setsB, true);
    // Poids du modèle = part du match déjà jouée + le set en cours.
    const weightModel = Math.min(1, Math.max(0, (decidedSets + 1) / 3));
    let blendedA = modelA * weightModel + bet1.probA * (1 - weightModel);
    let blendedB = (1 - modelA) * weightModel + bet1.probB * (1 - weightModel);
    const total = blendedA + blendedB;
    if (total > 0) {
      blendedA = Math.round((blendedA / total) * 100);
      blendedB = 100 - blendedA;
    }
    // Garde-fou d'affichage : ① ne doit JAMAIS être plus catégorique que ②.
    // Un match à 100 % pendant que le set décisif est à 67 % est un bug
    // d'affichage, pas un modèle : on rabat ① sur ② dans ce cas.
    const setA = Math.round(setAndGames.setWinA * 100);
    const setB = 100 - setA;
    if (blendedA > setA) return { probA: setA, probB: setB };
    if (blendedB > setB) return { probA: setA, probB: setB };
    return { probA: blendedA, probB: blendedB };
  }, [liveState, setAndGames, bet1]);

  // Force de service par joueur — calculée ICI (niveau composant), pas dans le
  // useMemo de `micro` : un hook appelé dans un callback viole rules-of-hooks.
  const servePoints = useServePoints(serveStatsA, serveStatsB, liveStats);

  // === BETS ⑤ ⑥ ⑦ ⑧ — micro-marchés de jeu (chaîne de Markov point-level) ===
  // Les 4 marchés lisent la MÊME instance (`micro`) calculée ici : une seule
  // chaîne de probabilité, donc aucune divergence entre ⑤ ⑥ ⑦ ⑧.
  const micro = useMemo(() => {
    if (!liveState || !servePoints) return null;

    const [pServeA, pServeB] = servePoints;
    const server = liveState.server;
    const ptsA = liveState.scoreA.points;
    const ptsB = liveState.scoreB.points;

    // ⑤ P(A gagne le JEU en cours) — Markov point-level sensible au score exact.
    // Borné : tant que le jeu n'est pas archivé, jamais 0 % ni 100 % (mission
    // 2026-10-09 — l'UI affichait « KHACHANOV 100 % / FERY 0 % »).
    const pGameA = clampMicroBetProb(gameWinProbFromScore(ptsA, ptsB, server, pServeA, pServeB));
    // ⑥ P(break au prochain jeu) — le joueur AU SERVICE peut être brisé.
    const pBreakNext = clampMicroBetProb(breakProb(server === "A" ? pServeA : pServeB));
    // ⑦ distribution du score du prochain jeu de service du joueur en service.
    // On borne chaque issue PUIS on renormalise : la somme doit rester 1.
    const gameScore = normalizeGameScore(gameScoreDistribution(server, pServeA, pServeB));
    // ⑧ P(6-6) → tie-break, depuis les holds du set en cours.
    const pHoldA = setAndGames?.totalGames.pHoldA ?? pServeA ** 4;
    const pHoldB = setAndGames?.totalGames.pHoldB ?? pServeB ** 4;
    const pTieBreak = clampMicroBetProb(tieBreakProbability(pHoldA, pHoldB));

    return {
      pGameA,
      pGameB: 1 - pGameA,
      pBreakNext,
      gameScore,
      pTieBreak,
      serverIsA: server === "A",
      // Priorisation ⑥ : un des deux est en « nette hausse » de DR momentum.
      surgeA: (drMomentumA ?? 0) >= DR_SURGE_THRESHOLD,
      surgeB: (drMomentumB ?? 0) >= DR_SURGE_THRESHOLD,
    };
  }, [liveState, servePoints, drMomentumA, drMomentumB, setAndGames]);

  const currentSetNumber = liveState ? liveState.currentSet + 1 : 1;
  const show = (id: (typeof MICRO_IDS)[number] | (typeof MATCH_IDS)[number]) =>
    filter === "all" || (filter === "micro" ? (MICRO_IDS as readonly string[]).includes(id) : (MATCH_IDS as readonly string[]).includes(id));

  return (
    <div
      className="mt-1.5 w-full min-w-0 rounded-3xl border border-slate-800/80 bg-slate-900/80 p-2 shadow-2xl backdrop-blur-xl"
      data-testid="pip-bet-panel"
    >
      {/* En-tête + filtre par pilules tactiles */}
      <div className="mb-2 flex min-w-0 flex-wrap items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1 text-xs font-bold text-emerald-300">
          <span aria-hidden>🎯</span>
          <span className="truncate">BETS PRÉDICTIFS LIVE</span>
          <span className="truncate font-normal text-slate-500">· {nameA} vs {nameB}</span>
        </span>
        <div
          role="group"
          aria-label="Filtre de marchés"
          className="-mx-1 flex shrink-0 gap-1 overflow-x-auto px-1 scrollbar-none"
        >
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              aria-pressed={filter === f.id}
              className={cn(
                "min-h-[36px] shrink-0 rounded-full px-3 py-2 text-xs font-semibold transition-colors",
                filter === f.id
                  ? "bg-emerald-500/90 text-white shadow-lg shadow-emerald-500/20"
                  : "bg-slate-800/70 text-slate-400 hover:text-slate-200",
              )}
            >
              <span aria-hidden className="mr-1">
                {f.icon}
              </span>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Carte 1 : Vainqueur Match & Set ───────────────────────────────── */}
      <div className="mb-2.5 min-w-0 rounded-2xl border border-white/5 bg-slate-950/40 p-3.5">
        {show("vainqueur-match") && (
          <div className="mb-3">
            <MarketHead
              n="①"
              label="Vainqueur du match"
              valueProb={Math.max(bet1Reactive.probA, bet1Reactive.probB)}
              showValue={!!liveState}
            />
            <PlayerRow name={nameA} pct={bet1Reactive.probA} tone="a" />
            <div className="mt-1">
              <PlayerRow name={nameB} pct={bet1Reactive.probB} tone="b" />
            </div>
          </div>
        )}

        {show("vainqueur-set") && (
          <div>
            <MarketHead
              n="②"
              label={`Vainqueur du set (Set ${currentSetNumber})`}
              hint="Mélange pondéré : Markov (réactif au score live) + cotes marché. Le poids du Markov augmente avec l'avancement du set."
              valueProb={liveState ? Math.max(bet2.probA, bet2.probB) : 0}
              showValue={!!liveState}
            />
            {liveState ? (
              <>
                <PlayerRow name={nameA} pct={bet2.probA} tone="a" emphasis />
                <div className="mt-1">
                  <PlayerRow name={nameB} pct={bet2.probB} tone="b" emphasis />
                </div>
              </>
            ) : (
              <WaitingLine />
            )}
          </div>
        )}
      </div>

      {/* ── Carte 2 : Prochain Jeu (Hold vs Break) ───────────────────────── */}
      <div className="mb-2.5 min-w-0 rounded-2xl border border-white/5 bg-slate-950/40 p-3.5">
        {show("prochain-jeu") && (
          <div className="mb-3">
            <MarketHead
              n="⑤"
              label={`Prochain jeu (${micro ? (micro.serverIsA ? nameA : nameB) : "—"} au service)`}
              hint="Chaîne de Markov point-level : P(gagner le jeu) depuis le score de points EXACT, pondérée par la force de service observée ce match."
              valueProb={micro ? Math.max(micro.pGameA, micro.pGameB) * 100 : 0}
              showValue={!!micro}
            />
            {micro ? (
              <>
                <PlayerRow name={nameA} pct={micro.pGameA * 100} tone="a" />
                <div className="mt-1">
                  <PlayerRow name={nameB} pct={micro.pGameB * 100} tone="b" />
                </div>
                <p className="mt-1.5 text-[10px] text-slate-500">
                  {micro.serverIsA ? `${nameA} sert` : `${nameB} sert`}
                </p>
              </>
            ) : (
              <WaitingLine />
            )}
          </div>
        )}

        {show("prochain-break") && (
          <div>
            <MarketHead
              n="⑥"
              label="Prochain break (set)"
              hint={
                micro?.surgeA || micro?.surgeB
                  ? `Priorisé : DR momentum en nette hausse (${micro.surgeA ? nameA : nameB} ≥ +${DR_SURGE_THRESHOLD}).`
                  : `P(le serveur au prochain jeu soit breaké). Priorité si un DR momentum ≥ +${DR_SURGE_THRESHOLD}.`
              }
              valueProb={micro ? micro.pBreakNext * 100 : 0}
              showValue={!!micro && (micro.surgeA || micro.surgeB)}
            />
            {micro ? (
              <PlayerRow
                name={micro.serverIsA ? `${nameA} hold` : `${nameB} hold`}
                pct={(1 - micro.pBreakNext) * 100}
                tone="a"
              />
            ) : (
              <WaitingLine />
            )}
            {micro && (micro.surgeA || micro.surgeB) && (
              <p className="mt-1.5 text-[10px] font-semibold text-emerald-400">
                ⚡ DR momentum en nette hausse — marché prioritaire
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Carte 3 : Over/Under jeux & Tie-Break ────────────────────────── */}
      <div className="min-w-0 rounded-2xl border border-white/5 bg-slate-950/40 p-3.5">
        {show("score-jeu") && (
          <div className="mb-3">
            <MarketHead
              n="⑦"
              label="Score du prochain jeu"
              hint="Distribution des 3 issues du jeu de service : 4-0 (impeccable), gain après avoir concédé, ou break."
              showValue={false}
            />
            {micro ? (
              <>
                {(Object.entries(micro.gameScore) as [GameScoreOutcome, number][])
                  .sort((a, b) => b[1] - a[1])
                  .map(([outcome, p]) => (
                    <div key={outcome} className="mb-1 flex items-center gap-2 last:mb-0">
                      <span className="w-[68px] shrink-0 truncate text-xs text-slate-400 sm:w-[76px]">
                        {GAME_SCORE_LABEL[outcome]}
                      </span>
                      <div className="min-w-0 flex-1">
                        <NeonBar pct={p * 100} tone={outcome === "break" ? "b" : "a"} />
                      </div>
                      <span
                        className={cn(
                          "w-9 shrink-0 text-right font-mono text-xs tabular-nums",
                          outcome === "break" ? "text-blue-300" : "text-emerald-300",
                        )}
                      >
                        {Math.round(p * 100)}%
                      </span>
                    </div>
                  ))}
              </>
            ) : (
              <WaitingLine />
            )}
          </div>
        )}

        {show("tie-break") && (
          <div className="mb-3">
            <MarketHead
              n="⑧"
              label="Tie-break dans le set"
              hint="P(le set atteint 6-6) : loi hypergéométrique sur les holds des deux joueurs."
              valueProb={micro ? micro.pTieBreak * 100 : 0}
              showValue={!!micro}
            />
            {micro ? (
              <PlayerRow name="6-6 → TB" pct={micro.pTieBreak * 100} tone="amber" />
            ) : (
              <WaitingLine />
            )}
          </div>
        )}

        {show("over-match") && (
          <div className="mb-3">
            <MarketHead
              n="③"
              label={`Over games match ${setAndGames?.totalGames.recommendedBet.threshold ?? "—"}`}
              valueProb={setAndGames?.totalGames.recommendedBet.prob ?? 0}
              showValue={!!setAndGames}
            />
            {setAndGames ? (
              <PlayerRow
                name={`Over ${setAndGames.totalGames.recommendedBet.threshold}`}
                pct={setAndGames.totalGames.recommendedBet.prob}
                tone="amber"
              />
            ) : (
              <WaitingLine />
            )}
          </div>
        )}

        {show("over-set") && (
          <div>
            <MarketHead
              n="④"
              label={`Over games set ${setAndGames?.setPred.recommendedBet.threshold ?? "—"}`}
              valueProb={setAndGames?.setPred.recommendedBet.prob ?? 0}
              showValue={!!setAndGames}
            />
            {setAndGames ? (
              <PlayerRow
                name={`Over ${setAndGames.setPred.recommendedBet.threshold}`}
                pct={setAndGames.setPred.recommendedBet.prob}
                tone="amber"
              />
            ) : (
              <WaitingLine />
            )}
          </div>
        )}
      </div>

      <p className="mt-2 text-[10px] italic text-slate-500">
        ✅ value = proba ∈ [60 %, 70 %] · heuristique, pas un calcul d&apos;EV réel
      </p>
    </div>
  );
}

function shortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return (parts[parts.length - 1] || fullName).toUpperCase();
}

export const PipBetPanel = memo(PipBetPanelImpl);