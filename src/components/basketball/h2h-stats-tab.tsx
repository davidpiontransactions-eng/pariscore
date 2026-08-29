"use client";

import { cn } from "@/lib/utils";
import type {
  H2HDataPoints,
  TeamSeasonStats,
  TeamOverStats,
  TeamSpreadStats,
  MatchOverStats,
  BttsBlock,
  BttsScope,
} from "@/lib/types/basketball-h2h";
import { H2HDataPoints as H2HDataPointsTable } from "./h2h-data-points";
import { OverUnderTable } from "./over-under-table";

type H2HStatsTabProps = {
  dataPoints: H2HDataPoints;
  teamAAbr: string;
  teamBAbr: string;
  seasonStatsA: TeamSeasonStats;
  seasonStatsB: TeamSeasonStats;
  overStatsA: TeamOverStats;
  overStatsB: TeamOverStats;
  spreadStatsA: TeamSpreadStats;
  spreadStatsB: TeamSpreadStats;
  matchOver: MatchOverStats;
  btts: Record<BttsScope, BttsBlock>;
  className?: string;
};

function VenueRow({ label, data }: { label: string; data: { games: number; winPct: number | null; ppg: number | null; papg: number | null; avgMargin: number | null; leadAtHalfPct: number | null } | null }) {
  if (!data) {
    return (
      <tr className="border-b border-border/50">
        <td className="py-1 px-2 text-[10px] font-medium text-muted-foreground">{label}</td>
        <td colSpan={5} className="py-1 px-2 text-[10px] text-muted-foreground text-center">—</td>
      </tr>
    );
  }
  return (
    <tr className="border-b border-border/50 hover:bg-muted/50 transition-colors">
      <td className="py-1 px-2 text-[10px] font-medium text-muted-foreground">{label}</td>
      <td className="py-1 px-2 text-right font-mono text-[10px]">{data.games}</td>
      <td className="py-1 px-2 text-right font-mono text-[10px]">{data.winPct !== null ? `${(data.winPct * 100).toFixed(1)}%` : "—"}</td>
      <td className="py-1 px-2 text-right font-mono text-[10px]">{data.ppg?.toFixed(1) ?? "—"}</td>
      <td className="py-1 px-2 text-right font-mono text-[10px]">{data.papg?.toFixed(1) ?? "—"}</td>
      <td className="py-1 px-2 text-right font-mono text-[10px]">
        {data.avgMargin !== null ? (
          <span className={data.avgMargin > 0 ? "text-emerald-400" : data.avgMargin < 0 ? "text-red-400" : ""}>
            {data.avgMargin > 0 ? "+" : ""}{data.avgMargin.toFixed(1)}
          </span>
        ) : "—"}
      </td>
    </tr>
  );
}

function SeasonStatsCard({ abbr, stats }: { abbr: string; stats: TeamSeasonStats }) {
  return (
    <div className="overflow-x-auto">
      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 px-1">
        Stats Saison — {abbr}
      </div>
      {stats.form6.length > 0 && (
        <div className="flex gap-1 mb-2 px-1">
          <span className="text-[10px] text-muted-foreground mr-1">Forme:</span>
          {stats.form6.map((r, i) => (
            <span
              key={i}
              className={`inline-block h-4 w-4 rounded-full text-[9px] font-bold leading-4 text-center ${
                r === "W" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
              }`}
            >
              {r}
            </span>
          ))}
        </div>
      )}
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border">
            <th className="py-1 px-2 text-left text-[10px] font-medium text-muted-foreground">Venue</th>
            <th className="py-1 px-2 text-right text-[10px] font-medium text-muted-foreground">MJ</th>
            <th className="py-1 px-2 text-right text-[10px] font-medium text-muted-foreground">Win%</th>
            <th className="py-1 px-2 text-right text-[10px] font-medium text-muted-foreground">PPG</th>
            <th className="py-1 px-2 text-right text-[10px] font-medium text-muted-foreground">PAPG</th>
            <th className="py-1 px-2 text-right text-[10px] font-medium text-muted-foreground">NetRtg</th>
          </tr>
        </thead>
        <tbody>
          <VenueRow label="Overall" data={stats.overall} />
          <VenueRow label="Home" data={stats.home} />
          <VenueRow label="Away" data={stats.away} />
        </tbody>
      </table>
    </div>
  );
}

