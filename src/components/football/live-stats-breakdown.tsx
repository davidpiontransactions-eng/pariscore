"use client";

// LiveStatsBreakdown — stats live bilatérales avec surbrillance automatique des
// seuils du funnel In-Play (OddAlerts §5.5/§6.5) et probabilités live dans la
// même vue (§6.7) : le signal pression est converti en marchés (1X2, O/U, BTTS).

import { useMemo } from "react";
import { Activity, Zap, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FootballLiveState } from "@/lib/football-data";
import {
  evaluateLiveFunnel,
  projectLiveMarkets,
  type FunnelRuleId,
} from "@/lib/football-live-thresholds";

type Nullable = number | null | undefined;

const num = (v: Nullable): number | null => (v != null && Number.isFinite(v) ? v : null);

/** Jauge bilatérale (Possession / Attaques / Attaques dangereuses). */
function BilateralGauge({
  label,
  home,
  away,
  unit,
  hot,
}: {
  label: string;
  home: number;
  away: number;
  unit?: string;
  hot?: boolean;
}) {
  const total = home + away;
  const homeW = total > 0 ? (home / total) * 100 : 50;
  return (
    <div className={cn("rounded-xl border border-slate-800/80 bg-slate-900/50 px-2.5 py-2", hot && "border-emerald-500/40 bg-emerald-500/5")}>
      <div className="mb-1 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          {hot && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" aria-hidden="true" />}
          {label}
        </span>
        {hot && <span className="text-emerald-400">seuil</span>}
      </div>
      <div className="flex items-center justify-between text-[11px] font-bold tabular-nums">
        <span className="text-emerald-400">{home}{unit}</span>
        <span className="text-sky-400">{away}{unit}</span>
      </div>
      <div className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-muted/60">
        <div className="bg-emerald-500/80 transition-all" style={{ width: `${homeW}%` }} />
        <div className="bg-sky-500/80 transition-all" style={{ width: `${100 - homeW}%` }} />
      </div>
    </div>
  );
}

/** Ligne de table avec barre de ratio (style OddAlerts cyan/gris → emerald/sky). */
function StatRow({
  label,
  home,
  away,
  decimals = 0,
  hot,
}: {
  label: string;
  home: Nullable;
  away: Nullable;
  decimals?: number;
  hot?: boolean;
}) {
  const h = num(home);
  const a = num(away);
  const hasData = h != null || a != null;
  const total = (h ?? 0) + (a ?? 0);
  const homeW = hasData && total > 0 ? ((h ?? 0) / total) * 100 : 50;
  const fmt = (v: number | null) => (v == null ? "—" : decimals > 0 ? v.toFixed(decimals) : String(Math.round(v)));
  return (
    <div className={cn("grid grid-cols-[2.5rem_1fr_2.5rem] items-center gap-2 rounded-lg px-2 py-1", hot && "bg-emerald-500/5 ring-1 ring-emerald-500/30")}>
      <span className="text-right text-[11px] font-semibold tabular-nums text-emerald-400">{fmt(h)}</span>
      <div className="min-w-0">
        <p className="mb-0.5 flex items-center justify-center gap-1 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {hot && <Zap className="h-2.5 w-2.5 text-emerald-400" aria-hidden="true" />}
          <span className="truncate">{label}</span>
        </p>
        {hasData && (
          <div className="flex h-1 overflow-hidden rounded-full bg-muted/60">
            <div className={cn(h != null && (h ?? 0) >= (a ?? 0) ? "bg-emerald-500/90" : "bg-emerald-500/40")} style={{ width: `${homeW}%` }} />
            <div className={cn(a != null && (a ?? 0) > (h ?? 0) ? "bg-sky-500/90" : "bg-sky-500/40")} style={{ width: `${100 - homeW}%` }} />
          </div>
        )}
      </div>
      <span className="text-[11px] font-semibold tabular-nums text-sky-400">{fmt(a)}</span>
    </div>
  );
}

