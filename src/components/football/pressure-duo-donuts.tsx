"use client";

// PressureDuoDonuts — le couple LIVE / ATTENDU sur la pression (OddAlerts §1).
// Deux donuts bicolores : pression LIVE du match vs pression ATTENDUE pré-match
// (baseline dérivée des probabilités 1X2). L'écart live − attendu est le signal
// d'anomalie : un outsider qui domine en live vs son attendu = exploitable.

import { useMemo } from "react";
import { Flame, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { detectPressureAnomaly } from "@/lib/football-live-thresholds";

const R = 42;
const CIRC = 2 * Math.PI * R;

function Donut({
  homePct,
  awayPct,
  homeName,
  awayName,
  title,
}: {
  homePct: number;
  awayPct: number;
  homeName: string;
  awayName: string;
  title: string;
}) {
  const homeLen = Math.max(0, Math.min(100, homePct)) / 100 * CIRC;
  return (
    <figure className="flex flex-col items-center gap-1" role="img" aria-label={`${title} : ${homeName} ${homePct}%, ${awayName} ${awayPct}%`}>
      <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{title}</span>
      <svg viewBox="0 0 110 110" className="h-24 w-24">
        <circle cx="55" cy="55" r={R} fill="none" stroke="#3b82f6" strokeOpacity="0.75" strokeWidth="11" />
        <circle
          cx="55"
          cy="55"
          r={R}
          fill="none"
          stroke="#22c55e"
          strokeWidth="11"
          strokeLinecap="butt"
          strokeDasharray={`${homeLen} ${CIRC - homeLen}`}
          transform="rotate(-90 55 55)"
        />
        <text x="55" y="50" textAnchor="middle" fontSize="20" fontWeight="800" fill="#22c55e" className="tabular-nums">
          {homePct}
        </text>
        <text x="55" y="68" textAnchor="middle" fontSize="12" fontWeight="700" fill="#3b82f6" className="tabular-nums">
          {awayPct}
        </text>
      </svg>
      <figcaption className="flex gap-2 text-[9px] text-muted-foreground">
        <span className="text-emerald-400">{homePct} {homeName}</span>
        <span className="text-muted-foreground/30">|</span>
        <span className="text-sky-400">{awayPct} {awayName}</span>
      </figcaption>
    </figure>
  );
}

export function PressureDuoDonuts({
  live,
  avg,
  homeName = "Domicile",
  awayName = "Extérieur",
  className,
}: {
  /** Pression live 0-100 (somme ≈ 100). */
  live: { homePct: number; awayPct: number };
  /** Pression attendue pré-match (baseline). Null → donut LIVE seul. */
  avg?: { homePct: number; awayPct: number } | null;
  homeName?: string;
  awayName?: string;
  className?: string;
}) {
  const anomaly = useMemo(
    () => (avg ? detectPressureAnomaly(live.homePct, avg.homePct) : null),
    [live.homePct, avg],
  );

  return (
    <section className={cn("rounded-2xl border border-slate-800 bg-slate-950/60 p-3", className)} aria-label="Pression live vs attendue">
      <div className="flex items-center justify-around gap-2">
        <Donut
          homePct={Math.round(live.homePct)}
          awayPct={Math.round(live.awayPct)}
          homeName={homeName}
          awayName={awayName}
          title="Pression Live"
        />
        {avg && (
          <>
            <div className="flex flex-col items-center gap-1 text-[10px] text-muted-foreground">
              <span>vs</span>
              {anomaly && (
                <span
                  className={cn(
                    "tabular-nums font-bold",
                    anomaly.delta >= 0 ? "text-emerald-400" : "text-sky-400",
                  )}
                >
                  Δ {anomaly.delta > 0 ? "+" : ""}{anomaly.delta}
                </span>
              )}
            </div>
            <Donut
              homePct={avg.homePct}
              awayPct={avg.awayPct}
              homeName={homeName}
              awayName={awayName}
              title="Attendu"
            />
          </>
        )}
      </div>

      {anomaly?.kind === "underdog_surge" && (
        <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-amber-300">
          <Flame className="h-3.5 w-3.5 shrink-0 animate-pulse" aria-hidden="true" />
          Anomalie : {homeName} domine {live.homePct}% en live contre {avg?.homePct}% attendu — signal live à surveiller
        </div>
      )}
      {anomaly?.kind === "favorite_domination" && (
        <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-300">
          <Crown className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Domination confirmée : {live.homePct >= 50 ? homeName : awayName} verrouille le jeu ({Math.max(live.homePct, live.awayPct)}% de pression)
        </div>
      )}
    </section>
  );
}
