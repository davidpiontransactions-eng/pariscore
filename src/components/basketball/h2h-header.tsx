"use client";

import { cn } from "@/lib/utils";
import type { H2HSplit } from "@/lib/types/basketball-h2h";

type H2HHeaderProps = {
  teamAName: string;
  teamAAbr: string;
  teamALogo: string | null;
  teamBName: string;
  teamBAbr: string;
  teamBLogo: string | null;
  split: H2HSplit | null;
  formA: ("W" | "L")[];
  formB: ("W" | "L")[];
  netRatingA: number | null;
  netRatingB: number | null;
  className?: string;
};

/** Badge forme : code couleur selon netRating. */
function FormBadge({ netRating }: { netRating: number | null }) {
  if (netRating === null) return null;
  const rounded = Math.round(netRating * 10) / 10;
  let label: string;
  let colorClass: string;

  if (rounded >= 8) {
    label = "Forme excellente";
    colorClass = "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
  } else if (rounded >= 4) {
    label = "Bonne forme";
    colorClass = "bg-emerald-500/10 text-emerald-400/80 border-emerald-500/20";
  } else if (rounded >= -4) {
    label = "Neutre";
    colorClass = "bg-muted text-muted-foreground border-border";
  } else if (rounded >= -8) {
    label = "Mauvaise forme";
    colorClass = "bg-red-500/10 text-red-400/80 border-red-500/20";
  } else {
    label = "Forme très mauvaise";
    colorClass = "bg-red-500/20 text-red-400 border-red-500/30";
  }

  return (
    <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-mono ${colorClass}`}>
      <span className="font-bold">{rounded > 0 ? "+" : ""}{rounded}</span>
      <span className="hidden sm:inline">{label}</span>
    </span>
  );
}

/** Pastille W/L individuelle. */
function FormDot({ result }: { result: "W" | "L" }) {
  return (
    <span
      className={`inline-block h-4 w-4 rounded-full text-[9px] font-bold leading-4 text-center ${
        result === "W"
          ? "bg-emerald-500/20 text-emerald-400"
          : "bg-red-500/20 text-red-400"
      }`}
    >
      {result}
    </span>
  );
}

/** Barre de split H2H proportionnelle. */
function SplitBar({ split }: { split: H2HSplit }) {
  const aPct = split.aPct ?? 50;
  const bPct = split.bPct ?? 50;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground mb-1">
        <span className="font-bold text-foreground">{aPct.toFixed(1)}%</span>
        <span className="text-[9px]">H2H · {split.total} matchs</span>
        <span className="font-bold text-foreground">{bPct.toFixed(1)}%</span>
      </div>
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="bg-primary transition-all duration-300"
          style={{ width: `${aPct}%` }}
        />
        <div
          className="bg-muted-foreground/40 transition-all duration-300"
          style={{ width: `${bPct}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-[10px] font-mono mt-0.5">
        <span>{split.aWins}V</span>
        <span>{split.bWins}V</span>
      </div>
    </div>
  );
}

export function H2HHeader({
  teamAName,
  teamAAbr,
  teamALogo,
  teamBName,
  teamBAbr,
  teamBLogo,
  split,
  formA,
  formB,
  netRatingA,
  netRatingB,
  className,
}: H2HHeaderProps) {
  // Verdict
  const verdict =
    split && split.aWins !== split.bWins
      ? split.aWins > split.bWins
        ? `${teamAName} domine le H2H (${split.aWins}-${split.bWins})`
        : `${teamBName} domine le H2H (${split.bWins}-${split.aWins})`
      : split
        ? `Équilibré (${split.aWins}-${split.bWins})`
        : "Pas d'historique suffisant";

  return (
    <div className={cn("rounded-lg border bg-card p-4 space-y-3", className)}>
      {/* Teams row */}
      <div className="flex items-center justify-between gap-4">
        {/* Team A */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {teamALogo && (
            <img src={teamALogo} alt="" className="h-10 w-10 object-contain shrink-0" />
          )}
          <div className="min-w-0">
            <div className="text-sm font-bold truncate">{teamAName}</div>
            <div className="text-[10px] text-muted-foreground font-mono">{teamAAbr}</div>
          </div>
        </div>

        {/* VS */}
        <div className="text-xs font-bold text-muted-foreground shrink-0">VS</div>

        {/* Team B */}
        <div className="flex items-center gap-3 min-w-0 flex-1 justify-end">
          <div className="min-w-0 text-right">
            <div className="text-sm font-bold truncate">{teamBName}</div>
            <div className="text-[10px] text-muted-foreground font-mono">{teamBAbr}</div>
          </div>
          {teamBLogo && (
            <img src={teamBLogo} alt="" className="h-10 w-10 object-contain shrink-0" />
          )}
        </div>
      </div>

      {/* Form badges */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <FormBadge netRating={netRatingA} />
          <div className="flex gap-1 mt-1">
            {formA.map((r, i) => (
              <FormDot key={`a-${i}`} result={r} />
            ))}
          </div>
        </div>
        <div className="flex-1 text-right">
          <FormBadge netRating={netRatingB} />
          <div className="flex gap-1 mt-1 justify-end">
            {formB.map((r, i) => (
              <FormDot key={`b-${i}`} result={r} />
            ))}
          </div>
        </div>
      </div>

      {/* Split bar */}
      {split && <SplitBar split={split} />}

      {/* Verdict */}
      <p className="text-[11px] text-muted-foreground text-center italic">{verdict}</p>
    </div>
  );
}