export function LiveStatsBreakdown({
  live,
  homeName = "Domicile",
  awayName = "Extérieur",
  prematch,
  homePressurePct,
  className,
}: {
  live: FootballLiveState;
  homeName?: string;
  awayName?: string;
  /** Probas 1X2 pré-match (fallback projection live sans xG). */
  prematch?: { homeProb: number; drawProb: number } | null;
  /** Pression live home 0-100 (issue du Pressure Index) pour les règles funnel. */
  homePressurePct?: Nullable;
  className?: string;
}) {
  const funnel = useMemo(
    () =>
      evaluateLiveFunnel({
        minute: live.minute,
        homePressurePct: num(homePressurePct),
        homePossession: live.homePossession,
        homeShots: live.homeShots,
        awayShots: live.awayShots,
        homeSot: live.homeShotsOnTarget,
        awaySot: live.awayShotsOnTarget,
        homeCorners: live.homeCorners,
        awayCorners: live.awayCorners,
        homeYellowCards: live.homeYellowCards,
        awayYellowCards: live.awayYellowCards,
        homeAttacks: live.homeAttacks,
        awayAttacks: live.awayAttacks,
        homeDangerousAttacks: live.homeDangerousAttacks,
        awayDangerousAttacks: live.awayDangerousAttacks,
        homeXg: live.homeXg,
        awayXg: live.awayXg,
      }),
    [live, homePressurePct],
  );

  const hit = (rule: FunnelRuleId) => funnel.find((f) => f.rule === rule)?.met ?? false;
  const signalCount = funnel.filter((f) => f.value != null && f.met).length;

  const markets = useMemo(
    () =>
      projectLiveMarkets({
        minute: live.minute,
        homeScore: live.homeScore,
        awayScore: live.awayScore,
        homeXg: live.homeXg,
        awayXg: live.awayXg,
        prematch: prematch ?? null,
      }),
    [live.minute, live.homeScore, live.awayScore, live.homeXg, live.awayXg, prematch],
  );

  const homeAtk = num(live.homeAttacks);
  const awayAtk = num(live.awayAttacks);
  const homeDang = num(live.homeDangerousAttacks);
  const awayDang = num(live.awayDangerousAttacks);
  const awayPoss = 100 - live.homePossession;

  return (
    <section className={cn("rounded-2xl border border-slate-800 bg-slate-950/60 p-3", className)} aria-label="Stats live">
      <header className="mb-2 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-300">
          <Activity className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
          Stats live — {Math.round(live.minute)}&apos;
        </h3>
        {signalCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-300 ring-1 ring-emerald-500/30">
            <Zap className="h-2.5 w-2.5" aria-hidden="true" />
            {signalCount} signal{signalCount > 1 ? "s" : ""} funnel
          </span>
        )}
      </header>

      {/* 3 highlights en jauges bilatérales */}
      <div className="mb-2 grid grid-cols-1 gap-1.5 sm:grid-cols-3">
        <BilateralGauge label="Possession" home={Math.round(live.homePossession)} away={Math.round(awayPoss)} unit="%" hot={hit("awayPossession")} />
        {homeAtk != null && awayAtk != null && (
          <BilateralGauge label="Attaques" home={homeAtk} away={awayAtk} hot={hit("homeAttacks")} />
        )}
        {homeDang != null && awayDang != null && (
          <BilateralGauge label="Att. dangereuses" home={homeDang} away={awayDang} hot={hit("dangerousAttacks")} />
        )}
      </div>

      {/* Table de métriques avec surbrillance des seuils funnel */}
      <div className="space-y-0.5" role="table" aria-label={`Statistiques du match ${homeName} contre ${awayName}`}>
        <StatRow label="xG" home={live.homeXg} away={live.awayXg} decimals={2} hot={hit("xgTotal")} />
        <StatRow label="Tirs" home={live.homeShots} away={live.awayShots} hot={hit("homeShots")} />
        <StatRow label="Tirs cadrés" home={live.homeShotsOnTarget} away={live.awayShotsOnTarget} hot={hit("totalSot") || hit("awaySot")} />
        <StatRow label="Corners" home={live.homeCorners} away={live.awayCorners} hot={hit("totalCorners") || hit("homeCorners")} />
        {num(live.homeFouls) != null && <StatRow label="Fautes" home={live.homeFouls} away={live.awayFouls} />}
        {num(live.homeYellowCards) != null && (
          <StatRow label="Cartons jaunes" home={live.homeYellowCards} away={live.awayYellowCards} hot={hit("yellowCards")} />
        )}
        {num(live.homeRedCards) != null && <StatRow label="Cartons rouges" home={live.homeRedCards} away={live.awayRedCards} />}
      </div>

      {/* Probabilités live — le signal converti en marchés (OddAlerts §6.7) */}
      <div className="mt-2 border-t border-slate-800/70 pt-2">
        <div className="mb-1 flex items-center justify-between">
          <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            <TrendingUp className="h-3 w-3 text-emerald-400" aria-hidden="true" />
            Probabilités live projetées
          </span>
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground/60">
            {markets.source === "xg" ? "basées xG live" : "estimées pré-match"}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-1.5 text-center">
          {[
            { label: "1X2", val: `${markets.homeWin}/${markets.draw}/${markets.awayWin}` },
            { label: "O 1.5", val: `${markets.over15}%` },
            { label: "O 2.5", val: `${markets.over25}%` },
            { label: homeName, val: `${markets.homeWin}%` },
            { label: "BTTS", val: `${markets.btts}%` },
            { label: awayName, val: `${markets.awayWin}%` },
          ].map((cell) => (
            <div key={cell.label} className="rounded-lg bg-slate-900/60 px-1 py-1.5">
              <p className="truncate text-[11px] uppercase tracking-wider text-muted-foreground">{cell.label}</p>
              <p className="text-[11px] font-bold tabular-nums text-slate-100">{cell.val}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
