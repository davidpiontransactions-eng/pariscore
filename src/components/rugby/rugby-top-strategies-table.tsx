"use client";

import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import type { RugbyStrategyKey } from "@/lib/rugby-strategy-top";
import type { RugbyStrategyMatch } from "@/lib/rugby-strategy-top";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Teintes FotMob clair — identiques au football                       */
/* ------------------------------------------------------------------ */

const C = {
  card: "#ffffff",
  cardBorder: "#f0f0f0",
  rowSep: "#f5f5f5",
  headerBg: "#f5f5f5",
  headerText: "#000000",
  team: "#222222",
  time: "#717171",
  live: "#00985f",
  accent: "#00985f",
  score: "#222222",
} as const;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function parisKickoff(iso: string): string {
  if (!iso) return "--:--";
  try {
    return new Date(iso).toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Paris",
    });
  } catch {
    return "--:--";
  }
}

function parisDateShort(iso: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      timeZone: "Europe/Paris",
    });
  } catch {
    return "";
  }
}

function kickoffLabel(iso: string): string {
  const d = parisDateShort(iso);
  const h = parisKickoff(iso);
  if (!d && (!h || h === "--:--")) return iso;
  return `${d} · ${h}`;
}

function confidenceBand(probPct: number): { label: string; cls: string } {
  if (probPct >= 70)
    return {
      label: "Élevée",
      cls: "bg-[#00985f]/10 text-[#00985f] border-[#00985f]/20",
    };
  if (probPct >= 60)
    return {
      label: "Moyenne",
      cls: "bg-[#FF6D00]/10 text-[#FF6D00] border-[#FF6D00]/20",
    };
  return {
    label: "Faible",
    cls: "bg-[#f0f0f0] text-[#717171] border-[#e0e0e0]",
  };
}

function TrendIcon({ trend }: { trend?: "up" | "down" | "flat" }) {
  if (trend === "up") return <ArrowUp className="h-3 w-3 text-[#00985f]" />;
  if (trend === "down") return <ArrowDown className="h-3 w-3 text-[#EF4444]" />;
  return <Minus className="h-3 w-3 text-[#717171]" />;
}

/* ------------------------------------------------------------------ */
/* Format valeur par stratégie                                         */
/* ------------------------------------------------------------------ */

function formatValue(value: number, strategy: RugbyStrategyKey): string {
  switch (strategy) {
    case "homeWin":
    case "awayWin":
    case "over415":
    case "under515":
    case "handicapHome":
    case "handicapAway":
    case "bttsYes":
    case "marginBand":
      return `${value.toFixed(0)}%`;
    case "bestAttack":
      return `${value.toFixed(1)} pts`;
    case "bestDefense":
      return `${value.toFixed(1)} enc`;
  }
}

