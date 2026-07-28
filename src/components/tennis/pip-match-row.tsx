"use client";

// Ligne compacte d'un match dans le widget Document PiP.
//
// Layout ~400px × ~80px replié :
//   ┌──────────────────────────────────────────────┐
//   │ ALCARAZ ● [6][4] 30  DRmoy 1.32              │  ← ligne A + DR moyen
//   │ SINNER   [4][6] 15  DRmoy 1.08               │  ← ligne B + DR moyen
//   │     ╱╲___╱╲╱╲___╱╲╱╲___╱╲   +62   ✅          │  ← mini-sparkline DR momentum
//   └──────────────────────────────────────────────┘
//   (terrain de tennis en filigrane translucide derrière toute la ligne)
//
// Au clic sur la ligne → onToggle() déploie le panneau 5 bets (PipBetPanel)
// juste en dessous. Un seul match déployé à la fois (géré par le parent).
//
// Réutilise :
//   - useMomentumDR(liveState) pour le DR momentum + drHistory (sparkline)
//   - getDrDecision(dr, pointsTracked, settled) pour le feu tricolore
//   - buildPath() cloné de momentum-dr.tsx (courbe Bézier centrée sur 0)
//
// Pas de next-intl (le PiP est un autre arbre React sans provider) → chaînes
// FR en dur.

import { memo, useEffect, useMemo, useRef } from "react";
import type { TennisMatch } from "@/lib/tennis-data";
import type { LiveMatchState } from "@/hooks/use-live-matches";
import { useMomentumDR } from "@/hooks/use-momentum-dr";
import { getDrDecision, type DrDecisionLevel } from "@/lib/dr-decision";
import { computeDrMatch, formatDr, drColorClass } from "@/lib/dr-match";
import { evaluateValueAlert, formatValueAlertLabel } from "@/lib/value-alert";
import { cn } from "@/lib/utils";

type Props = {
  match: TennisMatch;
  liveState?: LiveMatchState;
  /** true si le panneau 5 bets est déployé sous cette ligne. */
  expanded: boolean;
  /** Bascule l'expansion (1 seul match déployé à la fois). */
  onToggle: () => void;
  /** Callback de signal feu tricolore (notifiera si transition vers "bet").
   *  Le parent (MatchPipWidget) décide si les notifs sont activées. */
  onBetSignal?: (level: DrDecisionLevel) => void;
  /** Callback de signal value alert (notifiera si transition vers active).
   *  Déclenché quand ≥ 2 jeux d'écart set + DR leader ≥ 1.2. */
  onValueAlert?: (label: { title: string; body: string }) => void;
  /** DR moyen match de A (médiane 5 derniers matchs, surface-filtré). */
  drMoyenA?: number | null;
  /** DR moyen match de B. */
  drMoyenB?: number | null;
};

// ─── buildPath (cloné de momentum-dr.tsx:52) ─────────────────────────────
// Construit un path SVG Bézier pour une série DR ∈ [-1, +1] centrée sur 0.
// Identique au composant plein mais sans framer-motion (allégé pour le PiP).
const SPARK_W = 80;
const SPARK_H = 22;
const SPARK_MARGIN = 2;

function buildPath(data: number[], w: number, h: number): string {
  if (data.length < 2) return "";
  const mid = h / 2;
  const range = h / 2 - SPARK_MARGIN;
  const pts = data.map((v, i) => ({
    x: (i / (data.length - 1)) * w,
    y: mid - Math.max(-1, Math.min(1, v)) * range,
  }));
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i];
    const p1 = pts[i + 1];
    const cp1x = p0.x + (p1.x - p0.x) / 2;
    d += ` C${cp1x},${p0.y} ${cp1x},${p1.y} ${p1.x},${p1.y}`;
  }
  return d;
}

/** Mini-sparkline DR momentum (SVG inline ~80×22px).
 *  Montre l'évolution du DR sur les 24 derniers points joués.
 *  Ligne médiane 0, courbe colorée selon le dominant, dernier point en évidence. */
