"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Clock, Activity, TrendingUp, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { ScoreFlash } from "@/components/shared/score-flash";
import type { FootballMatch } from "@/lib/football-data";
import { parisKickoff } from "@/lib/football-time";
import { countryFlag } from "@/lib/bsd-football-fetcher";
import { CORNER_OVER_MIN_PROB } from "@/lib/football-predictions";
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
  // Aires cumulatives (xG 2.0) : remplissage dégradé sous chaque courbe —
  // la domination se lit en surface, pas seulement en ligne.
  const baseY = y(0).toFixed(1);
  const homeArea = homePath && points.length > 0
    ? `${homePath} L ${x(points[points.length - 1].minute).toFixed(1)} ${baseY} L ${x(points[0].minute).toFixed(1)} ${baseY} Z`
    : "";
  const awayArea = awayPath && points.length > 0
    ? `${awayPath} L ${x(points[points.length - 1].minute).toFixed(1)} ${baseY} L ${x(points[0].minute).toFixed(1)} ${baseY} Z`
    : "";

  // Momentum xG par tranche de 10' : ΔxG = (home - away) sur la fenêtre.
  // Barres emerald vers le haut (domination home) / rose vers le bas (away).
  const SLOT = 10;
  const slots: { start: number; delta: number }[] = [];
  if (points.length >= 1) {
    let base = points[0];
    for (let start = points[0].minute; start < maxMin; start += SLOT) {
      const end = Math.min(start + SLOT, maxMin);
      const inWindow = points.filter((pt) => pt.minute > start && pt.minute <= end);
      const last = inWindow.length > 0 ? inWindow[inWindow.length - 1] : base;
      slots.push({
        start,
        delta: (last.homeCumul - base.homeCumul) - (last.awayCumul - base.awayCumul),
      });
      base = last;
    }
  }
  const maxAbsDelta = Math.max(0.05, ...slots.map((s) => Math.abs(s.delta)));

  return (
    <div className="mt-2 border-t border-border/30 pt-2">
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="inline-flex items-center gap-1 font-semibold uppercase tracking-wider text-muted-foreground"><TrendingUp className="h-3 w-3" aria-hidden="true" /> Évolution xG</span>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><span className="inline-block h-1.5 w-3 rounded-sm bg-emerald-500" /> {homeName}</span>
          <span className="inline-flex items-center gap-1"><span className="inline-block h-1.5 w-3 rounded-sm bg-rose-500" /> {awayName}</span>
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" role="img" aria-label={`Évolution xG cumulé — ${homeName} vs ${awayName}`}>
        <defs>
          <linearGradient id="xgGradHome" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity={0.22} />
            <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="xgGradAway" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.18} />
            <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        {/* Grille horizontale légère */}
        {[0.25, 0.5, 0.75, 1].map((frac) => (
          <line key={`grid-${frac}`} x1={PAD_L} y1={y(maxY * frac)} x2={W - PAD_R} y2={y(maxY * frac)} stroke="currentColor" strokeOpacity={0.08} strokeWidth={1} className="text-muted-foreground" />
        ))}
        {/* Ligne de base */}
        <line x1={PAD_L} y1={y(0)} x2={W - PAD_R} y2={y(0)} stroke="currentColor" strokeOpacity={0.2} strokeWidth={1} className="text-muted-foreground" />
        {/* Aires cumulatives (domination en surface) */}
        {awayArea && <path d={awayArea} fill="url(#xgGradAway)" />}
        {homeArea && <path d={homeArea} fill="url(#xgGradHome)" />}
        {/* Courbes */}
        {awayPath && <path d={awayPath} fill="none" stroke="#f43f5e" strokeWidth={1.5} strokeOpacity={0.7} strokeLinecap="round" strokeLinejoin="round" />}
        {homePath && <path d={homePath} fill="none" stroke="#10b981" strokeWidth={1.8} strokeOpacity={0.85} strokeLinecap="round" strokeLinejoin="round" />}
        {/* Dernier point (valeur actuelle) */}
        {points.length > 0 && (() => {
          const last = points[points.length - 1];
          return (
            <>
              <circle cx={x(last.minute)} cy={y(last.homeCumul)} r="6" fill="#10b981" opacity={0.15} className="animate-pulse-soft" />
              <circle cx={x(last.minute)} cy={y(last.homeCumul)} r="3" fill="#10b981" stroke="#fff" strokeWidth="0.5" />
              <circle cx={x(last.minute)} cy={y(last.awayCumul)} r="6" fill="#f43f5e" opacity={0.15} className="animate-pulse-soft" />
              <circle cx={x(last.minute)} cy={y(last.awayCumul)} r="3" fill="#f43f5e" stroke="#fff" strokeWidth="0.5" />
            </>
          );
        })()}
      </svg>
      {/* Axe minutes */}
      <div className="mt-0.5 flex justify-between text-xs text-muted-foreground/60">
        <span>0&apos;</span>
        <span>{Math.round(maxMin / 2)}&apos;</span>
        <span>{maxMin}&apos;</span>
      </div>
      {/* Momentum xG par tranches (ΔxG 10') — la poussée se lit d'un coup d'œil */}
      <div
        className="relative mt-1.5 flex h-3.5 items-center gap-1"
        role="img"
        aria-label="Momentum xG par tranches de 10 minutes — vert : avantage domicile, rouge : extérieur"
      >
        <div className="absolute inset-x-0 top-1/2 h-px bg-border/40" />
        {slots.map((s) => {
          const h = Math.max(2, (Math.abs(s.delta) / maxAbsDelta) * 10);
          return (
            <div
              key={s.start}
              className="relative flex-1"
              title={`${s.start}'–${s.start + SLOT}' : ΔxG ${s.delta >= 0 ? "+" : ""}${s.delta.toFixed(2)}`}
            >
              <div
                className={cn(
                  "absolute left-0 right-0 rounded-sm",
                  s.delta >= 0 ? "bg-emerald-500/70" : "bg-rose-500/70",
                )}
                style={
                  s.delta >= 0
                    ? { height: `${h}px`, bottom: "50%", marginBottom: 1 }
                    : { height: `${h}px`, top: "50%", marginTop: 1 }
                }
              />
            </div>
          );
        })}
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
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold uppercase tracking-wider",
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
    <div className="flex items-center gap-2 text-sm">
      <span className="w-6 text-right font-display text-sm font-bold tabular-nums text-foreground">{home}</span>
      <div className="flex flex-1 items-center gap-0.5">
        <div
          className="h-1.5 rounded-full bg-emerald-500/60 transition-[width]"
          style={{ width: `${homePct}%` }}
        />
        <span className="mx-1 w-8 text-center text-xs font-medium uppercase tracking-wider text-slate-400">{label}</span>
        <div
          className="h-1.5 rounded-full bg-rose-500/60 transition-[width]"
          style={{ width: `${awayPct}%` }}
        />
      </div>
      <span className="w-6 font-display text-sm font-bold tabular-nums text-foreground">{away}</span>
    </div>
  );
}

