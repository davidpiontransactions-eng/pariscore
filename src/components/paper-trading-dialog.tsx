"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FlaskConical,
  TrendingUp,
  TrendingDown,
  Clock,
  Trash2,
  Check,
  X,
  Target,
  Percent,
  Trophy,
  AlertTriangle,
} from "lucide-react";
import { usePaperTrading } from "@/hooks/use-paper-trading";
import { cn } from "@/lib/utils";

let openFn: ((open: boolean) => void) | null = null;
export function openPaperTradingDialog() {
  openFn?.(true);
}

export function PaperTradingDialog() {
  const t = useTranslations("paperTrading");
  const { state, stats, setInitial, settleBet, deleteBet, clearAll } = usePaperTrading();
  const [open, setOpen] = useState(false);
  const [initialInput, setInitialInput] = useState(String(state.initial));

  useEffect(() => {
    openFn = setOpen;
    return () => {
      openFn = null;
    };
  }, []);

  useEffect(() => {
    if (open) {
      Promise.resolve().then(() => setInitialInput(String(state.initial)));
    }
  }, [open, state.initial]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[90vh] w-[95vw] max-w-2xl overflow-hidden p-0">
        <DialogHeader className="border-b border-border/60 px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <FlaskConical className="h-4 w-4 text-purple-600" />
            {t("title")}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {t("subtitle")}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-80px)]">
          <div className="space-y-4 px-5 py-4">
            {/* Warning banner */}
            <div className="flex items-start gap-2 rounded-lg border border-purple-500/30 bg-purple-500/5 p-3 text-xs">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-purple-600 dark:text-purple-400" />
              <div>
                <p className="font-semibold text-purple-700 dark:text-purple-300">
                  {t("warning")}
                </p>
                <p className="mt-0.5 text-purple-600/80 dark:text-purple-400/80">
                  {t("warningText")}
                </p>
              </div>
            </div>

            {/* Virtual bankroll card */}
            <div className="rounded-lg border border-purple-500/30 bg-gradient-to-br from-purple-500/10 to-transparent p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("virtualBankroll")}
              </div>
              <div className="mt-1 text-3xl font-bold tabular-nums">
                {stats.current.toLocaleString()} pts
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
                {stats.profit.toLocaleString()} pts
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

            {/* Bet history */}
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("history")}
              </div>
              {state.bets.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  {t("emptyHistory")}
                </div>
              ) : (
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
                          vs {bet.betOn === "A" ? bet.playerB : bet.playerA} · {bet.odd.toFixed(2)} · {bet.stake} pts
                          {bet.payout !== undefined && bet.status === "won" && (
                            <span className="ml-1 font-semibold text-emerald-600 dark:text-emerald-400">
                              → +{(bet.payout - bet.stake).toFixed(0)} pts
                            </span>
                          )}
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
              )}
            </div>

            {/* Settings */}
            <div className="space-y-2 border-t border-border/60 pt-4">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("settings.initialBankroll")}
              </label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={initialInput}
                  onChange={(e) => setInitialInput(e.target.value)}
                  min="0"
                  step="1000"
                  className="flex-1"
                />
                <Button
                  onClick={() => {
                    const n = parseFloat(initialInput);
                    if (!isNaN(n) && n >= 0) setInitial(n);
                  }}
                  size="sm"
                >
                  {t("settings.save")}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {t("settings.initialHint")}
              </p>
            </div>
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