function DrSparkline({ drHistory, currentDr }: { drHistory: number[]; currentDr: number }) {
  const path = buildPath(drHistory, SPARK_W, SPARK_H);
  // Couleur selon le dominant actuel (vert A, bleu B).
  const color = currentDr >= 0 ? "#22c55e" : "#3b82f6";
  const mid = SPARK_H / 2;
  // Dernier point (position x = bord droit, y selon currentDr).
  const lastY = mid - Math.max(-1, Math.min(1, currentDr)) * (SPARK_H / 2 - SPARK_MARGIN);

  // Area fill : ferme le path sous la ligne jusqu'à la médiane pour un effet "aire".
  const areaPath = path ? `${path} L${SPARK_W},${mid} L0,${mid} Z` : "";

  return (
    <svg width={SPARK_W} height={SPARK_H} viewBox={`0 0 ${SPARK_W} ${SPARK_H}`} aria-hidden="true">
      {/* Ligne médiane (DR = 0 = équilibre parfait) */}
      <line
        x1="0" y1={mid} x2={SPARK_W} y2={mid}
        stroke="currentColor" className="text-muted-foreground/30" strokeWidth="0.5"
        strokeDasharray="2 2"
      />
      {path && (
        <>
          {/* Aire sous la courbe (translucide) */}
          <path d={areaPath} fill={color} fillOpacity="0.12" />
          {/* Courbe principale */}
          <path d={path} fill="none" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          {/* Dernier point en évidence */}
          <circle cx={SPARK_W} cy={lastY} r="2" fill={color} />
        </>
      )}
    </svg>
  );
}

/** Terrain de tennis en filigrane translucide (SVG inline, ~8% opacité).
 *  Dessine un court simplifié : limites + couloirs + filet + ligne de service.
 *  Position absolute, pointer-events none, ne gêne pas les interactions. */
function CourtBackground() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 w-full h-full"
      preserveAspectRatio="none"
      viewBox="0 0 200 60"
      style={{ opacity: 0.08 }}
    >
      {/* Cadre extérieur (limites doubles) */}
      <rect x="4" y="4" width="192" height="52" fill="none" stroke="currentColor" className="text-emerald-400" strokeWidth="0.8" />
      {/* Couloirs de doubles */}
      <rect x="4" y="10" width="192" height="40" fill="none" stroke="currentColor" className="text-emerald-400" strokeWidth="0.4" />
      {/* Lignes de service (carré de service) */}
      <line x1="4" y1="18" x2="196" y2="18" stroke="currentColor" className="text-emerald-400" strokeWidth="0.4" />
      <line x1="4" y1="42" x2="196" y2="42" stroke="currentColor" className="text-emerald-400" strokeWidth="0.4" />
      <line x1="100" y1="18" x2="100" y2="42" stroke="currentColor" className="text-emerald-400" strokeWidth="0.4" />
      {/* Filet central */}
      <line x1="100" y1="4" x2="100" y2="56" stroke="currentColor" className="text-emerald-400" strokeWidth="0.6" strokeDasharray="2 1.5" />
      {/* Marques centrales (baseline) */}
      <line x1="98" y1="4" x2="102" y2="4" stroke="currentColor" className="text-emerald-400" strokeWidth="0.5" />
      <line x1="98" y1="56" x2="102" y2="56" stroke="currentColor" className="text-emerald-400" strokeWidth="0.5" />
    </svg>
  );
}

/** Pastille DR moyen match (médiane 5 derniers matchs, surface-filtré).
 *  Couleur : vert si >1.2 (dominant historique), ambre si 0.9-1.2 (équilibré),
 *  gris sinon (sous-performant au retour). */
function DrMoyenBadge({ drMoyen }: { drMoyen: number | null | undefined }) {
  if (drMoyen == null || !isFinite(drMoyen)) {
    return <span className="text-[8px] text-muted-foreground/30 font-mono">DRmoy —</span>;
  }
  const val = drMoyen.toFixed(2);
  const colorClass =
    drMoyen >= 1.2 ? "text-emerald-300" : drMoyen >= 0.9 ? "text-amber-300" : "text-muted-foreground/70";
  return (
    <span className={cn("text-[8px] font-mono tabular-nums font-semibold", colorClass)} title={`DR moyen match : ${val} (médiane 5 derniers matchs)`}>
      DRmoy {val}
    </span>
  );
}

/** Score d'un jeu en format tennis : 0/15/30/40/Ad. */
function formatPoint(p: number): string {
  if (p <= 0) return "0";
  if (p === 1) return "15";
  if (p === 2) return "30";
  if (p === 3) return "40";
  return "Ad";
}

/** Tronque un nom de joueur : garde le nom de famille (dernier mot) en uppercase. */
function shortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return (parts[parts.length - 1] || fullName).toUpperCase();
}

