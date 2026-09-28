"use client";

// LiveScoreMatrix — « La Fourche » (Modèle A, rapport
// .context/rapport-live-matrix-redesign.md, validé 2026-09-28).
//
// Remplace la grille Betfair 16 états (Peter Webb) par une décision en un
// regard : le pivot (score + cote 1xBet actuelle) et les DEUX issues du
// prochain point en cartes-jumeaux — chaque branche affiche la cote juste
// résultante du BÉNÉFICIAIRE du point, son delta vs 1xBet, P(jeu) et
// P(match). La dominance (« PREND LE JEU ») est encodée en profondeur
// faux-3D : carte soulevée translateZ(14px) + ombre dense, carte enfoncée
// translateZ(-6px) + opacité 0.85. Animations (swap 220ms, count-up 180ms,
// connecteurs 300ms) coupées sous prefers-reduced-motion.
// Rendu null hors live ou match terminé. Props inchangées → les 2 points
// d'appel (match-card.tsx / match-card-broadcast.tsx) sont servis à l'identique.

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TennisMatch } from "@/lib/tennis-data";
import type { LiveMatchState } from "@/hooks/use-live-matches";
import { useTennisLiveStats } from "@/hooks/use-tennis-live-stats";
import { estimateServePointsWon } from "@/lib/tennis-live-metrics";
import {
  predictTotalGames,
  type ServeStats,
  type LiveGamesContext,
} from "@/lib/prediction/total-games";
import {
  buildLiveMatrix,
  matrixBreakPointSide,
  type LiveMatrixModel,
} from "@/lib/prediction/live-matrix";

type Props = {
  match: TennisMatch;
  /** Présent uniquement si le match est live — le composant se masque sinon. */
  liveState?: LiveMatchState | null;
  serveStatsA?: ServeStats | null;
  serveStatsB?: ServeStats | null;
  className?: string;
};

/** Libellés de points pour le nœud central (4+ = avantage). */
const NODE_LABELS = ["0", "15", "30", "40", "Av"] as const;

/** Mappe surface UI (français) → surface modèle (anglais DB). */
function toModelSurface(s: string): "Hard" | "Clay" | "Grass" {
  if (s === "Gazon") return "Grass";
  if (s === "Terre battue") return "Clay";
  return "Hard";
}

/** Construit le contexte live (mêmes champs que les panneaux voisins). */
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
    currentPoints: [state.scoreA.points, state.scoreB.points],
  };
}

