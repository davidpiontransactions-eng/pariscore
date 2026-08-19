"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Home, PlaneTakeoff } from "lucide-react";
import type { TeamMetricStats, MetricValue } from "@/lib/football-data";

type CategoryKey = "general" | "goals" | "shots" | "attacks" | "corners" | "rankings";

const CATS: { key: CategoryKey; label: string }[] = [
  { key: "general", label: "Général" },
  { key: "goals", label: "Buts" },
  { key: "shots", label: "Tirs" },
  { key: "attacks", label: "Attaques" },
  { key: "corners", label: "Corners" },
  { key: "rankings", label: "Classements" },
];

/** Barre comparative bicolore avec valeurs gauche/droite + badges de rang. */
function MetricBar({
  label,
  homeValue,
  awayValue,
  rankTotal,
}: {
  label: string;
  homeValue: MetricValue;
  awayValue: MetricValue;
  rankTotal: number;
}) {
  const hv = homeValue.value;
  const av = awayValue.value;
  const bothReal = hv != null && av != null;
  const total = bothReal ? hv + av : 1;
  const hp = bothReal ? Math.max(2, Math.round((hv / total) * 100)) : 50;
  const ap = 100 - hp;

  const fmtRank = (rank: number | null) =>
    rank != null ? (
      <span className="ml-1 rounded bg-muted px-1 py-px text-[8px] tabular-nums text-muted-foreground">
        #{rank}/{rankTotal}
      </span>
    ) : null;

  const fmtVal = (v: number | null) => (v != null ? v.toFixed(v % 1 !== 0 ? 2 : 0) : "N/A");

  return (
    <div className="mb-px">
      <div className="flex items-center gap-1 px-2 py-1.5">
        <span className="w-[38%] text-right text-[11px] font-medium tabular-nums text-foreground">
          {fmtVal(hv)}{fmtRank(homeValue.rank)}
        </span>
        <div className="flex h-2 flex-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-emerald-500/70 transition-all" style={{ width: `${hp}%` }} />
          <div className="h-full bg-rose-500/70 transition-all" style={{ width: `${ap}%` }} />
        </div>
        <span className="w-[38%] text-[11px] font-medium tabular-nums text-foreground">
          {fmtVal(av)}{fmtRank(awayValue.rank)}
        </span>
      </div>
      <div className="flex justify-between px-2 text-[8px] text-muted-foreground/60">
        <span className="w-[38%] text-right">{label}</span>
        <span className="flex-1" />
        <span className="w-[38%] text-left">{label}</span>
      </div>
    </div>
  );
}

function PanelHeader({ partial }: { partial: boolean }) {
  return (
    <>
      <div className="flex items-center gap-1 px-2 pt-1 text-[8px] uppercase tracking-wide text-muted-foreground">
        <Home className="h-2.5 w-2.5 text-emerald-500" /> Dom. &nbsp;
        <PlaneTakeoff className="h-2.5 w-2.5 text-rose-500" /> Ext.
      </div>
      {partial && (
        <div className="mt-0.5 flex items-center gap-1 px-2 pb-1 text-[8px] text-muted-foreground">
          <span aria-hidden="true">⚠️</span> Données partielles (&lt; 3 matchs)
        </div>
      )}
    </>
  );
}

function renderBars(
  metrics: { label: string; homeVal: MetricValue; awayVal: MetricValue }[],
  rankTotal: number
) {
  return (
    <div className="divide-y divide-border/20">
      {metrics.map((m, i) => (
        <MetricBar key={i} label={m.label} homeValue={m.homeVal} awayValue={m.awayVal} rankTotal={rankTotal} />
      ))}
    </div>
  );
}

type Props = {
  home: TeamMetricStats;
  away: TeamMetricStats;
  partial: boolean;
  onRankingsTab?: () => void;
};

