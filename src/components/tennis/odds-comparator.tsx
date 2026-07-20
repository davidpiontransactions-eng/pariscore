"use client";

import { useState } from "react";
import { ArrowUpDown, TrendingUp, Award } from "lucide-react";
import { useTranslations } from "next-intl";
import type { BookmakerOdd } from "@/lib/tennis-data";
import { cn } from "@/lib/utils";

type Props = {
  odds: BookmakerOdd[];
  playerAName: string;
  playerBName: string;
  modelProbA: number; // 0-100, our model's probability
  onBookmakerClick?: (bookmaker: string) => void;
};

type SortKey = "bookmaker" | "decimalA" | "decimalB" | "margin";

export function OddsComparator({
  odds,
  playerAName,
  playerBName,
  modelProbA,
  onBookmakerClick,
}: Props) {
  const t = useTranslations("detail");
  const [sortKey, setSortKey] = useState<SortKey>("decimalA");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sorted = [...odds].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    if (sortKey === "bookmaker") return a.bookmaker.localeCompare(b.bookmaker) * dir;
    return (a[sortKey] - b[sortKey]) * dir;
  });

  const bestA = Math.max(...odds.map((o) => o.decimalA));
  const bestB = Math.max(...odds.map((o) => o.decimalB));
  const bestBookmakerA = odds.find((o) => o.decimalA === bestA)?.bookmaker;
  const bestBookmakerB = odds.find((o) => o.decimalB === bestB)?.bookmaker;

  // Value bet indicator: our model says probA% but bookmaker implies less → value
  const valueBetsA = odds.filter((o) => o.impliedProbA < modelProbA - 2);
  const valueBetsB = odds.filter((o) => o.impliedProbB < 100 - modelProbA - 2);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "bookmaker" ? "asc" : "desc");
    }
  };

  const playerALast = playerAName.split(" ").slice(-1)[0] ?? playerAName;
  const playerBLast = playerBName.split(" ").slice(-1)[0] ?? playerBName;

  return (
    <div className="space-y-3">
      {/* Value bet callout */}
      {(valueBetsA.length > 0 || valueBetsB.length > 0) && (
        <div className="flex flex-wrap items-start gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3 text-xs">
          <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div className="flex-1">
            <p className="font-semibold text-emerald-700 dark:text-emerald-300">
              {t("valueBet")}
            </p>
            <p className="mt-0.5 text-muted-foreground">
              {t("valueBetText", { player: playerAName, prob: modelProbA })}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {valueBetsA.length > 0 && (
                <span className="rounded-md bg-emerald-600/10 px-2 py-0.5 text-emerald-700 dark:text-emerald-300">
                  {valueBetsA.length > 1
                    ? t("valueBetCountPlural", { player: playerAName, n: valueBetsA.length })
                    : t("valueBetCount", { player: playerAName, n: valueBetsA.length })}
                </span>
              )}
              {valueBetsB.length > 0 && (
                <span className="rounded-md bg-emerald-600/10 px-2 py-0.5 text-emerald-700 dark:text-emerald-300">
                  {valueBetsB.length > 1
                    ? t("valueBetCountPlural", { player: playerBName, n: valueBetsB.length })
                    : t("valueBetCount", { player: playerBName, n: valueBetsB.length })}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Best odds summary */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-border/60 bg-muted/30 p-2.5">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Award className="h-3 w-3" />
            {t("bestOdd", { player: playerALast })}
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="font-mono text-lg font-bold tabular-nums text-foreground">
              {bestA.toFixed(2)}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {t("bestOddAt", { bookmaker: bestBookmakerA ?? "" })}
            </span>
          </div>
        </div>
        <div className="rounded-lg border border-border/60 bg-muted/30 p-2.5">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Award className="h-3 w-3" />
            {t("bestOdd", { player: playerBLast })}
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="font-mono text-lg font-bold tabular-nums text-foreground">
              {bestB.toFixed(2)}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {t("bestOddAt", { bookmaker: bestBookmakerB ?? "" })}
            </span>
          </div>
        </div>
      </div>

      {/* Sortable odds table */}
      <div className="overflow-hidden rounded-lg border border-border/60">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
              <Th onClick={() => toggleSort("bookmaker")} active={sortKey === "bookmaker"} dir={sortDir}>
                {t("bookmaker")}
              </Th>
              <Th onClick={() => toggleSort("decimalA")} active={sortKey === "decimalA"} dir={sortDir} align="right">
                {playerALast}
              </Th>
              <Th onClick={() => toggleSort("decimalB")} active={sortKey === "decimalB"} dir={sortDir} align="right">
                {playerBLast}
              </Th>
              <Th onClick={() => toggleSort("margin")} active={sortKey === "margin"} dir={sortDir} align="right">
                {t("margin")}
              </Th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((o, i) => (
              <tr
                key={o.bookmaker}
                className={cn(
                  "border-t border-border/40 transition-colors hover:bg-muted/30",
                  i % 2 === 1 && "bg-muted/10"
                )}
              >
                <td className="px-3 py-2 font-medium">{o.bookmaker}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">
                  <span
                    className={cn(
                      o.decimalA === bestA && "font-bold text-emerald-600 dark:text-emerald-400"
                    )}
                  >
                    {o.decimalA.toFixed(2)}
                  </span>
                  {o.decimalA === bestA && (
                    <span className="ml-1 text-[9px] uppercase text-emerald-600 dark:text-emerald-400">
                      {t("best")}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">
                  <span
                    className={cn(
                      o.decimalB === bestB && "font-bold text-emerald-600 dark:text-emerald-400"
                    )}
                  >
                    {o.decimalB.toFixed(2)}
                  </span>
                  {o.decimalB === bestB && (
                    <span className="ml-1 text-[9px] uppercase text-emerald-600 dark:text-emerald-400">
                      {t("best")}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground tabular-nums">
                  {(o.margin * 100).toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-muted-foreground">
        {t("tableHint")}
      </p>
    </div>
  );
}

function Th({
  children,
  onClick,
  active,
  dir,
  align = "left",
}: {
  children: React.ReactNode;
  onClick: () => void;
  active: boolean;
  dir: "asc" | "desc";
  align?: "left" | "right";
}) {
  // Phase 4.D — a11y fix: <th onClick> alone is not keyboard accessible.
  // We add aria-sort (WCAG 1.3.1), role="button" + tabIndex=0 + onKeyDown
  // so screen readers announce sort state and keyboard users can trigger it.
  const ariaSort: "ascending" | "descending" | "none" = active
    ? dir === "asc"
      ? "ascending"
      : "descending"
    : "none";

  return (
    <th
      aria-sort={ariaSort}
      scope="col"
      className={cn(
        "px-3 py-2 font-semibold",
        align === "right" && "text-right",
      )}
    >
      <button
        type="button"
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick();
          }
        }}
        aria-label={
          ariaSort === "none"
            ? `Trier par ${typeof children === "string" ? children : "colonne"}`
            : `Trier par ${typeof children === "string" ? children : "colonne"} (actuellement ${dir === "asc" ? "croissant" : "décroissant"})`
        }
        className={cn(
          "inline-flex items-center gap-1 select-none transition-colors hover:text-foreground",
          "cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background rounded",
          align === "right" && "flex-row-reverse",
        )}
      >
        {children}
        <ArrowUpDown
          className={cn(
            "h-3 w-3 transition-opacity",
            active ? "opacity-100" : "opacity-30"
          )}
          style={{ transform: active && dir === "asc" ? "rotate(180deg)" : undefined }}
        />
      </button>
    </th>
  );
}