export function H2HStatsTab({
  dataPoints,
  teamAAbr,
  teamBAbr,
  seasonStatsA,
  seasonStatsB,
  overStatsA,
  overStatsB,
  spreadStatsA,
  spreadStatsB,
  matchOver,
  btts,
  className,
}: H2HStatsTabProps) {
  return (
    <div className={cn("space-y-4", className)}>
      {/* Data Points H2H */}
      <H2HDataPointsTable dataPoints={dataPoints} teamAAbr={teamAAbr} teamBAbr={teamBAbr} />

      {/* Stats Saison miroir */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SeasonStatsCard abbr={teamAAbr} stats={seasonStatsA} />
        <SeasonStatsCard abbr={teamBAbr} stats={seasonStatsB} />
      </div>

      {/* Over/Under Points Équipe — A */}
      <OverUnderTable
        title={`Points ${teamAAbr} — Over/Under`}
        data={overStatsA.points}
        col1Label="OVER"
        col2Label="%"
        tooltip={`Distribution des points marqués par ${teamAAbr} sur la saison. % de matchs au-dessus de chaque seuil. Le seuil "money" (ambre) = le plus proche de la moyenne (${overStatsA.avg?.toFixed(1) ?? "—"} pts).`}
      />

      {/* Over/Under Points Équipe — B */}
      <OverUnderTable
        title={`Points ${teamBAbr} — Over/Under`}
        data={overStatsB.points}
        col1Label="OVER"
        col2Label="%"
        tooltip={`Distribution des points marqués par ${teamBAbr} sur la saison. % de matchs au-dessus de chaque seuil. Le seuil "money" (ambre) = le plus proche de la moyenne (${overStatsB.avg?.toFixed(1) ?? "—"} pts).`}
      />

      {/* Quartiers A */}
      {overStatsA.quarters.map((q) => (
        <OverUnderTable
          key={`${teamAAbr}-${q.q}`}
          title={`${teamAAbr} ${q.q} Points O/U`}
          data={q}
          col1Label="OVER"
          col2Label="%"
        />
      ))}

      {/* Quartiers B */}
      {overStatsB.quarters.map((q) => (
        <OverUnderTable
          key={`${teamBAbr}-${q.q}`}
          title={`${teamBAbr} ${q.q} Points O/U`}
          data={q}
          col1Label="OVER"
          col2Label="%"
        />
      ))}

      {/* Mi-temps A */}
      {overStatsA.halves.map((h) => (
        <OverUnderTable
          key={`${teamAAbr}-${h.h}`}
          title={`${teamAAbr} ${h.h} Points O/U`}
          data={h}
          col1Label="OVER"
          col2Label="%"
        />
      ))}

      {/* Mi-temps B */}
      {overStatsB.halves.map((h) => (
        <OverUnderTable
          key={`${teamBAbr}-${h.h}`}
          title={`${teamBAbr} ${h.h} Points O/U`}
          data={h}
          col1Label="OVER"
          col2Label="%"
        />
      ))}

      {/* Point Spread A */}
      <OverUnderTable
        title={`Point Spread — ${teamAAbr} (Positive)`}
        data={{ avg: spreadStatsA.avgMargin, thresholds: spreadStatsA.positive }}
        col1Label="OVER"
        col2Label="%"
        tooltip={`Distribution de la marge de victoire de ${teamAAbr}. % de matchs gagnés avec au moins X points d'avance. Marge moyenne: ${spreadStatsA.avgMargin !== null ? (spreadStatsA.avgMargin > 0 ? "+" : "") + spreadStatsA.avgMargin.toFixed(1) : "—"}.`}
      />

      {/* Point Spread B */}
      <OverUnderTable
        title={`Point Spread — ${teamBAbr} (Positive)`}
        data={{ avg: spreadStatsB.avgMargin, thresholds: spreadStatsB.positive }}
        col1Label="OVER"
        col2Label="%"
        tooltip={`Distribution de la marge de victoire de ${teamBAbr}. % de matchs gagnés avec au moins X points d'avance. Marge moyenne: ${spreadStatsB.avgMargin !== null ? (spreadStatsB.avgMargin > 0 ? "+" : "") + spreadStatsB.avgMargin.toFixed(1) : "—"}.`}
      />

      {/* Match Over */}
      <OverUnderTable
        title="Match Points — Over"
        data={matchOver.thresholds}
        threeColumns
        col1Label="OVER"
        col2Label="%"
        tooltip={`Total combiné des points des 2 équipes. % de matchs où le total dépasse chaque seuil. Moyenne: ${matchOver.avgMatch?.toFixed(1) ?? "—"} pts.`}
      />

      {/* BTTS FT */}
      <OverUnderTable
        title="BTTS Points — Full Time"
        data={btts.ft.thresholds}
        threeColumns
        col1Label="BTTS"
        col2Label="%"
        tooltip="Both Teams To Score — % de matchs où les 2 équipes marquent au-dessus du seuil sur le match complet."
      />

      {/* BTTS Halves */}
      {(["h1", "h2"] as BttsScope[]).map((scope) => (
        <OverUnderTable
          key={`btts-${scope}`}
          title={`BTTS Points — ${scope.toUpperCase()}`}
          data={btts[scope].thresholds}
          threeColumns
          col1Label="BTTS"
          col2Label="%"
          tooltip={`Both Teams To Score — % de matchs où les 2 équipes marquent au-dessus du seuil sur la mi-temps ${scope === "h1" ? "1ère" : "2ème"}.`}
        />
      ))}

      {/* BTTS Quarters */}
      {(["q1", "q2", "q3", "q4"] as BttsScope[]).map((scope) => (
        <OverUnderTable
          key={`btts-${scope}`}
          title={`BTTS Points — ${scope.toUpperCase()}`}
          data={btts[scope].thresholds}
          threeColumns
          col1Label="BTTS"
          col2Label="%"
          tooltip={`Both Teams To Score — % de matchs où les 2 équipes marquent au-dessus du seuil sur le ${scope.toUpperCase()}.`}
        />
      ))}
    </div>
  );
}
