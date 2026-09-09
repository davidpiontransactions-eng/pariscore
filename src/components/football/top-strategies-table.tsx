import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import type { StrategyTop5Key } from "@/lib/football-strategy-top5";
import { parisDateShort, parisKickoff } from "@/lib/football-time";

export type StrategyTableRow = {
  matchId: string;
  league?: string | null;
  leagueLogo?: string | null;
  kickoff: string;
  home: { teamName: string; logo?: string };
  away: { teamName: string; logo?: string };
  /** Valeur brute scorée par le moteur (unité = stratégie). */
  value: number;
  /** Valeur formatée par la stratégie (ex. "78%", "2,8 buts", "0,9 enc"). */
  display: string;
  /** Probabilité 0-100 pour le badge, null si la stratégie n'est pas une proba. */
  probPct: number | null;
  /** Cote BSD pertinente pour la stratégie (null si absente). */
  odds?: number | null;
  /** Libellé de la cote (ex. "1", "N", "Over 1,5"). */
  oddsLabel?: string | null;
  trend?: "up" | "down" | "flat";
};

type Props = {
  rows: StrategyTableRow[];
  strategy: StrategyTop5Key;
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

function confidenceBand(probPct: number): { label: string; cls: string } {
  if (probPct >= 70) return { label: "Élevée", cls: "bg-[#00985f]/10 text-[#00985f] border-[#00985f]/20" };
  if (probPct >= 60) return { label: "Moyenne", cls: "bg-[#FF6D00]/10 text-[#FF6D00] border-[#FF6D00]/20" };
  return { label: "Faible", cls: "bg-[#f0f0f0] text-[#717171] border-[#e0e0e0]" };
}

function TrendIcon({ trend }: { trend?: "up" | "down" | "flat" }) {
  if (trend === "up") return <ArrowUp className="h-3 w-3 text-[#00985f]" />;
  if (trend === "down") return <ArrowDown className="h-3 w-3 text-[#EF4444]" />;
  return <Minus className="h-3 w-3 text-[#717171]" />;
}

function kickoffLabel(iso: string): string {
  const d = parisDateShort(iso);
  const h = parisKickoff(iso);
  if (!d && (!h || h === "--:--")) return iso;
  return `${d} · ${h}`;
}

export function TopStrategiesTable({ rows, strategy }: Props) {
  if (rows.length === 0) {
    return (
      <div
        className="rounded-2xl p-6 text-center text-sm"
        style={{ background: C.card, border: `1px solid ${C.cardBorder}`, color: C.time }}
      >
        Aucun match ne satisfait cette stratégie aujourd&apos;hui.
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
          <span className="px-3">Cote</span>
          <span className="w-7 text-center">→</span>
        </div>

        {/* Lignes — carte empilée sur mobile, grille sur desktop */}
        {rows.map((row, i) => {
          const band = row.probPct != null ? confidenceBand(row.probPct) : null;
          return (
            <div
              key={`${strategy}-${row.matchId}`}
              className="flex flex-col gap-1 px-3 py-2 transition-colors hover:bg-[#f8f8f8] md:grid md:items-center md:gap-0"
              style={{
                gridTemplateColumns: "minmax(0,1fr) auto minmax(90px,auto) 28px",
                borderBottom: i < rows.length - 1 ? `1px solid ${C.rowSep}` : undefined,
              }}
            >
              {/* Match */}
              <div className="flex min-w-0 items-center gap-2">
                {row.leagueLogo && (
                  <img src={row.leagueLogo} alt="" className="h-4 w-4 shrink-0 rounded object-contain" />
                )}
                <div className="min-w-0">
                  <div className="truncate font-medium" style={{ color: C.team }}>
                    {row.home.teamName}{" "}
                    <span style={{ color: C.time }}>vs</span>{" "}
                    {row.away.teamName}
                  </div>
                  <div className="truncate text-[11px]" style={{ color: C.time }}>
                    {row.league} · {kickoffLabel(row.kickoff)}
                  </div>
                </div>
              </div>

              {/* Valeur — vraie valeur moteur, jamais un λ figé */}
              <div className="px-0 md:px-3">
                {band ? (
                  <span
                    title={`Confiance ${band.label}`}
                    className={cn(
                      "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums",
                      band.cls,
                    )}
                  >
                    {row.display}
                  </span>
                ) : (
                  <span
                    className="inline-flex items-center rounded-full border border-[#e0e0e0] bg-[#f5f5f5] px-2 py-0.5 text-[11px] font-semibold tabular-nums"
                    style={{ color: C.team }}
                  >
                    {row.display}
                  </span>
                )}
              </div>

              {/* Cote enrichie */}
              <div className="px-0 md:px-3">
                {row.odds != null ? (
                  <span className="font-mono text-[13px] tabular-nums" style={{ color: C.score }}>
                    {row.odds.toFixed(2)}
                    {row.oddsLabel && (
                      <span className="ml-1 font-sans text-[10px]" style={{ color: C.time }}>
                        {row.oddsLabel}
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="text-[12px]" style={{ color: C.time }}>—</span>
                )}
              </div>

              {/* Tendance */}
              <div className="hidden w-7 justify-center md:flex">
                <TrendIcon trend={row.trend} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
