"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Clock, Activity, TrendingUp, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import type { FootballMatch } from "@/lib/football-data";
import { countryFlag } from "@/lib/bsd-football-fetcher";
import { WatchButton } from "@/components/shared/watch-button";

// ─── Sparkline xG Live ───────────────────────────────────────────────────

/** Point cumulé : minute + xG cumulé (home + away). */
type CumulPoint = { minute: number; homeCumul: number; awayCumul: number };

function XGSparkline({ points, homeName, awayName }: { points: CumulPoint[]; homeName: string; awayName: string }) {
  // Dimensions mini
  const W = 300;
  const H = 56;
  const PAD_L = 4;
  const PAD_R = 4;
  const PAD_TOP = 8;
  const PAD_BOT = 14;
  const PLOT_W = W - PAD_L - PAD_R;
  const PLOT_H = H - PAD_TOP - PAD_BOT;
  const maxMin = Math.max(points.length > 0 ? points[points.length - 1].minute : 90, 90);

  const maxY = useMemo(() => {
    if (points.length === 0) return 1;
    let m = 0;
    for (const p of points) { m = Math.max(m, p.homeCumul, p.awayCumul); }
    return m > 0 ? m : 1;
  }, [points]);

  function x(min: number) { return PAD_L + (Math.max(0, Math.min(maxMin, min)) / maxMin) * PLOT_W; }
  function y(val: number) { return PAD_TOP + PLOT_H - (val / maxY) * PLOT_H; }

  function buildPath(pts: CumulPoint[], key: "homeCumul" | "awayCumul"): string {
    if (pts.length === 0) return "";
    const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.minute).toFixed(1)} ${y(p[key]).toFixed(1)}`);
    return d.join(" ");
  }

  const homePath = buildPath(points, "homeCumul");
  const awayPath = buildPath(points, "awayCumul");

  return (
    <div className="mt-2 border-t border-border/30 pt-2">
      <div className="mb-1 flex items-center justify-between text-[10px]">
        <span className="font-semibold uppercase tracking-wider text-muted-foreground">📈 Évolution xG</span>
        <span className="flex items-center gap-2 text-[9px] text-muted-foreground">
          <span className="inline-flex items-center gap-1"><span className="inline-block h-1.5 w-3 rounded-sm bg-emerald-500" /> {homeName}</span>
          <span className="inline-flex items-center gap-1"><span className="inline-block h-1.5 w-3 rounded-sm bg-rose-500" /> {awayName}</span>
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" role="img" aria-label={`Évolution xG cumulé — ${homeName} vs ${awayName}`}>
        {/* Grille horizontale légère */}
        {[0.25, 0.5, 0.75, 1].map((frac) => (
          <line key={`grid-${frac}`} x1={PAD_L} y1={y(maxY * frac)} x2={W - PAD_R} y2={y(maxY * frac)} stroke="currentColor" strokeOpacity={0.08} strokeWidth={1} className="text-muted-foreground" />
        ))}
        {/* Ligne de base */}
        <line x1={PAD_L} y1={y(0)} x2={W - PAD_R} y2={y(0)} stroke="currentColor" strokeOpacity={0.2} strokeWidth={1} className="text-muted-foreground" />
        {/* Courbes */}
        {awayPath && <path d={awayPath} fill="none" stroke="#f43f5e" strokeWidth={1.5} strokeOpacity={0.7} strokeLinecap="round" strokeLinejoin="round" />}
        {homePath && <path d={homePath} fill="none" stroke="#10b981" strokeWidth={1.8} strokeOpacity={0.85} strokeLinecap="round" strokeLinejoin="round" />}
        {/* Dernier point (valeur actuelle) */}
        {points.length > 0 && (() => {
          const last = points[points.length - 1];
          return (
            <>
              <circle cx={x(last.minute)} cy={y(last.homeCumul)} r="3" fill="#10b981" stroke="#fff" strokeWidth="0.5" />
              <circle cx={x(last.minute)} cy={y(last.awayCumul)} r="3" fill="#f43f5e" stroke="#fff" strokeWidth="0.5" />
            </>
          );
        })()}
      </svg>
      {/* Axe minutes */}
      <div className="mt-0.5 flex justify-between text-[8px] text-muted-foreground/60">
        <span>0&apos;</span>
        <span>{Math.round(maxMin / 2)}&apos;</span>
        <span>{maxMin}&apos;</span>
      </div>
    </div>
  );
}

function LiveBadge({ minute, status, period }: { minute: number; status: string; period?: string }) {
  const isHT = status === "HT";
  const isFT = status === "FT" || status === "PEN";
  // Indice de mi-temps : "2H" → 2e MT, sinon 1re MT (HT traité à part).
  const half = period === "2H" ? "2M" : "1M";
  const label = isFT ? "Terminé" : isHT ? "MI-TEMPS" : `${minute}' ${half}`;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        isFT
          ? "bg-muted text-muted-foreground"
          : isHT
            ? "bg-amber-500/20 text-amber-600 dark:text-amber-400"
            : "bg-rose-500/20 text-rose-600 dark:text-rose-400",
      )}
    >
      {!isFT && !isHT && (
        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />
      )}
      {label}
    </span>
  );
}

