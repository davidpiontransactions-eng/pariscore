"use client";

import { motion } from "framer-motion";
import { ArrowUpRight, ArrowDownRight, Wallet, TrendingUp, Percent, Target, Layers, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BankrollStats } from "@/lib/bet-manager/types";

const fmt = (n: number, digits = 2) =>
  n.toLocaleString("fr-FR", { minimumFractionDigits: digits, maximumFractionDigits: digits });

const pct = (n: number) => `${n >= 0 ? "+" : ""}${fmt(n, 2)}%`;

function Delta({ value, invert = false }: { value: number; invert?: boolean }) {
  const positive = invert ? value < 0 : value > 0;
  const Icon = positive ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 font-mono text-[11px] font-semibold",
        positive ? "text-emerald-400" : "text-red-400"
      )}
    >
      <Icon className="h-3 w-3" />
      {pct(value)}
    </span>
  );
}

function Kpi({
  label,
  value,
  sub,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
  icon: React.ElementType;
  tone?: "default" | "good" | "bad" | "accent";
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-white/5 bg-white/[0.03] p-3 transition-colors hover:border-white/10">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div
        className={cn(
          "font-mono text-lg font-semibold tabular-nums leading-none",
          tone === "good" && "text-emerald-400",
          tone === "bad" && "text-red-400",
          tone === "accent" && "text-emerald-400"
        )}
      >
        {value}
      </div>
      {sub ? <div className="text-[11px] text-zinc-500">{sub}</div> : null}
    </div>
  );
}

export function KpiStrip({ stats, currency }: { stats: BankrollStats; currency: string }) {
  const positive = stats.profit >= 0;
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6"
    >
      {/* Signature — le capital */}
      <div className="relative col-span-2 overflow-hidden rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.08] to-transparent p-4 sm:col-span-1 lg:col-span-2">
        <div className="pointer-events-none absolute -right-6 -top-8 h-28 w-28 rounded-full bg-emerald-500/10 blur-2xl" />
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-emerald-400/80">
          <Wallet className="h-3 w-3" /> Capital actuel
        </div>
        <div
          className={cn(
            "mt-2 font-mono text-3xl font-bold tabular-nums leading-none tracking-tight",
            positive ? "text-emerald-400" : "text-white"
          )}
        >
          {fmt(stats.current, 0)}
          <span className="ml-1 text-base font-medium text-zinc-500">{currency}</span>
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs">
          <Delta value={stats.profit} />
          <span className="text-zinc-500">vs {fmt(stats.initial, 0)} {currency} initial</span>
        </div>
      </div>

      <Kpi
        label="Profit"
        icon={TrendingUp}
        value={`${positive ? "+" : ""}${fmt(stats.profit)} €`}
        tone={positive ? "good" : "bad"}
        sub={<Delta value={stats.profit} />}
      />
      <Kpi label="ROI" icon={Target} value={pct(stats.roi)} tone={stats.roi >= 0 ? "good" : "bad"} sub="sur mises risquées" />
      <Kpi label="Yield" icon={Percent} value={pct(stats.yield)} tone={stats.yield >= 0 ? "good" : "bad"} />
      <Kpi label="Réussite" icon={Activity} value={`${fmt(stats.winRate, 1)}%`} sub={`${stats.wonCount}W / ${stats.lostCount}L`} />
      <Kpi label="Total misé" icon={Layers} value={`${fmt(stats.totalStaked, 0)} €`} sub={`${stats.settledCount} réglés · ${stats.pendingCount} en attente`} />
      <Kpi
        label="Drawdown max"
        icon={Activity}
        value={`-${fmt(stats.maxDrawdown, 1)}%`}
        tone="bad"
        sub={`streak ${stats.currentStreak > 0 ? "+" : ""}${stats.currentStreak}`}
      />
    </motion.section>
  );
}