function PipMatchRowImpl({
  match,
  liveState,
  expanded,
  onToggle,
  onBetSignal,
  onValueAlert,
  drMoyenA,
  drMoyenB,
}: Props) {
  // DR momentum — le hook maintient son propre buffer entre renders (refs).
  const { dr, drHistory, pointsTracked, settled } = useMomentumDR(liveState);
  const decision = getDrDecision(dr, pointsTracked, settled);

  // DR "vrai" match (ratio Sofascore-style) : proxy games+sets.
  // Différent du DR momentum (tanh ∈ [-1,+1]) : c'est le RATIO > 0 qu'on voit
  // sur Sofascore (ex: 1.14 = joueur domine 14%). Calculé sur tout le match.
  const drMatch = useMemo(() => computeDrMatch(liveState), [liveState]);

  // Alerte value bet : à chaque palier pair de jeux JOUÉS dans le set (2,4,6,8,10,12)
  // + DR match (P1 ou P2) ≥ 1.2. Re-déclenche à chaque nouveau palier + reset par set.
  const valueAlert = useMemo(() => evaluateValueAlert(liveState), [liveState]);

  const playerA = match.playerA;
  const playerB = match.playerB;
  const isLive = !!liveState;

  // Signal feu tricolore au parent (pour notifications natives).
  useEffect(() => {
    if (liveState) onBetSignal?.(decision.level);
  }, [decision.level, liveState, onBetSignal]);

  // Signal value alert au parent. Re-déclenche la notification 🔥 à chaque :
  //   - nouveau SET (currentSet change → reset du palier, re-arme pour ce set)
  //   - nouveau PALIER de jeux JOUÉS pair dans le set (2, 4, 6, 8, 10, 12)
  // Le hook useBetNotify.notifyValueAlert gère un cooldown 2 min/match.
  const lastSetRef = useRef<number>(-1);
  const lastTierRef = useRef<number>(0);
  useEffect(() => {
    if (!liveState || !onValueAlert) return;

    const currentSet = liveState.currentSet;
    const currentTier = valueAlert.tier;

    // Reset du suivi si on change de set (re-arme l'alerte pour le nouveau set).
    if (currentSet !== lastSetRef.current) {
      lastSetRef.current = currentSet;
      lastTierRef.current = 0;
    }

    // Déclencher si l'alerte est active ET on a atteint un nouveau palier.
    const newTier = valueAlert.active && currentTier > lastTierRef.current;
    if (newTier) {
      lastTierRef.current = currentTier;
      const leaderName = valueAlert.leader === "A" ? shortName(playerA.name) : shortName(playerB.name);
      const label = formatValueAlertLabel(valueAlert, leaderName);
      if (label) onValueAlert(label);
    }
  }, [valueAlert, liveState, onValueAlert, playerA.name, playerB.name]);

  // Couleur du DR actuel (vert si A domine, bleu si B domine).
  const drColor = dr >= 0 ? "#22c55e" : "#3b82f6";
  const drPct = Math.round(dr * 100);
  const drLabel = `${drPct >= 0 ? "+" : ""}${drPct}`;

  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "relative w-full text-left rounded-lg border transition-colors overflow-hidden",
        "px-2.5 py-2",
        expanded
          ? "border-primary/60 bg-primary/5"
          : "border-border/50 bg-card hover:bg-muted/30 hover:border-border",
      )}
    >
      {/* Terrain de tennis en filigrane translucide (décor, ne gêne pas le clic) */}
      <CourtBackground />

      {/* Contenu par-dessus le filigrane */}
      <div className="relative z-10">
        {/* Badge 🔥 value alert : palier pair jeux joués set + DR P1/P2 ≥ 1.2 */}
        {valueAlert.active && (
          <span
            className="absolute -top-1.5 -right-1.5 z-20 flex items-center gap-0.5 rounded-full bg-orange-500 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-lg ring-2 ring-card animate-pulse"
            title={`🔥 Value bet — ${valueAlert.totalGamesInSet} jeux joués dans le set (${valueAlert.setScore?.gamesA}-${valueAlert.setScore?.gamesB}) · ${valueAlert.leader === "A" ? shortName(playerA.name) : shortName(playerB.name)} dominant (DR match ${valueAlert.drLeader?.toFixed(2)} ≥ 1.2)`}
          >
            🔥 value
          </span>
        )}
        {/* Joueur A */}
        <div className="flex items-center gap-2 text-[11px]">
          <span className="flex items-center gap-1 w-[80px] shrink-0">
            {isLive && liveState!.server === "A" && (
              <span className="size-1.5 rounded-full bg-emerald-400 shrink-0" title="Au service" />
            )}
            <span className="truncate font-semibold text-foreground">{shortName(playerA.name)}</span>
          </span>
          {/* Cote décimale live A (badge discret) */}
          {isLive && liveState!.oddsA != null && (
            <span className="rounded bg-amber-500/15 px-1 text-[9px] font-mono tabular-nums text-amber-300 shrink-0" title={`Cote ${shortName(playerA.name)} : ${liveState!.oddsA.toFixed(2)}`}>
              {liveState!.oddsA.toFixed(2)}
            </span>
          )}

          {isLive ? (
            <span className="flex items-center gap-1 font-mono tabular-nums shrink-0">
              {liveState!.scoreA.sets.map((s, i) => (
                <span key={i} className="text-muted-foreground/80">{s}</span>
              ))}
              <span className="ml-1 font-semibold text-foreground">{liveState!.scoreA.games}</span>
              <span className="text-amber-400">{formatPoint(liveState!.scoreA.points)}</span>
            </span>
          ) : (
            <span className="text-[10px] text-muted-foreground/60 italic shrink-0">prématch</span>
          )}

          {/* DR moyen match de A */}
          <span className="ml-auto shrink-0">
            <DrMoyenBadge drMoyen={drMoyenA} />
          </span>
        </div>

        {/* Joueur B */}
        <div className="flex items-center gap-2 text-[11px] mt-0.5">
          <span className="flex items-center gap-1 w-[80px] shrink-0">
            {isLive && liveState!.server === "B" && (
              <span className="size-1.5 rounded-full bg-emerald-400 shrink-0" title="Au service" />
            )}
            <span className="truncate font-semibold text-foreground">{shortName(playerB.name)}</span>
          </span>
          {/* Cote décimale live B (badge discret) */}
          {isLive && liveState!.oddsB != null && (
            <span className="rounded bg-amber-500/15 px-1 text-[9px] font-mono tabular-nums text-amber-300 shrink-0" title={`Cote ${shortName(playerB.name)} : ${liveState!.oddsB.toFixed(2)}`}>
              {liveState!.oddsB.toFixed(2)}
            </span>
          )}

          {isLive ? (
            <span className="flex items-center gap-1 font-mono tabular-nums shrink-0">
              {liveState!.scoreB.sets.map((s, i) => (
                <span key={i} className="text-muted-foreground/80">{s}</span>
              ))}
              <span className="ml-1 font-semibold text-foreground">{liveState!.scoreB.games}</span>
              <span className="text-amber-400">{formatPoint(liveState!.scoreB.points)}</span>
            </span>
          ) : (
            <span className="text-[10px] text-muted-foreground/60 italic shrink-0">prématch</span>
          )}

          {/* DR moyen match de B */}
          <span className="ml-auto shrink-0">
            <DrMoyenBadge drMoyen={drMoyenB} />
          </span>
        </div>

        {/* 3e ligne : mini-sparkline DR momentum + valeur + feu tricolore */}
        <div className="flex items-center gap-2 mt-1 pt-1 border-t border-border/20">
          <span className="text-[8px] text-muted-foreground/60 shrink-0">DR momentum</span>
          <span className="flex items-center gap-1.5 shrink-0">
            <DrSparkline drHistory={drHistory} currentDr={dr} />
          </span>
          <span
            className="ml-auto font-mono tabular-nums text-[10px] font-semibold shrink-0"
            style={{ color: drColor }}
          >
            {isLive ? drLabel : "—"}
          </span>
          <span
            className={cn(
              "px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0",
              decision.bgClass,
              decision.colorClass,
            )}
          >
            {isLive ? decision.icon : "—"}
          </span>
        </div>

        {/* 4e ligne : DR match (vrai ratio Sofascore) + DR par set */}
        {isLive && drMatch && (
          <div className="flex items-center gap-1.5 mt-1 text-[8px] font-mono tabular-nums">
            <span className="text-muted-foreground/60 shrink-0">DR match</span>
            {/* DR match global par joueur */}
            <span className={cn("font-semibold", drColorClass(drMatch.drA))} title={`DR match ${shortName(playerA.name)} = ${formatDr(drMatch.drA)}`}>
              {shortName(playerA.name).substring(0, 4)} {formatDr(drMatch.drA)}
            </span>
            <span className="text-muted-foreground/40">·</span>
            <span className={cn("font-semibold", drColorClass(drMatch.drB))} title={`DR match ${shortName(playerB.name)} = ${formatDr(drMatch.drB)}`}>
              {shortName(playerB.name).substring(0, 4)} {formatDr(drMatch.drB)}
            </span>
            {/* DR par set (si au moins 1 set joué) */}
            {drMatch.drBySet.some((s) => s !== null) && (
              <>
                <span className="text-muted-foreground/40 ml-1">│sets</span>
                {drMatch.drBySet.map((s, i) =>
                  s ? (
                    <span
                      key={i}
                      className={cn("font-semibold", drColorClass(s.drA))}
                      title={`DR Set ${i + 1} — ${shortName(playerA.name)} ${formatDr(s.drA)} · ${shortName(playerB.name)} ${formatDr(s.drB)}`}
                    >
                      S{i + 1}:{formatDr(s.drA)}/{formatDr(s.drB)}
                    </span>
                  ) : null,
                )}
              </>
            )}
          </div>
        )}
      </div>
    </button>
  );
}

export const PipMatchRow = memo(PipMatchRowImpl);