function formatKickoff(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function StatRow({
  label,
  home,
  away,
  pct,
}: {
  label: string;
  home: number;
  away: number;
  pct?: number;
}) {
  const max = Math.max(home, away, 1);
  const homePct = pct ?? (home / max) * 70;
  const awayPct = pct ?? (away / max) * 70;

  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="w-6 text-right font-semibold tabular-nums">{home}</span>
      <div className="flex flex-1 items-center gap-0.5">
        <div
          className="h-1 rounded-full bg-emerald-500/60 transition-all"
          style={{ width: `${homePct}%` }}
        />
        <span className="mx-1 w-8 text-center text-[9px] text-muted-foreground">{label}</span>
        <div
          className="h-1 rounded-full bg-rose-500/60 transition-all"
          style={{ width: `${awayPct}%` }}
        />
      </div>
      <span className="w-6 font-semibold tabular-nums">{away}</span>
    </div>
  );
}

export function FootballLiveCard({ match, onOpenDetail }: { match: FootballMatch; onOpenDetail?: () => void }) {
  const live = match.live;
  const p = match.prediction;
  // Hook appelé inconditionnellement (règles des hooks) avant l'early return.
  const [expanded, setExpanded] = useState(false);

  if (!live) return null;

  // Prediction badges (compact, only top confidence)
  const topBadges: { key: string; label: string; isTop: boolean }[] = [];
  if (p.doubleChance && p.doubleChance.prob >= 70) {
    topBadges.push({ key: "dc", label: `DC ${p.doubleChance.selection} ${p.doubleChance.prob}%`, isTop: p.doubleChance.prob >= 75 });
  }
  if (p.over15Prob !== undefined && p.over15Prob >= 70) {
    topBadges.push({ key: "o15", label: `O1.5 ${p.over15Prob}%`, isTop: p.over15Prob >= 75 });
  }
  if (p.bestCornerOver && p.bestCornerOver.overProb >= 65) {
    topBadges.push({ key: "cor", label: `Corn. O${p.bestCornerOver.line}`, isTop: p.bestCornerOver.overProb >= 75 });
  }

  // xG differential for badge (nullable — distinguishes "no data" from true zero)
  const xGdPct = p.xGd != null ? Math.round(p.xGd * 100) : null;
  const xGdHome = xGdPct !== null && xGdPct > 0;
  const xGdAway = xGdPct !== null && xGdPct < 0;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-rose-500/30 bg-gradient-to-b from-rose-500/[0.04] to-card shadow-lg shadow-rose-500/5 transition-all hover:border-rose-500/50">
      {/* Stade en filigrane (fond) — image BSD /img/venue/{id}/, masquée si absente/cassée */}
      {match.venue?.id && (
        <img
          src={`https://sports.bzzoiro.com/img/venue/${match.venue.id}/`}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.07] dark:opacity-[0.05]"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      )}
      <div className="relative p-4">
        {/* Live header */}
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            {match.league.logo && !match.league.logo.startsWith("http") ? (
              <span className="shrink-0">{match.league.logo}</span>
            ) : (
              <span className="shrink-0">{countryFlag(match.league.country)}</span>
            )}
            {match.league.logo && match.league.logo.startsWith("http") && (
              <img src={match.league.logo} alt="" className="h-4 w-4 shrink-0 object-contain" onError={(e) => { e.currentTarget.style.display = "none"; }} />
            )}
            <span className="truncate font-medium">{match.league.name}</span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground/80">
              <Clock className="h-3 w-3" />
              {formatKickoff(match.scheduledAt)}
            </span>
            <LiveBadge minute={live.minute} status={live.status} period={live.period} />
          </div>
        </div>

        {/* Score */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          <div className="flex flex-col items-center gap-1">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-muted">
              {match.home.logo ? (
                <img
                  src={match.home.logo}
                  alt={match.home.name}
                  className="h-7 w-7 object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              ) : (
                <Trophy className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <span className="text-xs font-semibold">{match.home.shortName}</span>
            {(match.home.topScorer || match.home.topAssister || match.home.topDefender) && (
              <span className="flex flex-wrap items-center gap-x-1 text-[8px] leading-none text-muted-foreground">
                {match.home.topScorer && (
                  <span className="tabular-nums" title={`⚽ ${match.home.topScorer.name}`}>⚽{match.home.topScorer.goals}</span>
                )}
                {match.home.topAssister && (
                  <span className="tabular-nums" title={`🎯 ${match.home.topAssister.name}`}>🎯{match.home.topAssister.assists}</span>
                )}
                {match.home.topDefender && (
                  <span className="tabular-nums" title={`🛡️ ${match.home.topDefender.name}`}>🛡️{match.home.topDefender.tackles}</span>
                )}
              </span>
            )}
          </div>
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-3">
              <span className="text-3xl font-black tabular-nums">{live.homeScore}</span>
              <span className="text-xl font-bold text-muted-foreground">:</span>
              <span className="text-3xl font-black tabular-nums">{live.awayScore}</span>
            </div>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-muted">
              {match.away.logo ? (
                <img
                  src={match.away.logo}
                  alt={match.away.name}
                  className="h-7 w-7 object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              ) : (
                <Trophy className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <span className="text-xs font-semibold">{match.away.shortName}</span>
            {(match.away.topScorer || match.away.topAssister || match.away.topDefender) && (
              <span className="flex flex-wrap items-center gap-x-1 text-[8px] leading-none text-muted-foreground">
                {match.away.topScorer && (
                  <span className="tabular-nums" title={`⚽ ${match.away.topScorer.name}`}>⚽{match.away.topScorer.goals}</span>
                )}
                {match.away.topAssister && (
                  <span className="tabular-nums" title={`🎯 ${match.away.topAssister.name}`}>🎯{match.away.topAssister.assists}</span>
                )}
                {match.away.topDefender && (
                  <span className="tabular-nums" title={`🛡️ ${match.away.topDefender.name}`}>🛡️{match.away.topDefender.tackles}</span>
                )}
              </span>
            )}
          </div>
        </div>

        {/* Stats + xG */}
        {(live.homeShots > 0 || live.awayShots > 0 || p.xGa) && (
          <div className="mt-4 space-y-1.5 border-t border-border/40 pt-3">
            {live.homeShots > 0 || live.awayShots > 0 ? (
              <>
                <StatRow label="Poss." home={live.homePossession} away={100 - live.homePossession} pct={live.homePossession / 1} />
                <StatRow label="Tirs" home={live.homeShots} away={live.awayShots} />
                <StatRow label="Cadrés" home={live.homeShotsOnTarget} away={live.awayShotsOnTarget} />
                <StatRow label="Corners" home={live.homeCorners} away={live.awayCorners} />
              </>
            ) : null}
            {p.xGa && p.xGa.total > 0 && (
              <div className="flex items-center gap-2 text-[11px]">
                <span className="w-6 text-right font-semibold tabular-nums text-sky-400">{p.xGa.home.toFixed(1)}</span>
                <div className="flex flex-1 items-center gap-0.5">
                  <div className="h-1 rounded-full bg-sky-500/60 transition-all"
                    style={{ width: `${Math.round((p.xGa.home / Math.max(p.xGa.total, 0.01)) * 70)}%` }} />
                  <span className="mx-1 w-8 text-center text-[9px] font-medium text-sky-400/80">xG</span>
                  <div className="h-1 rounded-full bg-sky-500/40 transition-all"
                    style={{ width: `${Math.round((p.xGa.away / Math.max(p.xGa.total, 0.01)) * 70)}%` }} />
                </div>
                <span className="w-6 font-semibold tabular-nums text-sky-400/70">{p.xGa.away.toFixed(1)}</span>
              </div>
            )}
          </div>
        )}

        {/* xGd badge + Top predictions */}
        {(xGdPct !== null || topBadges.length > 0) && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border/40 pt-3">
            {xGdPct !== null && xGdPct !== 0 && (
              <motion.span
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                  xGdHome
                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                    : "bg-rose-500/15 text-rose-400 border border-rose-500/30",
                )}
              >
                <TrendingUp className={cn("h-3 w-3", xGdAway && "rotate-180")} />
                xGd {xGdPct > 0 ? "+" : ""}{xGdPct}%
              </motion.span>
            )}
            {topBadges.map((b) => (
              <span
                key={b.key}
                className={cn(
                  "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                  b.isTop
                    ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                    : "bg-muted/50 text-muted-foreground border border-border/60",
                )}
              >
                {b.isTop && <span className="text-[9px]">⭐</span>}
                {b.label}
              </span>
            ))}
          </div>
        )}

        {/* Sparkline xG Live — Innovation 3 */}
        {(() => {
          const rawPts = live.xgPerMinute;
          if (rawPts && rawPts.length > 0) {
            // Calculer le xG cumulé à chaque minute
            let homeSum = 0;
            let awaySum = 0;
            const cumul: CumulPoint[] = rawPts.map((pt) => {
              homeSum += pt.home;
              awaySum += pt.away;
              return { minute: pt.minute, homeCumul: homeSum, awayCumul: awaySum };
            });
            return <XGSparkline points={cumul} homeName={match.home.shortName} awayName={match.away.shortName} />;
          }
          return null;
        })()}

        {/* Expandable xG detail drawer */}
        {p.xGa && p.xGa.total > 0 ? (
          <div className="mt-2">
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex w-full items-center justify-between rounded-lg px-2 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted/30"
            >
              <span>📐 Détail xG</span>
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
            <AnimatePresence>
              {expanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-1.5 px-2 pb-1 pt-1.5">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-muted-foreground">xG {match.home.shortName}</span>
                      <span className="font-semibold tabular-nums text-sky-400">{p.xGa.home.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-muted-foreground">xG {match.away.shortName}</span>
                      <span className="font-semibold tabular-nums text-sky-400/70">{p.xGa.away.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-muted-foreground">Total xG</span>
                      <span className="font-semibold tabular-nums">{p.xGa.total.toFixed(2)}</span>
                    </div>
                    {live.homeShotsOnTarget > 0 && Number.isFinite(p.xGa.home) && (
                      <div className="flex justify-between text-[10px]">
                        <span className="text-muted-foreground">xG/Tir {match.home.shortName}</span>
                        <span className="font-semibold tabular-nums text-muted-foreground">
                          {(p.xGa.home / live.homeShotsOnTarget).toFixed(2)}
                        </span>
                      </div>
                    )}
                    {live.awayShotsOnTarget > 0 && Number.isFinite(p.xGa.away) && (
                      <div className="flex justify-between text-[10px]">
                        <span className="text-muted-foreground">xG/Tir {match.away.shortName}</span>
                        <span className="font-semibold tabular-nums text-muted-foreground">
                          {(p.xGa.away / live.awayShotsOnTarget).toFixed(2)}
                        </span>
                      </div>
                    )}
                    {live.homeScore + live.awayScore > 0 && (
                      <div className="mt-1 border-t border-border/30 pt-1">
                        <div className="flex justify-between text-[10px]">
                          <span className="text-muted-foreground">Buts réels</span>
                          <span className="font-semibold tabular-nums">{live.homeScore + live.awayScore}</span>
                        </div>
                        <div className="flex justify-between text-[10px]">
                          <span className="text-muted-foreground">
                            {live.homeScore + live.awayScore > p.xGa.total ? "🔥 Overperformance" : "❄️ Underperformance"}
                          </span>
                          <span className="font-semibold tabular-nums">
                            {(live.homeScore + live.awayScore - p.xGa.total) > 0 ? "+" : ""}
                            {(live.homeScore + live.awayScore - p.xGa.total).toFixed(1)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          /* BF-02: xG live indisponible */
          <div className="mt-2 flex items-center gap-1.5 rounded-md border border-border/40 bg-muted/30 px-2 py-1.5 text-[10px] text-muted-foreground">
            <AlertCircle className="h-3 w-3 shrink-0 text-amber-500" />
            <span>xG live indisponible pour ce match</span>
          </div>
        )}

        {/* Odds */}
        {match.odds && (
          <div className="mt-3 flex justify-center gap-3 border-t border-border/40 pt-3 text-[11px]">
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              1 {match.odds.home.toFixed(2)}
            </span>
            <span className="font-semibold text-amber-600 dark:text-amber-400">
              N {match.odds.draw.toFixed(2)}
            </span>
            <span className="font-semibold text-rose-600 dark:text-rose-400">
              2 {match.odds.away.toFixed(2)}
            </span>
          </div>
        )}

        {/* CTA Momentum (graphe au clic) */}
        {onOpenDetail && (
          <button
            onClick={onOpenDetail}
            className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-border/60 bg-muted/40 px-3 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Voir le momentum du match"
          >
            <Activity className="h-3 w-3" />
            Momentum
          </button>
        )}

        {/* Visionner (LiveTV) */}
        {match.home.name && match.away.name && (
          <div className="mt-2">
            <WatchButton
              sport="football"
              home={match.home.shortName || match.home.name}
              away={match.away.shortName || match.away.name}
              label="Visionner"
              variant="default"
              className="w-full justify-center"
            />
          </div>
        )}
      </div>
    </div>
  );
}

export function FootballLiveCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <Skeleton className="h-4 w-16 rounded-full" />
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-4 w-16 rounded-full" />
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="flex flex-col items-center gap-1.5">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-3 w-12" />
        </div>
        <div className="flex flex-col items-center gap-1">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-3 w-10" />
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-3 w-12" />
        </div>
      </div>
      <div className="mt-3 space-y-1.5">
        <Skeleton className="h-1.5 w-full rounded-full" />
        <Skeleton className="h-1.5 w-full rounded-full" />
        <Skeleton className="h-1.5 w-full rounded-full" />
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Skeleton className="h-4 w-20 rounded-md" />
        <Skeleton className="h-4 w-16 rounded-md" />
        <Skeleton className="h-4 w-24 rounded-md" />
      </div>
      <div className="mt-2 border-t border-border/30 pt-2">
        <Skeleton className="mb-1 h-3 w-24" />
        <Skeleton className="h-14 w-full rounded-md" />
        <Skeleton className="mt-0.5 h-2 w-full" />
      </div>
      <div className="mt-2">
        <Skeleton className="h-6 w-full rounded-lg" />
      </div>
      <div className="mt-3 flex justify-center gap-3 border-t border-border/40 pt-3">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}
