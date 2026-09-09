"use client";

// LiveStatsBreakdown — stats live bilatérales avec surbrillance automatique des
// seuils du funnel In-Play (OddAlerts §5.5/§6.5) et probabilités live dans la
// même vue (§6.7) : le signal pression est converti en marchés (1X2, O/U, BTTS).

import { useEffect, useMemo, useRef } from "react";
import { Activity, Zap, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FootballLiveState } from "@/lib/football-data";
import {
  buildFunnelSnapshot,
  evaluateLiveFunnel,
  projectLiveMarkets,
  type FunnelRuleId,
} from "@/lib/football-live-thresholds";
import { FOT } from "./fotmob-theme";

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
    <div className={cn("rounded-xl border px-2.5 py-2")} style={{ backgroundColor: hot ? FOT.liveSoft : FOT.card, borderColor: hot ? FOT.live : FOT.border }}>
      <div className="mb-1 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider" style={{ color: FOT.muted }}>
        <span className="inline-flex items-center gap-1">
          {hot && <span className="h-1.5 w-1.5 animate-pulse rounded-full" aria-hidden="true" style={{ backgroundColor: FOT.live }} />}
          {label}
        </span>
        {hot && <span style={{ color: FOT.live }}>seuil</span>}
      </div>
      <div className="flex items-center justify-between text-[11px] font-bold tabular-nums">
        <span style={{ color: FOT.ink }}>{home}{unit}</span>
        <span style={{ color: FOT.ink }}>{away}{unit}</span>
      </div>
      <div className="mt-1 flex h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: FOT.border }}>
        <div className="transition-all" style={{ width: `${homeW}%`, backgroundColor: FOT.home }} />
        <div className="transition-all" style={{ width: `${100 - homeW}%`, backgroundColor: FOT.away, opacity: 0.7 }} />
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
    <div className={cn("grid grid-cols-[2.75rem_1fr_2.75rem] items-center gap-2 rounded-lg px-2 py-1")} style={hot ? { backgroundColor: FOT.liveSoft, border: `1px solid ${FOT.live}55` } : undefined}>
      <span className="text-right font-display text-sm font-bold tabular-nums" style={{ color: FOT.ink }}>{fmt(h)}</span>
      <div className="min-w-0">
        <p className="mb-1 flex items-center justify-center gap-1 text-center text-xs font-semibold uppercase tracking-wider" style={{ color: FOT.muted }}>
          {hot && <Zap className="h-3 w-3" aria-hidden="true" style={{ color: FOT.live }} />}
          <span className="truncate">{label}</span>
        </p>
        {hasData && (
          <div className="flex h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: FOT.border }}>
            <div style={{ width: `${homeW}%`, backgroundColor: FOT.home }} />
            <div style={{ width: `${100 - homeW}%`, backgroundColor: FOT.away, opacity: 0.7 }} />
          </div>
        )}
      </div>
      <span className="font-display text-sm font-bold tabular-nums" style={{ color: FOT.ink }}>{fmt(a)}</span>
    </div>
  );
}