export function MetricComparePanel({ home, away, partial, onRankingsTab }: Props) {
  const [cat, setCat] = useState<CategoryKey>("goals");
  const rankTotal = home.goals.avg.rankTotal || 0;

  if (cat === "rankings") {
    onRankingsTab?.();
    return null;
  }

  const content = (() => {
    const r = (m: { label: string; homeVal: MetricValue; awayVal: MetricValue }[]) => renderBars(m, rankTotal);
    switch (cat) {
      case "general":
        return r([
          { label: "Buts marqués PG (PPG)", homeVal: home.goals.scoredPg, awayVal: away.goals.scoredPg },
          { label: "Buts encaissés PG", homeVal: home.goals.concededPg, awayVal: away.goals.concededPg },
          { label: "Moy. buts / match", homeVal: home.goals.avg, awayVal: away.goals.avg },
          { label: "Total buts marqués", homeVal: home.goals.scored, awayVal: away.goals.scored },
          { label: "Total buts encaissés", homeVal: home.goals.conceded, awayVal: away.goals.conceded },
        ]);
      case "goals":
        return r([
          { label: "Moy. buts", homeVal: home.goals.avg, awayVal: away.goals.avg },
          { label: "Buts marqués", homeVal: home.goals.scored, awayVal: away.goals.scored },
          { label: "Buts marqués PG", homeVal: home.goals.scoredPg, awayVal: away.goals.scoredPg },
          { label: "Buts encaissés", homeVal: home.goals.conceded, awayVal: away.goals.conceded },
          { label: "Buts encaissés PG", homeVal: home.goals.concededPg, awayVal: away.goals.concededPg },
        ]);
      case "shots":
        return r([
          { label: "Shots PG", homeVal: home.shots.total, awayVal: away.shots.total },
          { label: "Shots For PG", homeVal: home.shots.for, awayVal: away.shots.for },
          { label: "Shots Against PG", homeVal: home.shots.against, awayVal: away.shots.against },
          { label: "SOT PG", homeVal: home.sot.total, awayVal: away.sot.total },
          { label: "SOT For PG", homeVal: home.sot.for, awayVal: away.sot.for },
          { label: "SOT Against PG", homeVal: home.sot.against, awayVal: away.sot.against },
        ]);
      case "attacks":
        return r([
          { label: "Dang. Attacks PG", homeVal: home.attacks.total, awayVal: away.attacks.total },
          { label: "Dang. Attacks For PG", homeVal: home.attacks.for, awayVal: away.attacks.for },
          { label: "Dang. Attacks Against PG", homeVal: home.attacks.against, awayVal: away.attacks.against },
        ]);
      case "corners":
        return r([
          { label: "Corners PG", homeVal: home.corners.total, awayVal: away.corners.total },
          { label: "% +5.5 Corners", homeVal: home.corners.over55, awayVal: away.corners.over55 },
          { label: "% +6.5 Corners", homeVal: home.corners.over65, awayVal: away.corners.over65 },
          { label: "% +7.5 Corners", homeVal: home.corners.over75, awayVal: away.corners.over75 },
          { label: "% +8.5 Corners", homeVal: home.corners.over85, awayVal: away.corners.over85 },
          { label: "% +9.5 Corners", homeVal: home.corners.over95, awayVal: away.corners.over95 },
          { label: "% +10.5 Corners", homeVal: home.corners.over105, awayVal: away.corners.over105 },
        ]);
      default:
        return null;
    }
  })();

  return (
    <div className="mt-2 overflow-hidden rounded-lg border border-border/40">
      <div className="flex flex-wrap items-center gap-px border-b border-border/40 bg-muted/30 px-1 py-0.5">
        {CATS.map((c) => (
          <button
            key={c.key}
            onClick={() => setCat(c.key)}
            className={cn(
              "rounded px-2 py-0.5 text-[9px] font-medium transition-colors",
              cat === c.key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {c.label}
          </button>
        ))}
        <div className="ml-auto text-[8px] text-muted-foreground/50">Home / Away</div>
      </div>
      <PanelHeader partial={partial} />
      {content}
    </div>
  );
}

