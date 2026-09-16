"use client";

/**
 * FootballHeroHeader — En-tête spécifique onglet Football.
 *
 * Phrase accrocheuse + récap des performances par stratégie (ROI, WR, série)
 * + top championnats avec drapeaux pour orienter l'utilisateur.
 */

import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Trophy, TrendingUp, Target, Zap, Flame, BarChart3, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTop5Backtest } from "@/hooks/use-football-top5-backtest";
import { getFlagUrl, getFlagEmoji } from "@/lib/flag-utils";
import type { StrategyBacktestStats } from "@/lib/top5-backtest/types";

/** Label lisible pour chaque clé de stratégie. */
const STRATEGY_LABELS: Record<string, string> = {
  bestTeam: "Meilleure équipe",
  bestTeam1x2: "Favori 1X2",
  gagnant: "Gagnant",
  bestAttack: "Meilleure attaque",
  bestDefense: "Meilleure défense",
  doubleChance1X: "Double chance 1X",
  doubleChance2X: "Double chance 2X",
  doubleChance12: "Double chance 12",
  over15: "Over 1.5",
  under35: "Under 3.5",
  bttsYes: "Les 2 marquent",
  over65Corners: "Over 6.5 corners",
  dnb: "Draw No Bet",
};

/** Mapping nom de ligue → code ISO pays pour le drapeau. */
const LEAGUE_COUNTRY: Record<string, string> = {
  "Ligue 1": "FR",
  "Ligue 2": "FR",
  "Coupe de France": "FR",
  "Premier League": "GB-ENG",
  "Championship": "GB-ENG",
  "League One": "GB-ENG",
  "League Two": "GB-ENG",
  "National League": "GB-ENG",
  "FA Cup": "GB-ENG",
  "Carabao Cup": "GB-ENG",
  "La Liga": "ES",
  "Segunda División": "ES",
  "Bundesliga": "DE",
  "DFB Pokal": "DE",
  "Serie A": "IT",
  "Serie B": "IT",
  "Coppa Italia": "IT",
  "Liga Portugal Betclic": "PT",
  "Liga Portugal 2": "PT",
  "Taça de Portugal": "PT",
  "Eredivisie": "NL",
  "Pro League": "BE",
  "Scottish Premiership": "GB-SCT",
  "Superliga": "DK",
  "Danish Superliga": "DK",
  "Allsvenskan": "SE",
  "Eliteserien": "NO",
  "Ekstraklasa": "PL",
  "Puchar Polski": "PL",
  "Super Liga": "RO",
  "Parva Liga": "BG",
  "Stoiximan Super League": "GR",
  "Suomen Cup": "FI",
  "Veikkausliiga": "FI",
  "Trendyol Super Lig": "TR",
  "Champions League": "EU",
  "Europa League": "EU",
  "Conference League": "EU",
  "UEFA Super Cup": "EU",
  "UEFA European U19 Championship": "EU",
  "Super League": "CH",
  "Liga MX Clausura": "MX",
  "Liga MX Apertura": "MX",
  "MLS": "US",
  "USL Championship": "US",
  "NWSL": "US",
  "Brasileirão Serie A": "BR",
  "Brasileirão Serie B": "BR",
  "Copa do Brasil": "BR",
  "Liga Profesional de Fútbol": "AR",
  "Categoría Primera A": "CO",
  "Copa Colombia": "CO",
  "Copa Sudamericana": "SA",
  "Copa Libertadores": "SA",
  "Saudi Pro League": "SA",
  "Chinese Super League": "CN",
  "K League 1": "KR",
  "J1 League": "JP",
  "Emperor Cup": "JP",
  "Liga F": "ES",
  "Botola Pro": "MA",
  "Tunisian Ligue Professionnelle 1": "TN",
  "Coupe de Tunisie": "TN",
  "Nigeria Premier Football League": "NG",
  "International Friendly Games": "INTL",
  "Club Friendlies": "INTL",
  "World Cup 2026": "INTL",
  "Liga 3": "ID",
  "NPL Queensland": "AU",
};

/** Récupère le code pays d'une ligue. */
function getLeagueCountryCode(league: string): string | null {
  // Match exact
  if (LEAGUE_COUNTRY[league]) return LEAGUE_COUNTRY[league];
  // Match par substring (ex: "Ligue 1 2025" → "FR")
  for (const [key, code] of Object.entries(LEAGUE_COUNTRY)) {
    if (league.includes(key)) return code;
  }
  return null;
}

/** Icône par famille de stratégie. */
function StrategyIcon({ strategyKey }: { strategyKey: string }) {
  if (strategyKey.includes("Corner")) return <BarChart3 className="h-3 w-3" />;
  if (strategyKey.includes("over") || strategyKey.includes("btts")) return <Zap className="h-3 w-3" />;
  if (strategyKey.includes("double") || strategyKey.includes("dnb")) return <Target className="h-3 w-3" />;
  if (strategyKey.includes("Attack")) return <Flame className="h-3 w-3" />;
  if (strategyKey.includes("Defense")) return <TrendingUp className="h-3 w-3" />;
  return <Trophy className="h-3 w-3" />;
}