export function FootballLiveCard({ match, onOpenDetail }: { match: FootballMatch; onOpenDetail?: (m: FootballMatch) => void }) {
  const live = match.live;
  const p = match.prediction;
  // Hook appelé inconditionnellement (règles des hooks) avant l'early return.
  const [expanded, setExpanded] = useState(false);

  // Annonceur live contextuel : le score est annoncé en toutes lettres à
  // chaque but (aria-atomic = message complet, jamais un chiffre nu).
  const scoreKey = live ? `${live.homeScore}-${live.awayScore}` : "";
  const scoreAnnounceRef = useRef(scoreKey);
  const [scoreAnnounce, setScoreAnnounce] = useState("");
  useEffect(() => {
    if (!live || !scoreKey) return;
    if (scoreAnnounceRef.current !== scoreKey) {
      scoreAnnounceRef.current = scoreKey;
      setScoreAnnounce(
        `${match.home.name} ${live.homeScore} — ${live.awayScore} ${match.away.name}`,
      );
    }
  }, [scoreKey, live, match.home.name, match.away.name]);

  if (!live) return null;

  // Prediction badges (compact, only top confidence)
  const topBadges: { key: string; label: string; isTop: boolean }[] = [];
  if (p.doubleChance && p.doubleChance.prob >= 70) {
    topBadges.push({ key: "dc", label: `DC ${p.doubleChance.selection} ${p.doubleChance.prob}%`, isTop: p.doubleChance.prob >= 75 });
  }
  if (p.over15Prob !== undefined && p.over15Prob >= 70) {
    topBadges.push({ key: "o15", label: `O1.5 ${p.over15Prob}%`, isTop: p.over15Prob >= 75 });
  }
  if (p.bestCornerOver && p.bestCornerOver.over65Prob >= CORNER_OVER_MIN_PROB) {
    topBadges.push({ key: "cor", label: `Corn. O6.5 ${p.bestCornerOver.over65Prob}%`, isTop: p.bestCornerOver.over65Prob >= 75 });
  }

  // xG differential for badge (nullable — distinguishes "no data" from true zero)
  const xGdPct = p.xGd != null ? Math.round(p.xGd * 100) : null;
  const xGdHome = xGdPct !== null && xGdPct > 0;
  const xGdAway = xGdPct !== null && xGdPct < 0;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-rose-500/30 bg-gradient-to-b from-rose-500/[0.04] to-card shadow-lg shadow-rose-500/5 transition-[border-color] hover:border-rose-500/50">
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
        <div aria-live="polite" aria-atomic="true" role="status" className="sr-only">
          {scoreAnnounce}
        </div>
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
            <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground/80">
              <Clock className="h-3 w-3" />
              {parisKickoff(match.scheduledAt)}
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
              <span className="flex flex-wrap items-center gap-x-1 text-xs leading-none text-muted-foreground">
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
            <ScoreFlash scoreKey={scoreKey} className="flex items-center gap-3">
              <span className="text-3xl font-black tabular-nums">{live.homeScore}</span>
              <span className="text-xl font-bold text-muted-foreground">:</span>
              <span className="text-3xl font-black tabular-nums">{live.awayScore}</span>
            </ScoreFlash>
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
              <span className="flex flex-wrap items-center gap-x-1 text-xs leading-none text-muted-foreground">
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
        {(live.homeShots !== null || live.awayShots !== null || p.xGa) && (
          <div className="mt-4 space-y-1.5 border-t border-border/40 pt-3">
            {(live.homeShots ?? 0) > 0 || (live.awayShots ?? 0) > 0 ? (
              <>
                <StatRow label="Poss." home={live.homePossession} away={100 - live.homePossession} pct={live.homePossession / 1} />
                {live.homeShots !== null && live.awayShots !== null && (
                  <StatRow label="Tirs" home={live.homeShots} away={live.awayShots} />
                )}
                {live.homeShotsOnTarget !== null && live.awayShotsOnTarget !== null && (
                  <StatRow label="Cadrés" home={live.homeShotsOnTarget} away={live.awayShotsOnTarget} />
                )}
                {live.homeCorners !== null && live.awayCorners !== null && (
                  <StatRow label="Corners" home={live.homeCorners} away={live.awayCorners} />
                )}
              </>
            ) : null}
            {p.xGa && p.xGa.total > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <span className="w-6 text-right font-display text-sm font-bold tabular-nums text-foreground">{p.xGa.home.toFixed(1)}</span>
                <div className="flex flex-1 items-center gap-0.5">
                  <div className="h-1.5 rounded-full bg-sky-500/60 transition-[width]"
                    style={{ width: `${Math.round((p.xGa.home / Math.max(p.xGa.total, 0.01)) * 70)}%` }} />
                  <span className="mx-1 w-8 text-center text-xs font-medium uppercase tracking-wider text-slate-400">xG</span>
                  <div className="h-1.5 rounded-full bg-sky-500/40 transition-[width]"
                    style={{ width: `${Math.round((p.xGa.away / Math.max(p.xGa.total, 0.01)) * 70)}%` }} />
                </div>
                <span className="w-6 font-display text-sm font-bold tabular-nums text-foreground">{p.xGa.away.toFixed(1)}</span>
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
                  "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-bold tabular-nums",
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
                  "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums",
                  b.isTop
                    ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                    : "bg-muted/50 text-muted-foreground border border-border/60",
                )}
              >
                {b.isTop && <span className="text-xs">⭐</span>}
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
              className="flex w-full items-center justify-between rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/30"
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
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">xG {match.home.shortName}</span>
                      <span className="font-semibold tabular-nums text-sky-400">{p.xGa.home.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">xG {match.away.shortName}</span>
                      <span className="font-semibold tabular-nums text-sky-400/70">{p.xGa.away.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Total xG</span>
                      <span className="font-semibold tabular-nums">{p.xGa.total.toFixed(2)}</span>
                    </div>
                    {typeof live.homeShotsOnTarget === "number" && live.homeShotsOnTarget > 0 && Number.isFinite(p.xGa.home) && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">xG/Tir {match.home.shortName}</span>
                        <span className="font-semibold tabular-nums text-muted-foreground">
                          {(p.xGa.home / live.homeShotsOnTarget).toFixed(2)}
                        </span>
                      </div>
                    )}
                    {typeof live.awayShotsOnTarget === "number" && live.awayShotsOnTarget > 0 && Number.isFinite(p.xGa.away) && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">xG/Tir {match.away.shortName}</span>
                        <span className="font-semibold tabular-nums text-muted-foreground">
                          {(p.xGa.away / live.awayShotsOnTarget).toFixed(2)}
                        </span>
                      </div>
                    )}
                    {live.homeScore + live.awayScore > 0 && (
                      <div className="mt-1 border-t border-border/30 pt-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Buts réels</span>
                          <span className="font-semibold tabular-nums">{live.homeScore + live.awayScore}</span>
                        </div>
                        <div className="flex justify-between text-xs">
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
          <div className="mt-2 flex items-center gap-1.5 rounded-md border border-border/40 bg-muted/30 px-2 py-1.5 text-xs text-muted-foreground">
            <AlertCircle className="h-3 w-3 shrink-0 text-amber-500" />
            <span>xG live indisponible pour ce match</span>
          </div>
        )}

        {/* Odds */}
        {match.odds && (
          <div className="mt-3 flex justify-center gap-3 border-t border-border/40 pt-3 text-xs">
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
            onClick={() => onOpenDetail(match)}
            className="mt-3 inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-border/60 bg-muted/40 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

      {/* Live dock mobile (B5) — score + proba jamais perdus pendant le scroll */}
      <div className="sticky bottom-0 z-30 -mx-4 mt-3 border-t border-rose-500/20 bg-card/90 px-4 py-2 backdrop-blur-md md:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-xs font-medium text-muted-foreground">
              {match.home.shortName}
            </span>
            <span className="font-mono text-lg font-black tabular-nums leading-none">
              {live.homeScore}
              <span className="mx-1 font-bold text-muted-foreground">–</span>
              {live.awayScore}
            </span>
            <span className="truncate text-xs font-medium text-muted-foreground">
              {match.away.shortName}
            </span>
          </div>
          {p.homeProb != null && (
            <span className="shrink-0 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-xs font-bold tabular-nums text-emerald-400">
              {Math.round(p.homeProb)}%
            </span>
          )}
          {onOpenDetail && (
            <button
              type="button"
              onClick={() => onOpenDetail(match)}
              className="shrink-0 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-emerald-950 transition-colors hover:bg-emerald-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              title="Voir le match et parier"
            >
              Parier
            </button>
          )}
        </div>
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
