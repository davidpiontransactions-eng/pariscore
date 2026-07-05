"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Trophy,
  Clock,
  Trash2,
  Check,
  X,
  Target,
  Percent,
  Download,
  Braces,
  BarChart3,
  Inbox,
} from "lucide-react";
import { useBankroll, type GroupStats } from "@/hooks/use-bankroll";
import { useAnalytics } from "@/components/analytics-provider";
import { betsToCSV, betsToJSON, downloadFile, getDateStamp } from "@/lib/export-bankroll";
import { cn } from "@/lib/utils";

let openFn: ((open: boolean) => void) | null = null;
export function openBankrollDialog() {
  openFn?.(true);
}

export function BankrollDialog() {
  const t = useTranslations("bankroll");
  const { state, stats, advancedStats, setInitial, settleBet, deleteBet, clearAll } = useBankroll();
  const { track } = useAnalytics();
  const [open, setOpen] = useState(false);
  const [initialInput, setInitialInput] = useState(String(state.initial));

  useEffect(() => {
    openFn = setOpen;
    return () => {
      openFn = null;
    };
  }, []);

  // Sync input when dialog opens
  useEffect(() => {
    if (open) {
      Promise.resolve().then(() => setInitialInput(String(state.initial)));
    }
  }, [open, state.initial]);

  const handleSaveInitial = () => {
    const n = parseFloat(initialInput);
    if (!isNaN(n) && n >= 0) {
      setInitial(n);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[90vh] w-[95vw] max-w-2xl overflow-hidden p-0">
        <DialogHeader className="border-b border-border/60 px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Wallet className="h-4 w-4 text-emerald-600" />
            {t("title")}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {t("subtitle")}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-80px)]">
          <div className="px-5 py-4">
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview" className="text-xs">{t("tabs.overview")}</TabsTrigger>
                <TabsTrigger value="history" className="text-xs">{t("tabs.history")}</TabsTrigger>
                <TabsTrigger value="stats" className="text-xs">
                  <BarChart3 className="mr-1 h-3 w-3" />
                  {t("tabs.stats")}
                </TabsTrigger>
                <TabsTrigger value="settings" className="text-xs">{t("tabs.settings")}</TabsTrigger>
              </TabsList>

              {/* Overview tab */}
              <TabsContent value="overview" className="mt-4 space-y-3">
                {/* Bankroll card */}
                <div className="rounded-lg border border-border/60 bg-gradient-to-br from-emerald-500/10 to-transparent p-4">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("currentBankroll")}
                  </div>
                  <div className="mt-1 text-3xl font-bold tabular-nums">
                    {stats.current.toFixed(2)} €
                  </div>
                  <div
                    className={cn(
                      "mt-1 flex items-center gap-1 text-sm font-semibold",
                      stats.profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                    )}
                  >
                    {stats.profit >= 0 ? (
                      <TrendingUp className="h-3.5 w-3.5" />
                    ) : (
                      <TrendingDown className="h-3.5 w-3.5" />
                    )}
                    {stats.profit >= 0 ? "+" : ""}
                    {stats.profit.toFixed(2)} €
                    <span className="text-muted-foreground">
                      ({stats.roi >= 0 ? "+" : ""}
                      {stats.roi.toFixed(1)}% ROI)
                    </span>
                  </div>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <StatCard
                    icon={<Target className="h-3.5 w-3.5" />}
                    label={t("stats.totalBets")}
                    value={String(stats.totalBets)}
                  />
                  <StatCard
                    icon={<Clock className="h-3.5 w-3.5" />}
                    label={t("stats.pending")}
                    value={String(stats.pendingCount)}
                  />
                  <StatCard
                    icon={<Trophy className="h-3.5 w-3.5" />}
                    label={t("stats.winRate")}
                    value={`${stats.winRate.toFixed(0)}%`}
                    good={stats.winRate >= 50}
                  />
                  <StatCard
                    icon={<Percent className="h-3.5 w-3.5" />}
                    label="ROI"
                    value={`${stats.roi >= 0 ? "+" : ""}${stats.roi.toFixed(1)}%`}
                    good={stats.roi >= 0}
                  />
                </div>

                {/* Won/Lost summary */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                      <Check className="h-3 w-3" />
                      {t("stats.won")}
                    </div>
                    <div className="mt-1 text-lg font-bold text-emerald-600 dark:text-emerald-400">
                      {stats.wonCount}
                    </div>
                  </div>
                  <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-3">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-700 dark:text-rose-300">
                      <X className="h-3 w-3" />
                      {t("stats.lost")}
                    </div>
                    <div className="mt-1 text-lg font-bold text-rose-600 dark:text-rose-400">
                      {stats.lostCount}
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* History tab */}
              <TabsContent value="history" className="mt-4">
                {state.bets.length === 0 ? (
                  <div className="py-12 text-center text-sm text-muted-foreground">
                    {t("emptyHistory")}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Export buttons */}
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const csv = betsToCSV(state.bets);
                          downloadFile(csv, `setpoint-bankroll-${getDateStamp()}.csv`, "text/csv");
                          track("bankroll_exported", { format: "csv", betCount: state.bets.length });
                        }}
                        className="gap-1.5 text-xs"
                        title={t("export.csvHint")}
                      >
                        <Download className="h-3 w-3" />
                        {t("export.csv")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const json = betsToJSON(state.bets, stats);
                          downloadFile(json, `setpoint-bankroll-${getDateStamp()}.json`, "application/json");
                          track("bankroll_exported", { format: "json", betCount: state.bets.length });
                        }}
                        className="gap-1.5 text-xs"
                        title={t("export.jsonHint")}
                      >
                        <Braces className="h-3 w-3" />
                        {t("export.json")}
                      </Button>
                    </div>
                    <div className="space-y-2">
                    {state.bets.map((bet) => (
                      <div
                        key={bet.id}
                        className="flex items-center gap-3 rounded-lg border border-border/60 p-3"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold truncate">
                              {bet.betOnName}
                            </span>
                            <span
                              className={cn(
                                "rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                                bet.status === "won" && "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
                                bet.status === "lost" && "bg-rose-500/15 text-rose-600 dark:text-rose-400",
                                bet.status === "pending" && "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                              )}
                            >
                              {t(`status.${bet.status}`)}
                            </span>
                          </div>
                          <div className="mt-0.5 text-[11px] text-muted-foreground">
                            vs {bet.betOn === "A" ? bet.playerB : bet.playerA} · {bet.odd.toFixed(2)} · {bet.stake.toFixed(2)} €
                            {bet.payout !== undefined && bet.status === "won" && (
                              <span className="ml-1 font-semibold text-emerald-600 dark:text-emerald-400">
                                → +{(bet.payout - bet.stake).toFixed(2)} €
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-muted-foreground/70">
                            {new Date(bet.placedAt).toLocaleString()}
                          </div>
                        </div>
                        {bet.status === "pending" && (
                          <div className="flex shrink-0 gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-emerald-600 hover:bg-emerald-500/10"
                              onClick={() => settleBet(bet.id, "won")}
                              title={t("actions.markWon")}
                            >
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-rose-600 hover:bg-rose-500/10"
                              onClick={() => settleBet(bet.id, "lost")}
                              title={t("actions.markLost")}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 shrink-0 p-0 text-muted-foreground hover:text-foreground"
                          onClick={() => deleteBet(bet.id)}
                          title={t("actions.delete")}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                    {state.bets.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearAll}
                        className="mt-3 w-full text-xs text-muted-foreground hover:text-rose-600"
                      >
                        <Trash2 className="mr-1.5 h-3 w-3" />
                        {t("actions.clearAll")}
                      </Button>
                    )}
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* Stats tab — advanced breakdowns */}
              <TabsContent value="stats" className="mt-4">
                <AdvancedStatsView
                  byBookmaker={advancedStats.byBookmaker}
                  byPlayer={advancedStats.byPlayer}
                  byMonth={advancedStats.byMonth}
                  hasSettled={stats.settledCount > 0}
                />
              </TabsContent>

              {/* Settings tab */}
              <TabsContent value="settings" className="mt-4 space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("settings.initialBankroll")}
                  </label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      value={initialInput}
                      onChange={(e) => setInitialInput(e.target.value)}
                      min="0"
                      step="10"
                      className="flex-1"
                    />
                    <Button onClick={handleSaveInitial} size="sm">
                      {t("settings.save")}
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {t("settings.initialHint")}
                  </p>
                </div>

                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-300">
                  <p className="font-semibold">{t("settings.warning")}</p>
                  <p className="mt-1 text-amber-600/80 dark:text-amber-400/80">
                    {t("settings.warningText")}
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function StatCard({
  icon,
  label,
  value,
  good,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  good?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </div>
      <div
        className={cn(
          "mt-1 text-lg font-bold tabular-nums",
          good === true && "text-emerald-600 dark:text-emerald-400",
          good === false && "text-rose-600 dark:text-rose-400"
        )}
      >
        {value}
      </div>
    </div>
  );
}

// --- Advanced stats (Stats tab) -------------------------------------------

function AdvancedStatsView({
  byBookmaker,
  byPlayer,
  byMonth,
  hasSettled,
}: {
  byBookmaker: GroupStats[];
  byPlayer: GroupStats[];
  byMonth: GroupStats[];
  hasSettled: boolean;
}) {
  const t = useTranslations("bankroll.advancedStats");

  if (!hasSettled) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/60 py-12 text-center">
        <Inbox className="h-8 w-8 text-muted-foreground/60" />
        <div className="text-sm font-semibold text-muted-foreground">
          {t("noData")}
        </div>
        <div className="max-w-xs text-[11px] text-muted-foreground/70">
          {t("noDataHint")}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <StatsSection
        title={t("byBookmaker")}
        nameKey="bookmaker"
        groups={byBookmaker}
      />
      <StatsSection
        title={t("byPlayer")}
        nameKey="player"
        groups={byPlayer}
      />
      <MonthlyProfitChart groups={byMonth} />
    </div>
  );
}

function StatsSection({
  title,
  nameKey,
  groups,
}: {
  title: string;
  nameKey: "bookmaker" | "player" | "month";
  groups: GroupStats[];
}) {
  const t = useTranslations("bankroll.advancedStats");

  if (groups.length === 0) return null;

  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      <div className="max-h-72 overflow-y-auto rounded-lg border border-border/60 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border/60">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-background">
            <TableRow className="border-border/60 hover:bg-transparent">
              <TableHead className="h-8 pl-3 text-[10px] uppercase tracking-wider text-muted-foreground">
                {t(nameKey)}
              </TableHead>
              <TableHead className="h-8 text-right text-[10px] uppercase tracking-wider text-muted-foreground">
                {t("bets")}
              </TableHead>
              <TableHead className="h-8 text-right text-[10px] uppercase tracking-wider text-muted-foreground">
                {t("winRate")}
              </TableHead>
              <TableHead className="h-8 text-right text-[10px] uppercase tracking-wider text-muted-foreground">
                {t("profit")}
              </TableHead>
              <TableHead className="h-8 pr-3 text-right text-[10px] uppercase tracking-wider text-muted-foreground">
                {t("roi")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map((g) => (
              <TableRow key={g.key} className="border-border/40">
                <TableCell className="max-w-[140px] truncate py-2 pl-3 text-xs font-medium" title={g.label}>
                  {g.label}
                </TableCell>
                <TableCell className="py-2 text-right text-xs tabular-nums text-muted-foreground">
                  {g.bets}
                </TableCell>
                <TableCell className="py-2 text-right text-xs tabular-nums text-muted-foreground">
                  {g.settled > 0 ? `${g.winRate.toFixed(0)}%` : "—"}
                </TableCell>
                <TableCell
                  className={cn(
                    "py-2 text-right text-xs font-semibold tabular-nums",
                    g.profit > 0 && "text-emerald-600 dark:text-emerald-400",
                    g.profit < 0 && "text-rose-600 dark:text-rose-400",
                    g.profit === 0 && "text-muted-foreground"
                  )}
                >
                  {g.settled > 0
                    ? `${g.profit >= 0 ? "+" : ""}${g.profit.toFixed(2)} €`
                    : "—"}
                </TableCell>
                <TableCell
                  className={cn(
                    "py-2 pr-3 text-right text-xs font-semibold tabular-nums",
                    g.roi > 0 && "text-emerald-600 dark:text-emerald-400",
                    g.roi < 0 && "text-rose-600 dark:text-rose-400",
                    g.roi === 0 && "text-muted-foreground"
                  )}
                >
                  {g.settled > 0
                    ? `${g.roi >= 0 ? "+" : ""}${g.roi.toFixed(1)}%`
                    : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

function MonthlyProfitChart({ groups }: { groups: GroupStats[] }) {
  const t = useTranslations("bankroll.advancedStats");
  const locale = useLocale();

  // Sort months chronologically (oldest → newest) for the x-axis.
  const data = [...groups]
    .filter((g) => g.key !== "—")
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((g) => ({
      key: g.key,
      label: formatMonthLabel(g.key, locale),
      profit: Number(g.profit.toFixed(2)),
      roi: Number(g.roi.toFixed(1)),
      bets: g.bets,
      settled: g.settled,
    }));

  if (data.length === 0) return null;

  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {t("byMonth")}
      </h3>
      <div className="rounded-lg border border-border/60 p-3">
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} opacity={0.4} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={{ stroke: "hsl(var(--border))" }}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                width={44}
                tickFormatter={(v: number) => `${v >= 0 ? "+" : ""}${v}`}
              />
              <RTooltip
                cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }}
                content={<MonthTooltip />}
              />
              <ReferenceLine y={0} stroke="hsl(var(--border))" />
              <Bar dataKey="profit" radius={[3, 3, 0, 0]} maxBarSize={48}>
                {data.map((entry) => (
                  <Cell
                    key={entry.key}
                    fill={
                      entry.profit > 0
                        ? "oklch(0.62 0.17 152)" // emerald-500-ish
                        : entry.profit < 0
                          ? "oklch(0.62 0.21 25)"  // rose-500-ish
                          : "hsl(var(--muted-foreground))"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}

type MonthDatum = {
  key: string;
  label: string;
  profit: number;
  roi: number;
  bets: number;
  settled: number;
};

function MonthTooltip({ active, payload }: {
  active?: boolean;
  payload?: { payload: MonthDatum }[];
}) {
  const t = useTranslations("bankroll.advancedStats");
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-md border border-border/70 bg-background px-2.5 py-2 text-[11px] shadow-md">
      <div className="font-semibold">{d.label}</div>
      <div className="mt-1 flex items-center justify-between gap-3">
        <span className="text-muted-foreground">{t("profit")}</span>
        <span
          className={cn(
            "font-semibold tabular-nums",
            d.profit > 0 && "text-emerald-600 dark:text-emerald-400",
            d.profit < 0 && "text-rose-600 dark:text-rose-400",
            d.profit === 0 && "text-foreground"
          )}
        >
          {d.profit >= 0 ? "+" : ""}
          {d.profit.toFixed(2)} €
        </span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground">{t("roi")}</span>
        <span
          className={cn(
            "font-semibold tabular-nums",
            d.roi > 0 && "text-emerald-600 dark:text-emerald-400",
            d.roi < 0 && "text-rose-600 dark:text-rose-400",
            d.roi === 0 && "text-foreground"
          )}
        >
          {d.roi >= 0 ? "+" : ""}
          {d.roi.toFixed(1)}%
        </span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground">{t("bets")}</span>
        <span className="tabular-nums">{d.bets}</span>
      </div>
    </div>
  );
}

/** Format a "YYYY-MM" key into a locale-aware short month + year label. */
function formatMonthLabel(key: string, locale: string): string {
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return key;
  const d = new Date(Date.UTC(y, m - 1, 1));
  if (isNaN(d.getTime())) return key;
  const tag = locale === "fr" ? "fr-FR" : "en-GB";
  return new Intl.DateTimeFormat(tag, { month: "short", year: "2-digit", timeZone: "UTC" }).format(d);
}