/** Badge ROI coloré. */
function ROIBadge({ stats }: { stats: StrategyBacktestStats }) {
  const roi = stats.roi.roiPct;
  const n = stats.roi.nWithOdds;
  if (roi == null || n < 10) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
        roi >= 10
          ? "bg-emerald-500/20 text-emerald-300"
          : roi >= 0
            ? "bg-emerald-500/10 text-emerald-400/80"
            : "bg-red-500/15 text-red-400",
      )}
    >
      {roi > 0 ? "+" : ""}
      {roi.toFixed(1)}%
    </span>
  );
}

/** Compteur animé minimaliste. */
function CountUp({ value, duration = 1.0 }: { value: number; duration?: number }) {
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(reduceMotion ? value : 0);

  useEffect(() => {
    if (reduceMotion || value === 0) {
      setDisplay(value);
      return;
    }
    const start = performance.now();
    let raf: number;
    const tick = (now: number) => {
      const progress = Math.min((now - start) / (duration * 1000), 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * value));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, reduceMotion]);

  return <span className="tabular-nums">{display.toLocaleString("fr-FR")}</span>;
}

/** Drapeau pays en img avec fallback emoji. */
function CountryFlagImg({ countryCode, size = 16 }: { countryCode: string; size?: number }) {
  const [error, setError] = useState(false);
  if (error || !countryCode) {
    return <span style={{ fontSize: size * 0.7 }}>{getFlagEmoji(countryCode)}</span>;
  }
  return (
    <img
      src={getFlagUrl(countryCode, size)}
      alt=""
      width={size}
      height={Math.round(size * 0.75)}
      className="inline-block"
      onError={() => setError(true)}
    />
  );
}

