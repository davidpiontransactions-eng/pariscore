"use client";

// PressureDuoDonuts — le couple LIVE / ATTENDU sur la pression (OddAlerts §1).
// Deux donuts bicolores : pression LIVE du match vs pression ATTENDUE pré-match
// (baseline dérivée des probabilités 1X2). L'écart live − attendu est le signal
// d'anomalie : un outsider qui domine en live vs son attendu = exploitable.

import { useMemo } from "react";
import { Flame, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { detectPressureAnomaly } from "@/lib/football-live-thresholds";
import { FOT } from "./fotmob-theme";

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
      <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: FOT.muted }}>{title}</span>
      <svg viewBox="0 0 110 110" className="h-24 w-24">
        <circle cx="55" cy="55" r={R} fill="none" stroke={FOT.away} strokeOpacity="0.7" strokeWidth="11" />
        <circle
          cx="55"
          cy="55"
          r={R}
          fill="none"
          stroke={FOT.home}
          strokeWidth="11"
          strokeLinecap="butt"
          strokeDasharray={`${homeLen} ${CIRC - homeLen}`}
          transform="rotate(-90 55 55)"
        />
        <text x="55" y="50" textAnchor="middle" fontSize="20" fontWeight="800" fill={FOT.ink} className="tabular-nums">
          {homePct}
        </text>
        <text x="55" y="68" textAnchor="middle" fontSize="12" fontWeight="700" fill={FOT.muted} className="tabular-nums">
          {awayPct}
        </text>
      </svg>
      <figcaption className="flex gap-2 text-[11px]" style={{ color: FOT.muted }}>
        <span className="font-semibold" style={{ color: FOT.ink }}>{homePct} {homeName}</span>
        <span style={{ color: FOT.muted, opacity: 0.5 }}>|</span>
        <span style={{ color: FOT.muted }}>{awayPct} {awayName}</span>
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
    <section
      className={cn("rounded-2xl border p-3", className)}
      style={{ backgroundColor: FOT.card, borderColor: FOT.border }}
      aria-label="Pression live vs attendue"
      title="Pression = pondération attacks (0.35) + dangerous attacks (0.40) + possession (0.15) + tirs (0.10) sur 10 minutes glissantes"
    >
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
            <div className="flex flex-col items-center gap-1 text-[11px]" style={{ color: FOT.muted }}>
              <span>vs</span>
              {anomaly && (
                <span className="tabular-nums font-bold" style={{ color: anomaly.delta >= 0 ? FOT.live : FOT.muted }}>
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
        <div className="mt-2 flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold" style={{ borderColor: "#f5c518", backgroundColor: "#fff8e1", color: FOT.ink }}>
          <Flame className="h-3.5 w-3.5 shrink-0 animate-pulse" aria-hidden="true" style={{ color: "#b7791f" }} />
          Anomalie : {homeName} domine {live.homePct}% en live contre {avg?.homePct}% attendu — signal live à surveiller
        </div>
      )}
      {anomaly?.kind === "favorite_domination" && (
        <div className="mt-2 flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold" style={{ borderColor: `${FOT.live}55`, backgroundColor: FOT.liveSoft, color: FOT.ink }}>
          <Crown className="h-3.5 w-3.5 shrink-0" aria-hidden="true" style={{ color: FOT.live }} />
          Domination confirmée : {live.homePct >= 50 ? homeName : awayName} verrouille le jeu ({Math.max(live.homePct, live.awayPct)}% de pression)
        </div>
      )}
    </section>
  );
}