export function LiveStatsBreakdown({
  live,
  homeName = "Domicile",
  awayName = "Extérieur",
  prematch,
  homePressurePct,
  matchId,
  className,
}: {
  live: FootballLiveState;
  homeName?: string;
  awayName?: string;
  /** Probas 1X2 pré-match (fallback projection live sans xG). */
  prematch?: { homeProb: number; drawProb: number; awayProb?: number; over25Prob?: number } | null;
  /** Pression live home 0-100 (issue du Pressure Index) pour les règles funnel. */
  homePressurePct?: Nullable;
  /** Id match BSD (ex. "bsd-123") — backtest funnel, 1 snapshot/min. */
  matchId?: string | null;
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
        // Cartons rouges live → ajustement des taux (Cerveny 2016). Sans eux
        // la projection ignorait les exclusions (bug : 11v10 = 11v11).
        homeRedCards: live.homeRedCards,
        awayRedCards: live.awayRedCards,
      }),
    [live.minute, live.homeScore, live.awayScore, live.homeXg, live.awayXg, live.homeRedCards, live.awayRedCards, prematch],
  );

  // P3 backtest : 1 snapshot funnel/min vers KvStore (calibration des seuils).
  // Best-effort silencieux — jamais de throw, jamais de boucle (60 s fixe).
  // Deps scalaires + refs (LOW AUDIT-2026-09-09) : `funnel`/`markets` recréés
  // à chaque render réarmaient l'intervalle → volume > 1/min. Skip si hidden.
  const snapRef = useRef({ funnel, markets });
  snapRef.current = { funnel, markets };
  const snapMinute = Math.round(live.minute);
  const snapHome = live.homeScore;
  const snapAway = live.awayScore;
  useEffect(() => {
    if (!matchId || snapMinute < 1) return;
    let stopped = false;
    const send = () => {
      if (stopped || document.hidden) return;
      try {
        const snap = buildFunnelSnapshot({
          matchId,
          minute: snapMinute,
          homeScore: snapHome,
          awayScore: snapAway,
          funnel: snapRef.current.funnel,
          markets: snapRef.current.markets,
        });
        fetch("/api/football/live-funnel-log", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(snap),
          keepalive: true,
        }).catch(() => {});
      } catch {
        /* best-effort silencieux */
      }
    };
    send();
    const t = setInterval(send, 60_000);
    return () => {
      stopped = true;
      clearInterval(t);
    };
  }, [matchId, snapMinute, snapHome, snapAway]);

  const homeAtk = num(live.homeAttacks);
  const awayAtk = num(live.awayAttacks);
  const homeDang = num(live.homeDangerousAttacks);
  const awayDang = num(live.awayDangerousAttacks);
  const awayPoss = 100 - live.homePossession;
  // xG par tir = qualité des occasions (0 fetch — dérivé des métriques live).
  const xgPerShot = (xg: Nullable, shots: Nullable): number | null => {
    const x = num(xg);
    const s = num(shots);
    if (x == null || s == null || s <= 0) return null;
    return Math.round((x / s) * 100) / 100;
  };
  const xgPsHome = xgPerShot(live.homeXg, live.homeShots);
  const xgPsAway = xgPerShot(live.awayXg, live.awayShots);

  return (
    <section className={cn("rounded-2xl border p-3", className)} aria-label="Stats live" style={{ backgroundColor: FOT.card, borderColor: FOT.border }}>
      <header className="mb-2 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: FOT.ink }}>
          <Activity className="h-3.5 w-3.5" aria-hidden="true" style={{ color: FOT.live }} />
          Stats live — {Math.round(live.minute)}&apos;
        </h3>
        {signalCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ backgroundColor: FOT.liveSoft, color: FOT.live, border: `1px solid ${FOT.live}55` }}>
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
        {(xgPsHome != null || xgPsAway != null) && (
          <StatRow label="xG / tir" home={xgPsHome} away={xgPsAway} decimals={2} />
        )}
        <StatRow label="Tirs cadrés" home={live.homeShotsOnTarget} away={live.awayShotsOnTarget} hot={hit("totalSot") || hit("awaySot")} />
        <StatRow label="Corners" home={live.homeCorners} away={live.awayCorners} hot={hit("totalCorners") || hit("homeCorners")} />
        {(num(live.homeFouls) != null || num(live.awayFouls) != null) && <StatRow label="Fautes" home={live.homeFouls} away={live.awayFouls} />}
        {(num(live.homeYellowCards) != null || num(live.awayYellowCards) != null) && (
          <StatRow label="Cartons jaunes" home={live.homeYellowCards} away={live.awayYellowCards} hot={hit("yellowCards")} />
        )}
        {(num(live.homeRedCards) != null || num(live.awayRedCards) != null) && <StatRow label="Cartons rouges" home={live.homeRedCards} away={live.awayRedCards} />}
      </div>

      {/* Probabilités live — le signal converti en marchés (OddAlerts §6.7) */}
      <div className="mt-2 border-t pt-2" style={{ borderColor: FOT.border }}>
        <div className="mb-1 flex items-center justify-between">
          <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider" style={{ color: FOT.muted }}>
            <TrendingUp className="h-3 w-3" aria-hidden="true" style={{ color: FOT.live }} />
            Probabilités live projetées
          </span>
          <span className="text-[11px] uppercase tracking-wider" style={{ color: FOT.muted }}>
            {markets.source === "xg"
              ? "basées xG live"
              : Math.round(live.minute) >= 1
                ? "score live + taux pré-match"
                : "estimées pré-match"}
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
            { label: "O 3.5", val: `${markets.over35}%` },
            { label: "U 2.5", val: `${markets.under25}%` },
            { label: "U 3.5", val: `${markets.under35}%` },
          ].map((cell) => (
            <div key={cell.label} className="rounded-lg px-1 py-1.5" style={{ backgroundColor: FOT.soft }}>
              <p className="truncate text-[11px] uppercase tracking-wider" style={{ color: FOT.muted }}>{cell.label}</p>
              <p className="text-[11px] font-bold tabular-nums" style={{ color: FOT.ink }}>{cell.val}</p>
            </div>
          ))}
        </div>
        {/* Buts d'équipe — parité OddAlerts (déjà calculés, affichés P1). */}
        <div className="mt-1.5 grid grid-cols-2 gap-1.5 text-center sm:grid-cols-4">
          {[
            { label: `${homeName} 1+`, val: `${markets.o05Home}%` },
            { label: `${homeName} 2+`, val: `${markets.o15Home}%` },
            { label: `${awayName} 1+`, val: `${markets.o05Away}%` },
            { label: `${awayName} 2+`, val: `${markets.o15Away}%` },
          ].map((cell) => (
            <div key={cell.label} className="rounded-lg px-1 py-1.5" style={{ backgroundColor: FOT.soft }}>
              <p className="truncate text-[11px] uppercase tracking-wider" style={{ color: FOT.muted }}>{cell.label}</p>
              <p className="text-[11px] font-bold tabular-nums" style={{ color: FOT.ink }}>{cell.val}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
