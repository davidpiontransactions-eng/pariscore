"use client";

import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import type { StrategyTop5Key } from "@/lib/football-strategy-top5";
import type { MatchPick } from "@/lib/services/football-analytics";

export type StrategyTableRow = {
  matchId: string;
  league?: string | null;
  leagueLogo?: string | null;
  kickoff: string;
  home: { teamName: string; logo?: string };
  away: { teamName: string; logo?: string };
  value: number;
  odds?: number | null;
  trend?: "up" | "down" | "flat";
};

type Props = {
  rows: StrategyTableRow[];
  strategy: StrategyTop5Key;
  picksByMatch?: Record<string, MatchPick[]>;
};

/* Teintes FotMob clair — identiques au calendrier (fotmob-calendar-table.tsx) */
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

function confidenceBand(prob: number): { label: string; cls: string } {
  if (prob >= 0.7) return { label: "Élevée", cls: "bg-[#00985f]/10 text-[#00985f] border-[#00985f]/20" };
  if (prob >= 0.6) return { label: "Moyenne", cls: "bg-[#FF6D00]/10 text-[#FF6D00] border-[#FF6D00]/20" };
  return { label: "Faible", cls: "bg-[#f0f0f0] text-[#717171] border-[#e0e0e0]" };
}

function TrendIcon({ trend }: { trend?: "up" | "down" | "flat" }) {
  if (trend === "up") return <ArrowUp className="h-3 w-3 text-[#00985f]" />;
  if (trend === "down") return <ArrowDown className="h-3 w-3 text-[#EF4444]" />;
  return <Minus className="h-3 w-3 text-[#717171]" />;
}

export function TopStrategiesTable({ rows, strategy, picksByMatch }: Props) {
  if (rows.length === 0) {
    return (
      <div
        className="rounded-2xl p-6 text-center text-sm"
        style={{ background: C.card, border: `1px solid ${C.cardBorder}`, color: C.time }}
      >
        Aucun match ne satisfait cette stratégie aujourd'hui.
      </div>
    );
  }

  return (
    <div
      className="overflow-hidden rounded-2xl"
      style={{ background: C.card, border: `1px solid ${C.cardBorder}` }}
    >
      {/* Header — même style que FotmobLeagueSection header */}
      <div
        className="flex h-10 items-center px-4"
        style={{ background: C.headerBg, borderBottom: `1px solid ${C.cardBorder}` }}
      >
        <span className="text-[13px] font-semibold" style={{ color: C.headerText }}>
          Matchs par stratégie
        </span>
        <span
          className="ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
          style={{ background: `${C.accent}15`, color: C.accent }}
        >
          {rows.length}
        </span>
      </div>

      {/* Table — CSS Grid 5 colonnes comme le calendrier */}
      <div className="w-full text-[13px]">
        {/* Header colonnes */}
        <div
          className="grid items-center px-3 py-2 text-[11px] font-medium uppercase tracking-wider"
          style={{
            gridTemplateColumns: "1fr auto auto 1fr auto",
            color: C.time,
            borderBottom: `1px solid ${C.rowSep}`,
          }}
        >
          <span>Match</span>
          <span className="px-3">Prob.</span>
          <span className="px-3">Cote</span>
          <span className="px-3">EV</span>
          <span className="w-7 text-center">→</span>
        </div>

        {/* Lignes */}
        {rows.map((row, i) => {
          const picks = picksByMatch?.[row.matchId] ?? [];
          const topPick = picks[0];
          const band = topPick ? confidenceBand(topPick.prob) : null;
          return (
            <div
              key={row.matchId}
              className="grid items-center px-3 py-2 transition-colors hover:bg-[#f8f8f8]"
              style={{
                gridTemplateColumns: "1fr auto auto 1fr auto",
                borderBottom: i < rows.length - 1 ? `1px solid ${C.rowSep}` : undefined,
              }}
            >
              {/* Col 1 : Match */}
              <div className="flex items-center gap-2 min-w-0">
                {row.leagueLogo && (
                  <img src={row.leagueLogo} alt="" className="h-4 w-4 rounded object-contain shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="truncate font-medium" style={{ color: C.team }}>
                    {row.home.teamName}{" "}
                    <span style={{ color: C.time }}>vs</span>{" "}
                    {row.away.teamName}
                  </div>
                  <div className="text-[11px] truncate" style={{ color: C.time }}>
                    {row.league} · {row.kickoff}
                  </div>
                </div>
              </div>

              {/* Col 2 : Probabilité */}
              <div className="px-3">
                {band && (
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                      band.cls,
                    )}
                  >
                    {Math.round(topPick.prob * 100)}%
                  </span>
                )}
              </div>

              {/* Col 3 : Cote */}
              <div className="px-3 font-mono text-[13px]" style={{ color: C.score }}>
                {row.odds != null ? row.odds.toFixed(2) : "—"}
              </div>

              {/* Col 4 : EV */}
              <div className="px-3">
                {topPick?.ev != null ? (
                  <span
                    className="font-mono text-[12px]"
                    style={{ color: topPick.ev > 0 ? C.accent : "#EF4444" }}
                  >
                    {topPick.ev > 0 ? "+" : ""}
                    {(topPick.ev * 100).toFixed(1)}%
                  </span>
                ) : (
                  <span className="text-[12px]" style={{ color: C.time }}>—</span>
                )}
              </div>

              {/* Col 5 : Tendance */}
              <div className="w-7 flex justify-center">
                <TrendIcon trend={row.trend} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
