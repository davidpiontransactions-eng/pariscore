"use client";

// Ligne compacte d'un match dans le widget Document PiP.
//
// Layout ~400px × ~64px replié :
//   ┌────────────────────────────────────────────┐
//   │ ALCARAZ ●  [6][4] 30   ▓▓▓▓▓░░  +62   ✅  │
//   │ SINNER    [4][6] 15                       │
//   └────────────────────────────────────────────┘
//
// Au clic sur la ligne → onToggle() déploie le panneau 5 bets (PipBetPanel)
// juste en dessous. Un seul match déployé à la fois (géré par le parent).
//
// Réutilise :
//   - useMomentumDR(liveState) pour le DR (barre + sparkline compact)
//   - getDrDecision(dr, pointsTracked, settled) pour le feu tricolore
//
// Pas de next-intl (le PiP est un autre arbre React sans provider) → chaînes
// FR en dur.

import { memo, useEffect } from "react";
import type { TennisMatch } from "@/lib/tennis-data";
import type { LiveMatchState } from "@/hooks/use-live-matches";
import { useMomentumDR } from "@/hooks/use-momentum-dr";
import { getDrDecision, type DrDecisionLevel } from "@/lib/dr-decision";
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
};

/** Barre d'équilibre DR ultra-compacte (SVG inline, 60px de large).
 *  Version allégée de momentum-dr.tsx (pas de framer-motion ni tooltips). */
function DrMiniBar({ dr, color }: { dr: number; color: string }) {
  // dr ∈ [-1, +1] → position du curseur 0..100%.
  // 0 = au centre. +1 = tout à droite (A domine). -1 = tout à gauche.
  const pos = 50 + dr * 50;
  return (
    <svg width="60" height="8" viewBox="0 0 60 8" aria-hidden="true">
      {/* fond */}
      <rect x="0" y="2" width="60" height="4" rx="2" fill="currentColor" className="text-muted-foreground/20" />
      {/* ligne médiane */}
      <line x1="30" y1="0" x2="30" y2="8" stroke="currentColor" className="text-muted-foreground/40" strokeWidth="1" />
      {/* curseur */}
      <circle cx={pos} cy="4" r="3.5" fill={color} />
    </svg>
  );
}

/** Score d'un jeu en format tennis : 0/15/30/40/Ad. */
function formatPoint(p: number): string {
  // Convention BSD : points encodés en valeur numérique 0/1/2/3 (cf.
  // use-live-matches.ts:142-143 mapping depuis currentPoint.p1/p2).
  // 0=0, 1=15, 2=30, 3=40, 4+=Ad/généralement géré par diff.
  if (p <= 0) return "0";
  if (p === 1) return "15";
  if (p === 2) return "30";
  if (p === 3) return "40";
  return "Ad"; // 4+ = advantage (rare en valeur brute, mais défensif)
}

/** Tronque un nom de joueur : garde le nom de famille (dernier mot) en uppercase. */
function shortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return (parts[parts.length - 1] || fullName).toUpperCase();
}

function PipMatchRowImpl({ match, liveState, expanded, onToggle, onBetSignal }: Props) {
  // DR momentum — le hook maintient son propre buffer entre renders (refs).
  const { dr, pointsTracked, settled } = useMomentumDR(liveState);
  const decision = getDrDecision(dr, pointsTracked, settled);

  // Signal feu tricolore au parent (pour notifications natives).
  // useEffect pour éviter l'appel pendant le render (side-effect propre).
  useEffect(() => {
    if (liveState) onBetSignal?.(decision.level);
  }, [decision.level, liveState, onBetSignal]);

  // Couleur du curseur DR : joueur qui domine (vert pour A, bleu pour B).
  const drColor = dr >= 0 ? "#22c55e" : "#3b82f6";
  const drPct = Math.round(dr * 100);
  const drLabel = `${drPct >= 0 ? "+" : ""}${drPct}`;

  const playerA = match.playerA;
  const playerB = match.playerB;

  // Si pas encore live (liveState absent), on affiche quand même les noms +
  // un placeholder "prématch" — l'utilisateur peut ainsi préparer le widget.
  const isLive = !!liveState;

  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "w-full text-left rounded-lg border transition-colors",
        "px-2.5 py-2",
        expanded
          ? "border-primary/60 bg-primary/5"
          : "border-border/50 bg-card hover:bg-muted/30 hover:border-border",
      )}
    >
      {/* Joueur A */}
      <div className="flex items-center gap-2 text-[11px]">
        <span className="flex items-center gap-1 w-[88px] shrink-0">
          {/* Indicateur serveur */}
          {isLive && liveState!.server === "A" && (
            <span className="size-1.5 rounded-full bg-emerald-400" title="Au service" />
          )}
          <span className="truncate font-semibold text-foreground">{shortName(playerA.name)}</span>
        </span>

        {/* Score sets + jeu en cours */}
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

        {/* DR mini-barre */}
        <span className="ml-auto flex items-center gap-1.5 shrink-0">
          <DrMiniBar dr={dr} color={drColor} />
          <span className="font-mono tabular-nums text-[10px] w-8 text-right" style={{ color: drColor }}>
            {isLive ? drLabel : "—"}
          </span>
        </span>
      </div>

      {/* Joueur B */}
      <div className="flex items-center gap-2 text-[11px] mt-0.5">
        <span className="flex items-center gap-1 w-[88px] shrink-0">
          {isLive && liveState!.server === "B" && (
            <span className="size-1.5 rounded-full bg-emerald-400" title="Au service" />
          )}
          <span className="truncate font-semibold text-foreground">{shortName(playerB.name)}</span>
        </span>

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

        {/* Feu tricolore */}
        <span className={cn("ml-auto px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0", decision.bgClass, decision.colorClass)}>
          {isLive ? decision.icon : "—"}
        </span>
      </div>
    </button>
  );
}

export const PipMatchRow = memo(PipMatchRowImpl);
