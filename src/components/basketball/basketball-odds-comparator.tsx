"use client";

import { useState } from "react";
import { ArrowUpDown, TrendingUp, Award } from "lucide-react";
import type { BasketballBookmakerOdd } from "@/lib/basketball-odds";
import { cn } from "@/lib/utils";

type Props = {
  odds: BasketballBookmakerOdd[];
  homeName: string;
  awayName: string;
  modelProbHome?: number | null;
  onBookmakerClick?: (bookmaker: string) => void;
};

type SortKey = "bookmaker" | "mlHome" | "mlAway" | "spreadHome" | "total" | "margin";

export function BasketballOddsComparator({
  odds,
  homeName,
  awayName,
  modelProbHome,
  onBookmakerClick,
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("mlHome");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  if (odds.length === 0) return null;

  const sorted = [...odds].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    if (sortKey === "bookmaker") return a.bookmaker.localeCompare(b.bookmaker) * dir;
    const aVal = a[sortKey] ?? 0;
    const bVal = b[sortKey] ?? 0;
    return (aVal - bVal) * dir;
  });

  // Best odds
  const bestMlHome = Math.max(...odds.map((o) => o.mlHome ?? -9999));
  const bestMlAway = Math.max(...odds.map((o) => o.mlAway ?? -9999));
  const bestBookmakerHome = odds.find((o) => o.mlHome === bestMlHome)?.bookmaker;
  const bestBookmakerAway = odds.find((o) => o.mlAway === bestMlAway)?.bookmaker;

  // Value detection
  const valueHome =
    modelProbHome != null
      ? odds.filter((o) => o.impliedHome != null && modelProbHome > o.impliedHome + 2)
      : [];
  const valueAway =
    modelProbHome != null
      ? odds.filter((o) => o.impliedAway != null && 100 - modelProbHome > o.impliedAway + 2)
      : [];

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "bookmaker" ? "asc" : "desc");
    }
  };

  const homeLast = homeName.split(" ").slice(-1)[0] ?? homeName;
  const awayLast = awayName.split(" ").slice(-1)[0] ?? awayName;

  return (
    <div className="space-y-3">
      {/* Value callout */}
      {(valueHome.length > 0 || valueAway.length > 0) && (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3 text-xs">
          <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div>
            <p className="font-semibold text-emerald-700 dark:text-emerald-300">
              Value Bet
            </p>
            {valueHome.length > 0 && (
              <span className="mt-1 inline-block rounded-md bg-emerald-600/10 px-2 py-0.5 text-emerald-700 dark:text-emerald-300">
                {homeName}: {valueHome.length} bookmaker{valueHome.length > 1 ? "s" : ""}
              </span>
            )}
            {valueAway.length > 0 && (
              <span className="mt-1 ml-1 inline-block rounded-md bg-emerald-600/10 px-2 py-0.5 text-emerald-700 dark:text-emerald-300">
                {awayName}: {valueAway.length} bookmaker{valueAway.length > 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Best odds summary */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border bg-muted/30 p-2.5">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Award className="h-3 w-3" />
            Best ML {homeLast}
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="font-mono text-lg font-bold tabular-nums">
              {bestMlHome > -9999 ? (bestMlHome > 0 ? "+" : "") + bestMlHome : "—"}
            </span>
            {bestBookmakerHome && (
              <span className="text-[11px] text-muted-foreground">
                {bestBookmakerHome}
              </span>
            )}
          </div>
        </div>
        <div className="rounded-lg border bg-muted/30 p-2.5">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Award className="h-3 w-3" />
            Best ML {awayLast}
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="font-mono text-lg font-bold tabular-nums">
              {bestMlAway > -9999 ? (bestMlAway > 0 ? "+" : "") + bestMlAway : "—"}
            </span>
            {bestBookmakerAway && (
              <span className="text-[11px] text-muted-foreground">
                {bestBookmakerAway}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Odds table */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/50 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
              <Th label="Bookmaker" sortKey="bookmaker" current={sortKey} dir={sortDir} onToggle={toggleSort} />
              <Th label="ML Home" sortKey="mlHome" current={sortKey} dir={sortDir} onToggle={toggleSort} alignRight />
              <Th label="ML Away" sortKey="mlAway" current={sortKey} dir={sortDir} onToggle={toggleSort} alignRight />
              <Th label="Spread" sortKey="spreadHome" current={sortKey} dir={sortDir} onToggle={toggleSort} alignRight />
              <Th label="Total" sortKey="total" current={sortKey} dir={sortDir} onToggle={toggleSort} alignRight />
              <Th label="Margin" sortKey="margin" current={sortKey} dir={sortDir} onToggle={toggleSort} alignRight />
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr
                key={row.bookmaker}
                className="border-b last:border-0 hover:bg-muted/30 cursor-pointer"
                onClick={() => onBookmakerClick?.(row.bookmaker)}
              >
                <td className="px-2 py-1.5 font-medium">{row.bookmaker}</td>
                <MlCell value={row.mlHome} isBest={row.mlHome === bestMlHome} implied={row.impliedHome} />
                <MlCell value={row.mlAway} isBest={row.mlAway === bestMlAway} implied={row.impliedAway} />
                <td className="px-2 py-1.5 text-right font-mono tabular-nums">
                  {row.spreadHome != null ? `${row.spreadHome > 0 ? "+" : ""}${row.spreadHome}` : "—"}
                </td>
                <td className="px-2 py-1.5 text-right font-mono tabular-nums">
                  {row.total != null ? row.total.toFixed(1) : "—"}
                </td>
                <td className="px-2 py-1.5 text-right font-mono tabular-nums text-muted-foreground">
                  {(row.margin * 100).toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({
  label,
  sortKey,
  current,
  dir,
  onToggle,
  alignRight,
}: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  dir: "asc" | "desc";
  onToggle: (key: SortKey) => void;
  alignRight?: boolean;
}) {
  const active = current === sortKey;
  return (
    <th
      className={cn(
        "px-2 py-1.5 cursor-pointer select-none",
        alignRight && "text-right",
      )}
      onClick={() => onToggle(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <ArrowUpDown
          className={cn(
            "h-3 w-3",
            active ? "text-foreground" : "text-muted-foreground/50",
          )}
        />
        {active && (
          <span className="text-[8px]">{dir === "asc" ? "▲" : "▼"}</span>
        )}
      </span>
    </th>
  );
}

function MlCell({
  value,
  isBest,
  implied,
}: {
  value: number | null;
  isBest: boolean;
  implied: number | null;
}) {
  return (
    <td className={cn("px-2 py-1.5 text-right font-mono tabular-nums", isBest && "font-bold text-emerald-600 dark:text-emerald-400")}>
      {value != null ? (
        <>
          <span>{value > 0 ? "+" : ""}{value}</span>
          {implied != null && (
            <span className="ml-1 text-[10px] text-muted-foreground">
              {implied.toFixed(1)}%
            </span>
          )}
        </>
      ) : (
        "—"
      )}
    </td>
  );
}