/** Pill over/under — ligne optimale ~60% proba (value pick) */
function OverUnderPill({ row, strategy }: { row: RugbyStrategyMatch; strategy: RugbyStrategyKey }) {
  if (strategy === "over415" && row.bestOverLine) {
    const { line, prob } = row.bestOverLine;
    return (
      <span
        className="ml-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold whitespace-nowrap"
        style={{
          background: "rgba(255, 109, 0, 0.15)",
          color: "#E65100",
          borderColor: "rgba(255, 109, 0, 0.30)",
        }}
      >
        🎯 Over {line.toFixed(1)}
        <span className="font-medium opacity-75">→ {(prob * 100).toFixed(0)}%</span>
      </span>
    );
  }
  if (strategy === "under515" && row.bestUnderLine) {
    const { line, prob } = row.bestUnderLine;
    return (
      <span
        className="ml-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold whitespace-nowrap"
        style={{
          background: "rgba(96, 165, 250, 0.15)",
          color: "#1D4ED8",
          borderColor: "rgba(96, 165, 250, 0.30)",
        }}
      >
        🎯 Under {line.toFixed(1)}
        <span className="font-medium opacity-75">→ {(prob * 100).toFixed(0)}%</span>
      </span>
    );
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Props                                                               */
/* ------------------------------------------------------------------ */

type Props = {
  rows: RugbyStrategyMatch[];
  strategy: RugbyStrategyKey;
  format: (v: number) => string;
  highlightId?: string | null;
};

/* ------------------------------------------------------------------ */
/* Composant                                                           */
/* ------------------------------------------------------------------ */

export function RugbyTopStrategiesTable({ rows, strategy, format, highlightId }: Props) {
  if (rows.length === 0) {
    return (
      <div
        className="rounded-2xl p-6 text-center text-sm"
        style={{
          background: C.card,
          border: `1px solid ${C.cardBorder}`,
          color: C.time,
        }}
      >
        Aucun match ne satisfait cette stratégie pour le moment.
      </div>
    );
  }

  return (
    <div
      className="overflow-hidden rounded-2xl"
      style={{ background: C.card, border: `1px solid ${C.cardBorder}` }}
    >
      {/* Header */}
      <div
        className="flex h-10 items-center px-4"
        style={{
          background: C.headerBg,
          borderBottom: `1px solid ${C.cardBorder}`,
        }}
      >
        <span className="text-[13px] font-semibold" style={{ color: C.headerText }}>
          Top {rows.length} matchs par stratégie
        </span>
        <span
          className="ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
          style={{ background: `${C.accent}15`, color: C.accent }}
        >
          {rows.length}
        </span>
      </div>

      <div className="w-full text-[13px]">
        {/* Header colonnes — desktop uniquement */}
        <div
          className="hidden items-center px-3 py-2 text-[11px] font-medium uppercase tracking-wider md:grid"
          style={{
            gridTemplateColumns: "minmax(0,1fr) auto minmax(90px,auto) 28px",
            color: C.time,
            borderBottom: `1px solid ${C.rowSep}`,
          }}
        >
          <span>Match</span>
          <span className="px-3">Valeur</span>
          <span className="px-3">Confiance</span>
          <span className="w-7 text-center">→</span>
        </div>

        {/* Lignes */}
        {rows.map((row, i) => {
          const band = row.probPct != null ? confidenceBand(row.probPct) : null;
          const highlighted = highlightId != null && row.matchId === highlightId;

          return (
            <div
              key={`${strategy}-${row.matchId}`}
              data-match-id={row.matchId}
              className={cn(
                "flex flex-col gap-1 px-3 py-2 transition-colors hover:bg-[#f8f8f8] md:grid md:items-center md:gap-0",
              )}
              style={{
                gridTemplateColumns: "minmax(0,1fr) auto minmax(90px,auto) 28px",
                borderBottom:
                  i < rows.length - 1 ? `1px solid ${C.rowSep}` : undefined,
                backgroundColor: highlighted ? `${C.accent}14` : undefined,
              }}
            >
              {/* Col 1 : Match + league + kickoff */}
              <div className="flex min-w-0 items-center gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1 truncate">
                    <span className="truncate text-[13px] font-medium" style={{ color: C.team }}>
                      {row.home.name}
                    </span>
                    <span className="shrink-0 text-[11px]" style={{ color: C.time }}>
                      vs
                    </span>
                    <span className="truncate text-[13px] font-medium" style={{ color: C.team }}>
                      {row.away.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px]" style={{ color: C.time }}>
                    <span className="capitalize">{row.competitionSlug.replace(/-/g, " ")}</span>
                    <span>·</span>
                    <span>{kickoffLabel(row.kickoff)}</span>
                  </div>
                </div>
              </div>

              {/* Col 2 : Valeur + pill over/under */}
              <div className="flex items-center justify-end gap-1.5 px-3 md:justify-center">
                <span
                  className="text-[14px] font-bold tabular-nums"
                  style={{ color: C.score }}
                >
                  {format(row.value)}
                </span>
                <OverUnderPill row={row} strategy={strategy} />
              </div>

              {/* Col 3 : Confiance badge */}
              <div className="flex items-center justify-end px-3 md:justify-center">
                {band && (
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
                      band.cls,
                    )}
                  >
                    {band.label}
                  </span>
                )}
              </div>

              {/* Col 4 : Trend */}
              <div className="flex w-7 items-center justify-center">
                <TrendIcon trend="flat" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