export function FootballHeroHeader() {
  const { summary } = useTop5Backtest("football");
  const reduceMotion = useReducedMotion();

  const strategies = summary?.strategies ?? {};

  // Top 3 stratégies par ROI (échantillon ≥ 20)
  const topStrategies = useMemo(() => {
    return Object.entries(strategies)
      .filter(([, s]) => s.roi.roiPct != null && s.roi.nWithOdds >= 20)
      .sort((a, b) => (b[1].roi.roiPct ?? -Infinity) - (a[1].roi.roiPct ?? -Infinity))
      .slice(0, 3);
  }, [strategies]);

  // Stats globales
  const totalPicks = useMemo(
    () => Object.values(strategies).reduce((a, s) => a + s.n, 0),
    [strategies],
  );
  const totalWins = useMemo(
    () => Object.values(strategies).reduce((a, s) => a + s.wins, 0),
    [strategies],
  );
  const totalDecided = useMemo(
    () => Object.values(strategies).reduce((a, s) => a + s.wins + s.losses, 0),
    [strategies],
  );
  const globalWinRate = totalDecided > 0 ? (totalWins / totalDecided) * 100 : null;

  // Meilleure série en cours
  const bestStreak = useMemo(() => {
    let best = 0;
    let bestKey = "";
    for (const [key, s] of Object.entries(strategies)) {
      if (s.currentStreak > best) {
        best = s.currentStreak;
        bestKey = key;
      }
    }
    return { streak: best, key: bestKey };
  }, [strategies]);

  // Top championnats par nombre de picks (depuis byLeague si dispo)
  const topLeagues = useMemo(() => {
    if (!summary?.byLeague) return [];
    // Prendre la première stratégie pour compter les picks par ligue
    const firstStrategy = Object.keys(strategies)[0];
    if (!firstStrategy || !summary.byLeague[firstStrategy]) return [];
    const leagueData = summary.byLeague[firstStrategy];
    return Object.entries(leagueData)
      .map(([name, stats]) => ({
        name,
        picks: stats.n,
        winRate: stats.winRatePct,
        roi: stats.roi.roiPct,
        countryCode: getLeagueCountryCode(name),
      }))
      .sort((a, b) => b.picks - a.picks)
      .slice(0, 5);
  }, [summary?.byLeague, strategies]);

  const containerVariants = useMemo(
    () => ({
      hidden: {},
      visible: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
    }),
    [],
  );

  const itemVariants = useMemo(
    () => ({
      hidden: reduceMotion ? {} : { opacity: 0, y: 14 },
      visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.25, 0.1, 0.25, 1] as const } },
    }),
    [reduceMotion],
  );

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-2xl border border-white/[0.06]",
        "bg-gradient-to-b from-[#0c1220] via-[#0f1628] to-[#0c1220]",
      )}
    >
      <motion.div initial="hidden" animate="visible" variants={containerVariants}>
        {/* Grid pattern */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)
            `,
            backgroundSize: "40px 40px",
          }}
        />

        {/* Glow vert football */}
        <div
          className="pointer-events-none absolute -left-32 top-0 h-[400px] w-[400px] rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(0,230,118,0.1), transparent 65%)" }}
        />
        <div
          className="pointer-events-none absolute -right-32 top-0 h-[350px] w-[350px] rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(41,182,246,0.06), transparent 65%)" }}
        />

        {/* Vignette bas */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#0c1220]/90 to-transparent" />

        <div className="relative px-5 py-5 sm:px-8 sm:py-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">

            {/* Bloc gauche : accroche + stats */}
            <div className="min-w-0 flex-1">
              {/* Badge animé */}
              <motion.div variants={itemVariants} className="flex items-center gap-2.5">
                <span className="relative inline-flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-50" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                </span>
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-400">
                  Football
                </span>
                <span className="ml-1 inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300/80">
                  <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {totalDecided > 0 ? `${totalDecided} picks analysés` : "Scanner actif"}
                </span>
              </motion.div>

              {/* Titre accrocheur */}
              <motion.h1
                variants={itemVariants}
                className="mt-3 text-2xl font-black tracking-tight sm:text-3xl lg:text-4xl"
              >
                <span className="text-white">Dominez le terrain</span>
                <br />
                <span className="bg-gradient-to-r from-emerald-400 via-emerald-300 to-sky-400 bg-clip-text text-transparent">
                  avec la data football
                </span>
              </motion.h1>

              {/* Description */}
              <motion.p variants={itemVariants} className="mt-3 max-w-lg text-sm leading-relaxed text-zinc-400">
                <span className="font-semibold text-zinc-200">{totalPicks.toLocaleString("fr-FR")}</span> picks
                scorés sur{" "}
                <span className="font-semibold text-emerald-400">
                  {Object.keys(strategies).length} stratégies
                </span>
                {globalWinRate != null && (
                  <>
                    {" "}· WR global{" "}
                    <span className={cn("font-bold", globalWinRate >= 50 ? "text-emerald-300" : "text-amber-300")}>
                      {globalWinRate.toFixed(0)}%
                    </span>
                  </>
                )}
                {bestStreak.streak > 2 && (
                  <>
                    {" "}· Série{" "}
                    <span className="font-bold text-emerald-300">+{bestStreak.streak}</span>
                  </>
                )}
                .
              </motion.p>

              {/* Stats rapides */}
              <motion.div variants={itemVariants} className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                    <Trophy className="h-3.5 w-3.5" />
                  </span>
                  <div className="flex flex-col">
                    <span className="text-lg font-bold leading-none text-zinc-100 tabular-nums">
                      <CountUp value={totalPicks} />
                    </span>
                    <span className="mt-0.5 text-[10px] text-zinc-500">picks</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#7B3FA0]/10 text-[#7B3FA0]">
                    <Target className="h-3.5 w-3.5" />
                  </span>
                  <div className="flex flex-col">
                    <span className="text-lg font-bold leading-none text-[#7B3FA0] tabular-nums">
                      <CountUp value={Object.keys(strategies).length} />
                    </span>
                    <span className="mt-0.5 text-[10px] text-zinc-500">stratégies</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/10 text-sky-400">
                    <Zap className="h-3.5 w-3.5" />
                  </span>
                  <div className="flex flex-col">
                    <span className="text-lg font-bold leading-none text-sky-400 tabular-nums">
                      <CountUp value={totalWins} />
                    </span>
                    <span className="mt-0.5 text-[10px] text-zinc-500">gagnés</span>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Bloc droit : Top 3 stratégies + Top championnats */}
            <motion.div
              variants={itemVariants}
              className="shrink-0 space-y-4 lg:max-w-xs"
            >
              {/* Top stratégies ROI */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10">
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400">
                    Top stratégies ROI
                  </span>
                </div>

                {topStrategies.length > 0 ? (
                  <div className="space-y-2">
                    {topStrategies.map(([key, stats], i) => (
                      <div key={key} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-[10px] font-bold text-zinc-600 tabular-nums w-3">
                            {i + 1}.
                          </span>
                          <StrategyIcon strategyKey={key} />
                          <span className="truncate text-[11px] text-zinc-300">
                            {STRATEGY_LABELS[key] ?? key}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] text-zinc-500 tabular-nums">
                            {stats.winRatePct != null ? `${stats.winRatePct.toFixed(0)}%` : "—"}
                          </span>
                          <ROIBadge stats={stats} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] leading-relaxed text-zinc-500">
                    Les performances par stratégie apparaîtront ici après suffisamment de picks analysés.
                  </p>
                )}
              </div>

              {/* Top championnats */}
              {topLeagues.length > 0 && (
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/10">
                      <Globe className="h-3.5 w-3.5 text-sky-400" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400">
                      Championnats suivis
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {topLeagues.map((l) => (
                      <div key={l.name} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {l.countryCode ? (
                            <CountryFlagImg countryCode={l.countryCode} size={14} />
                          ) : (
                            <Globe className="h-3 w-3 text-zinc-600" />
                          )}
                          <span className="truncate text-[11px] text-zinc-300">{l.name}</span>
                        </div>
                        <span className="text-[10px] text-zinc-500 tabular-nums shrink-0">
                          {l.picks} picks
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {summary?.updatedAt && (
                <p className="text-[9px] text-zinc-600 text-right">
                  Mis à jour : {new Date(summary.updatedAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                </p>
              )}
            </motion.div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