/** true si l'utilisateur demande les animations réduites. */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/** Count-up court (180 ms, ease-out) sur les cotes — instantané si reduced. */
function useCountUp(value: number, animated: boolean): number {
  const [shown, setShown] = useState(value);
  const fromRef = useRef(value);
  useEffect(() => {
    if (!animated || fromRef.current === value) {
      fromRef.current = value;
      setShown(value);
      return;
    }
    const from = fromRef.current;
    const t0 = performance.now();
    const dur = 180;
    let raf = requestAnimationFrame(function tick(t) {
      const k = Math.min(1, (t - t0) / dur);
      const eased = 1 - (1 - k) ** 3;
      setShown(from + (value - from) * eased);
      if (k < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = value;
    });
    return () => cancelAnimationFrame(raf);
  }, [value, animated]);
  return shown;
}

const frNum = (v: number, d = 2) => v.toFixed(d).replace(".", ",");

/** Carte-jumeau d'une branche de la fourche. */
function ForkCard({
  branch, // "A" | "B" — bénéficiaire du point
  player,
  heroOdd,
  refOdd,
  pGame,
  pMatch,
  dominant,
  reduced,
  tip,
  surtitle,
}: {
  branch: "A" | "B";
  player: string;
  heroOdd: number;
  refOdd: number | null;
  pGame: number;
  pMatch: number;
  dominant: boolean;
  reduced: boolean;
  tip: string;
  surtitle: string;
}) {
  const hero = useCountUp(heroOdd, !reduced);
  const delta = refOdd != null && refOdd > 0 ? heroOdd - refOdd : null;

  return (
    <div
      className={cn(
        "relative flex min-h-[96px] flex-col justify-between rounded-lg border p-2.5",
        branch === "A" ? "bg-emerald-500/12" : "bg-rose-500/10",
        dominant ? "border-emerald-500/70" : "border-transparent opacity-85",
      )}
      style={{
        // Faux-3D : la branche dominante est littéralement plus proche.
        transform: dominant ? "translateZ(14px)" : "translateZ(-6px)",
        boxShadow: dominant
          ? "0 18px 24px -14px rgb(0 0 0 / .55)"
          : "0 4px 10px -8px rgb(0 0 0 / .4)",
        transition: reduced
          ? undefined
          : "transform 220ms ease-out, box-shadow 220ms ease-out, opacity 220ms ease-out",
      }}
      title={tip}
    >
      {dominant && (
        <span className="mb-1 rounded bg-emerald-600/90 px-1.5 py-0.5 text-center text-[9px] font-bold uppercase tracking-wider text-white">
          {surtitle}
        </span>
      )}
      <span className="truncate text-[11px] font-medium text-muted-foreground">
        {player}
      </span>
      <div className="flex items-baseline justify-between gap-1">
        <span className="font-mono text-2xl font-bold leading-none tabular-nums">
          {frNum(hero)}
        </span>
        <span
          className={cn(
            "font-mono text-[11px] font-semibold tabular-nums",
            delta == null
              ? "text-muted-foreground/60"
              : delta < 0
                ? "text-emerald-600 dark:text-emerald-400"
                : delta > 0
                  ? "text-rose-500"
                  : "text-muted-foreground",
          )}
        >
          {delta == null ? "—" : `Δ ${delta > 0 ? "+" : ""}${frNum(delta)}`}
        </span>
      </div>
      <div className="flex items-center justify-between gap-1 text-[10px] text-muted-foreground">
        <span>
          P(jeu) <span className="font-semibold text-foreground">{Math.round(pGame * 100)}%</span>
        </span>
        <span>
          P(match){" "}
          <span className="font-semibold text-foreground">{Math.round(pMatch * 100)}%</span>
        </span>
      </div>
    </div>
  );
}

export function LiveScoreMatrix({
  match,
  liveState,
  serveStatsA,
  serveStatsB,
  className,
}: Props) {
  const t = useTranslations("liveMatrix");
  const reduced = usePrefersReducedMotion();
  const [drawn, setDrawn] = useState(false);
  // Connecteurs tracés au montage (la fourche se déploie depuis le nœud).
  useEffect(() => {
    const raf = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  // Serve observé ce match (stats BSD via SSE partagé) → blend récence.
  const { stats: liveStats } = useTennisLiveStats(liveState?.matchId ?? "");

  const model: LiveMatrixModel | null = useMemo(() => {
    if (!liveState?.isLive) return null;

    const setsA = liveState.scoreA.sets.length;
    const setsB = liveState.scoreB.sets.length;
    // Match terminé (BO3) → la matrice n'a plus de sens.
    if (setsA >= 2 || setsB >= 2) return null;

    const stA: ServeStats = serveStatsA ?? { servePtsWonPct: null, returnPtsWonPct: null };
    const stB: ServeStats = serveStatsB ?? { servePtsWonPct: null, returnPtsWonPct: null };
    const liveCtx: LiveGamesContext = {
      ...buildLiveContext(liveState),
      observedServeA: liveStats ? estimateServePointsWon(liveStats, "A") : null,
      observedServeB: liveStats ? estimateServePointsWon(liveStats, "B") : null,
    };

    // try/catch défensif (9eo6) : jamais de RangeError vers la boundary de
    // l'onglet si une donnée live (quota BSD) nourrit le modèle en NaN.
    try {
      const tg = predictTotalGames(
        stA,
        stB,
        toModelSurface(match.stats?.surface ?? "Hard"),
        3,
        undefined,
        undefined,
        liveCtx,
      );

      return buildLiveMatrix({
        pServeA: tg.pServeA,
        pServeB: tg.pServeB,
        games: [liveState.scoreA.games, liveState.scoreB.games],
        sets: [setsA, setsB],
        points: [liveState.scoreA.points, liveState.scoreB.points],
        server: liveState.server,
        bo3: true,
      });
    } catch (err) {
      console.warn("[LiveScoreMatrix] modèle live en échec — matrice masquée :", (err as Error).message);
      return null;
    }
  }, [liveState, serveStatsA, serveStatsB, match, liveStats]);

  if (!liveState?.isLive || !model) return null;

  const { current, server, games, sets, fork } = model;
  const fairCur = model.cells[current.ptsA][current.ptsB];
  const bpSide = matrixBreakPointSide(
    liveState.scoreA.points,
    liveState.scoreB.points,
    server,
  );
  const bpPlayer =
    bpSide === "A" ? match.playerA?.shortName ?? "A" : match.playerB?.shortName ?? "B";

  const marketA = liveState.oddsA;
  const marketB = liveState.oddsB;

  const nameA = match.playerA?.shortName ?? "A";
  const nameB = match.playerB?.shortName ?? "B";

  // Bénéficiaires : gauche = A gagne le point, droite = B gagne le point.
  const brA = fork.winPointA;
  const brB = fork.winPointB;
  const oddA = brA.fairOddA; // cote juste d'A après son point
  const oddB = brB.fairOddB; // cote juste de B après son point
  const pGameA = brA.pGameA; // P(A gagne le jeu) si A gagne le point
  const pGameB = 1 - brB.pGameA; // P(B gagne le jeu) si B gagne le point
  const pMatchA = brA.pMatchA;
  const pMatchB = 1 - brB.pMatchA;

  // Dominance = qui est le plus probable pour PRENDRE le jeu après ce point.
  const aDominant = pGameA >= pGameB;
  const domProb = aDominant ? pGameA : pGameB;
  const surtitle = `${t("takesGame")} · ${Math.round(domProb * 100)}%`;

  // Value par branche : cote juste > cote payée (1xBet) de plus de 3 %.
  const edgeA = marketA != null && marketA > 0 ? oddA / marketA - 1 : null;
  const edgeB = marketB != null && marketB > 0 ? oddB / marketB - 1 : null;

  const connector = (side: "left" | "right") => (
    <svg
      aria-hidden
      viewBox="0 0 24 8"
      preserveAspectRatio="none"
      className="h-2 w-4 shrink-0 overflow-visible"
    >
      <line
        x1={side === "left" ? 24 : 0}
        y1="4"
        x2={side === "left" ? 0 : 24}
        y2="4"
        pathLength={100}
        strokeDasharray={100}
        strokeDashoffset={drawn || reduced ? 0 : 100}
        strokeWidth={2}
        className="stroke-border"
        style={{ transition: reduced ? undefined : "stroke-dashoffset 300ms ease-out" }}
      />
    </svg>
  );

  const tipFor = (score: string, player: string, prob: number, odd: number) =>
    t("cellTip", { score, player, prob: Math.round(prob * 100), odd: frNum(odd) });

  const stateLabel = `${NODE_LABELS[Math.min(liveState.scoreA.points, 4)]}-${NODE_LABELS[Math.min(liveState.scoreB.points, 4)]}`;

  return (
    <section
      className={cn("rounded-xl border bg-card p-3", className)}
      aria-label={t("title")}
    >
      {/* Registre haut (pivot) : titre, score, serveur, break + cote 1xBet */}
      <div
        className="flex items-start justify-between gap-3 rounded-lg bg-muted/30 p-2.5"
        style={{ transform: "translateZ(0)" }}
      >
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold">
              <Zap className="h-3.5 w-3.5 text-emerald-500" />
              {t("title")}
            </h3>
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
              {games[0]}-{games[1]} · {sets[0]}-{sets[1]} sets
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-muted-foreground">
            <span>
              <span
                className={cn(
                  "mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle",
                  server === "A" ? "bg-sky-500" : "bg-rose-500",
                )}
                aria-hidden
              />
              {t("server")}:{" "}
              <span className="font-medium text-foreground">
                {server === "A" ? nameA : nameB}
              </span>
            </span>
            {bpSide && (
              <span className="motion-safe:animate-pulse rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                <Zap className="mr-0.5 inline h-3 w-3 align-[-2px]" />
                {t("breakPoint", { player: bpPlayer })}
              </span>
            )}
          </div>
        </div>
        {/* Cote 1xBet actuelle — le point d'ancrage (« d'où on part »). */}
        <div className="shrink-0 text-right">
          <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {t("market")} 1xBet
          </div>
          <div className="font-mono text-xl font-bold leading-tight tabular-nums">
            {marketA != null ? frNum(marketA) : "—"}
            <span className="mx-1 font-normal text-muted-foreground/60">/</span>
            {marketB != null ? frNum(marketB) : "—"}
          </div>
        </div>
      </div>

      {/* Registre bas : la fourche — 2 issues du prochain point */}
      <div
        className="mt-2 grid grid-cols-[1fr_auto_1fr] items-stretch"
        style={{ perspective: "900px" }}
      >
        <ForkCard
          branch="A"
          player={t("branchWin", { player: nameA })}
          heroOdd={oddA}
          refOdd={marketA}
          pGame={pGameA}
          pMatch={pMatchA}
          dominant={aDominant}
          reduced={reduced}
          surtitle={surtitle}
          tip={tipFor(stateLabel, nameA, pMatchA, oddA)}
        />

        {/* Nœud central : état de points + connecteurs vers les 2 cartes */}
        <div className="flex items-center gap-0.5 px-0.5">
          {connector("left")}
          <div className="relative z-10 rounded-md border bg-background px-1.5 py-1 text-center shadow-sm">
            <span className="block font-mono text-[10px] font-bold tabular-nums leading-none">
              {stateLabel}
            </span>
            <span className="mt-0.5 block text-[8px] leading-none text-muted-foreground">
              {brA.gameEnding || brB.gameEnding ? "●" : t("points")}
            </span>
          </div>
          {connector("right")}
        </div>

        <ForkCard
          branch="B"
          player={t("branchWin", { player: nameB })}
          heroOdd={oddB}
          refOdd={marketB}
          pGame={pGameB}
          pMatch={pMatchB}
          dominant={!aDominant}
          reduced={reduced}
          surtitle={surtitle}
          tip={tipFor(stateLabel, nameB, pMatchB, oddB)}
        />
      </div>

      {/* Pied : modèle courant + value éventuelle (une seule ligne) */}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-2 text-[11px]">
        <span className="text-muted-foreground">
          {t("fair")} (courant):
          <span className="ml-1 font-mono font-semibold tabular-nums text-foreground">
            {frNum(fairCur.fairOddA)}
          </span>
          <span className="mx-1 text-muted-foreground/50">/</span>
          <span className="font-mono font-semibold tabular-nums text-foreground">
            {frNum(fairCur.fairOddB)}
          </span>
        </span>
        {edgeA != null && edgeA > 0.03 && (
          <span className="rounded bg-emerald-600 px-1.5 py-px text-[10px] font-bold text-white">
            {t("valueA")} +{Math.round(edgeA * 100)}%
          </span>
        )}
        {edgeB != null && edgeB > 0.03 && (
          <span className="rounded bg-emerald-600 px-1.5 py-px text-[10px] font-bold text-white">
            {t("valueB")} +{Math.round(edgeB * 100)}%
          </span>
        )}
        {marketA == null && marketB == null && (
          <span className="text-muted-foreground/60">{t("noOdds")}</span>
        )}
      </div>
    </section>
  );
}
