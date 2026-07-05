"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Scale, ArrowUpDown, Award, TrendingUp } from "lucide-react";
import { usePrematchMatches } from "@/hooks/use-prematch-matches";
import { cn } from "@/lib/utils";

let openFn: ((open: boolean) => void) | null = null;
export function openBookmakerComparatorDialog() {
  openFn?.(true);
}

type BookmakerAgg = {
  bookmaker: string;
  oddCount: number;
  totalMargin: number;
  bestCount: number;
  valueBetCount: number;
};

type ValueBet = {
  matchId: string;
  matchLabel: string;
  player: string;
  bookmaker: string;
  modelProba: number;
  impliedProba: number;
  edge: number;
  odd: number;
};

type MatchBestOdds = {
  matchId: string;
  matchLabel: string;
  bestA: { odd: number; bookmaker: string } | null;
  bestB: { odd: number; bookmaker: string } | null;
  minMargin: number;
  maxMargin: number;
  hasValueBet: boolean;
};

const VALUE_THRESHOLD = 3; // pp

export function BookmakerComparatorDialog() {
  const t = useTranslations("comparator");
  const { data } = usePrematchMatches();
  const [open, setOpen] = useState(false);
  const [sortKey, setSortKey] = useState<"bookmaker" | "avgMargin" | "bestCount" | "valueBetCount">("bestCount");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    openFn = setOpen;
    return () => {
      openFn = null;
    };
  }, []);

  const matches = data?.matches ?? [];

  // Aggregate by bookmaker
  const bookmakerAgg = useMemo<BookmakerAgg[]>(() => {
    const map = new Map<string, BookmakerAgg>();
    for (const m of matches) {
      if (!m.allOdds) continue;
      for (const o of m.allOdds) {
        const agg = map.get(o.bookmaker) ?? {
          bookmaker: o.bookmaker,
          oddCount: 0,
          totalMargin: 0,
          bestCount: 0,
          valueBetCount: 0,
        };
        agg.oddCount += 1;
        agg.totalMargin += o.margin;
        map.set(o.bookmaker, agg);
      }
    }
    // Count best odds
    for (const m of matches) {
      if (!m.allOdds || m.allOdds.length === 0) continue;
      const bestA = m.allOdds.reduce((max, o) => (o.decimalA > max.decimalA ? o : max));
      const bestB = m.allOdds.reduce((max, o) => (o.decimalB > max.decimalB ? o : max));
      const aggA = map.get(bestA.bookmaker);
      if (aggA) aggA.bestCount += 1;
      const aggB = map.get(bestB.bookmaker);
      if (aggB && bestB.bookmaker !== bestA.bookmaker) aggB.bestCount += 1;
    }
    // Count value bets
    for (const m of matches) {
      if (!m.allOdds) continue;
      for (const o of m.allOdds) {
        const edge = m.probA - o.impliedProbA;
        if (edge >= VALUE_THRESHOLD) {
          const agg = map.get(o.bookmaker);
          if (agg) agg.valueBetCount += 1;
        }
      }
    }
    const result = [...map.values()].map((a) => ({
      ...a,
      avgMargin: a.totalMargin / a.oddCount,
    }));
    return result;
  }, [matches]);

  // Best odds per match
  const matchBestOdds = useMemo<MatchBestOdds[]>(() => {
    return matches
      .filter((m) => m.allOdds && m.allOdds.length > 0)
      .map((m) => {
        const odds = m.allOdds!;
        const bestA = odds.reduce((max, o) => (o.decimalA > max.decimalA ? o : max));
        const bestB = odds.reduce((max, o) => (o.decimalB > max.decimalB ? o : max));
        const margins = odds.map((o) => o.margin);
        const hasValueBet = odds.some((o) => m.probA - o.impliedProbA >= VALUE_THRESHOLD);
        return {
          matchId: m.id,
          matchLabel: `${m.playerA.shortName} vs ${m.playerB.shortName}`,
          bestA: { odd: bestA.decimalA, bookmaker: bestA.bookmaker },
          bestB: { odd: bestB.decimalB, bookmaker: bestB.bookmaker },
          minMargin: Math.min(...margins),
          maxMargin: Math.max(...margins),
          hasValueBet,
        };
      });
  }, [matches]);

  // All value bets
  const valueBets = useMemo<ValueBet[]>(() => {
    const result: ValueBet[] = [];
    for (const m of matches) {
      if (!m.allOdds) continue;
      for (const o of m.allOdds) {
        const edge = m.probA - o.impliedProbA;
        if (edge >= VALUE_THRESHOLD) {
          result.push({
            matchId: m.id,
            matchLabel: `${m.playerA.shortName} vs ${m.playerB.shortName}`,
            player: m.playerA.name,
            bookmaker: o.bookmaker,
            modelProba: m.probA,
            impliedProba: o.impliedProbA,
            edge: Math.round(edge * 10) / 10,
            odd: o.decimalA,
          });
        }
      }
    }
    return result.sort((a, b) => b.edge - a.edge);
  }, [matches]);

  const sortedAgg = useMemo(() => {
    const arr = [...bookmakerAgg];
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      if (sortKey === "bookmaker") return a.bookmaker.localeCompare(b.bookmaker) * dir;
      const av = sortKey === "avgMargin" ? a.avgMargin : a[sortKey];
      const bv = sortKey === "avgMargin" ? b.avgMargin : b[sortKey];
      return (av - bv) * dir;
    });
    return arr;
  }, [bookmakerAgg, sortKey, sortDir]);

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "bookmaker" ? "asc" : "desc");
    }
  };

  const maxBestCount = Math.max(...bookmakerAgg.map((a) => a.bestCount), 1);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[90vh] w-[95vw] max-w-4xl overflow-hidden p-0">
        <DialogHeader className="border-b border-border/60 px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Scale className="h-4 w-4 text-emerald-600" />
            {t("title")}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {t("subtitle")}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-80px)]">
          <div className="space-y-5 px-5 py-4">
            {/* Section A — Bookmaker overview */}
            <section>
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Award className="h-3.5 w-3.5" />
                {t("sections.overview")}
              </h3>
              <div className="overflow-hidden rounded-lg border border-border/60">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40">
                    <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      <Th onClick={() => toggleSort("bookmaker")} active={sortKey === "bookmaker"} dir={sortDir}>
                        {t("columns.bookmaker")}
                      </Th>
                      <Th onClick={() => toggleSort("avgMargin")} active={sortKey === "avgMargin"} dir={sortDir} align="right">
                        {t("columns.avgMargin")}
                      </Th>
                      <Th onClick={() => toggleSort("bestCount")} active={sortKey === "bestCount"} dir={sortDir} align="right">
                        {t("columns.bestOddsCount")}
                      </Th>
                      <Th onClick={() => toggleSort("valueBetCount")} active={sortKey === "valueBetCount"} dir={sortDir} align="right">
                        {t("columns.valueBetCount")}
                      </Th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedAgg.map((a, i) => (
                      <tr key={a.bookmaker} className={cn("border-t border-border/40 hover:bg-muted/20", i % 2 === 1 && "bg-muted/5")}>
                        <td className="px-3 py-2 font-medium">{a.bookmaker}</td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">
                          {(a.avgMargin * 100).toFixed(2)}%
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">
                          <span className={cn(a.bestCount === maxBestCount && "font-bold text-emerald-600 dark:text-emerald-400")}>
                            {a.bestCount}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">
                          {a.valueBetCount > 0 ? (
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">{a.valueBetCount}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Section B — Best odds per match */}
            <section>
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <TrendingUp className="h-3.5 w-3.5" />
                {t("sections.bestOdds")}
              </h3>
              <div className="overflow-hidden rounded-lg border border-border/60">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40">
                    <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      <th className="px-3 py-2 text-left font-semibold">{t("columns.match")}</th>
                      <th className="px-3 py-2 text-right font-semibold">{t("columns.bestA")}</th>
                      <th className="px-3 py-2 text-right font-semibold">{t("columns.bestB")}</th>
                      <th className="px-3 py-2 text-right font-semibold">{t("columns.marginRange")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matchBestOdds.map((m, i) => (
                      <tr key={m.matchId} className={cn("border-t border-border/40 hover:bg-muted/20", i % 2 === 1 && "bg-muted/5")}>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{m.matchLabel}</span>
                            {m.hasValueBet && (
                              <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                                {t("valueBetBadge")}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">{m.bestA.odd.toFixed(2)}</span>
                          <span className="ml-1 text-muted-foreground">@ {m.bestA.bookmaker}</span>
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">{m.bestB.odd.toFixed(2)}</span>
                          <span className="ml-1 text-muted-foreground">@ {m.bestB.bookmaker}</span>
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground tabular-nums">
                          {(m.minMargin * 100).toFixed(1)}–{(m.maxMargin * 100).toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Section C — Value bets */}
            <section>
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <TrendingUp className="h-3.5 w-3.5" />
                {t("sections.valueBets")}
                {valueBets.length > 0 && (
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                    {valueBets.length}
                  </span>
                )}
              </h3>
              {valueBets.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  {t("noValueBets")}
                </div>
              ) : (
                <div className="space-y-2">
                  {valueBets.map((vb, i) => (
                    <div
                      key={`${vb.matchId}-${vb.bookmaker}-${i}`}
                      className="flex items-center gap-3 rounded-lg border border-border/60 p-3"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        +{vb.edge}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold truncate">{vb.player}</span>
                          <span className="text-[11px] text-muted-foreground">vs {vb.matchLabel.split(" vs ")[1]}</span>
                        </div>
                        <div className="mt-0.5 text-[11px] text-muted-foreground">
                          {t("columns.modelProba")} {vb.modelProba}% · {t("columns.impliedProba")} {vb.impliedProba}% · {vb.bookmaker} @ {vb.odd.toFixed(2)}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("columns.edge")}</div>
                        <div className="font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400">
                          +{vb.edge}pp
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
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
  return (
    <th
      className={cn(
        "px-3 py-2 font-semibold cursor-pointer select-none hover:bg-muted/60 transition-colors",
        align === "right" && "text-right"
      )}
      onClick={onClick}
    >
      <span className={cn("inline-flex items-center gap-1", align === "right" && "flex-row-reverse")}>
        {children}
        <ArrowUpDown className={cn("h-3 w-3 transition-opacity", active ? "opacity-100" : "opacity-30")} style={{ transform: active && dir === "asc" ? "rotate(180deg)" : undefined }} />
      </span>
    </th>
  );
}
