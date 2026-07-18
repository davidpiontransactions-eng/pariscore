"use client";

import { useMemo, useState, lazy, Suspense, Component, type ReactNode } from "react";
import { Trophy, SlidersHorizontal, TrendingUp, Info, RefreshCw, AlertCircle, HelpCircle, Wallet, Code, FlaskConical, Scale } from "lucide-react";
import { useTranslations } from "next-intl";
import { openPrivacyDialog } from "@/components/privacy-dialog";
import { openAboutDialog } from "@/components/about-dialog";
import { openApiDocsDialog } from "@/components/api-docs-dialog";
import { openPaperTradingDialog } from "@/components/paper-trading-dialog";
import { openBookmakerComparatorDialog } from "@/components/bookmaker-comparator-dialog";
import { MatchCard } from "@/components/tennis/match-card";
// Lazy-load the detail dialog (Recharts is heavy ~200KB) — only loads when user opens it
const MatchDetailDialog = lazy(() =>
  import("@/components/tennis/match-detail-dialog").then((m) => ({ default: m.MatchDetailDialog }))
);
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { PushToggle } from "@/components/push-toggle";
import { EmailToggle } from "@/components/email-toggle";
import { TerminalToggle } from "@/components/terminal-toggle";
import { BetDialog } from "@/components/bet-dialog";
import { openBankrollDialog } from "@/components/bankroll-dialog";
import { ValueBetScannerIndicator } from "@/components/value-bet-scanner-indicator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { usePrematchMatches } from "@/hooks/use-prematch-matches";
import { useLiveMatches } from "@/hooks/use-live-matches";
import { useFavorites } from "@/hooks/use-favorites";
import { useTerminalMode } from "@/hooks/use-terminal-mode";
import { useAnalytics } from "@/components/analytics-provider";
import { useEffect } from "react";
import type { TennisMatch } from "@/lib/tennis-data";
import { MATCHES } from "@/lib/tennis-data";
import {
  AB_TEST_DEFAULT_VARIANT,
  AB_TEST_FLAG_KEY,
  AB_TEST_OVERRIDE_EVENT,
  asAbTestVariant,
  getAbTestOverride,
  type AbTestVariant,
} from "@/lib/ab-test";
import { cn } from "@/lib/utils";

type FilterKey = "all" | "favorites" | "balanced" | "starred";

/**
 * Absolute site URL used in SportsEvent JSON-LD `url` fields.
 * Falls back to the placeholder domain when the env var is not set.
 */
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://setpoint.example";

/**
 * Build a schema.org/SportsEvent JSON-LD object for a tennis match.
 *
 * Uses the static `MATCHES` mock as the SSR source (the page is a client
 * component with no server fetch). The script is rendered into the initial
 * HTML so crawlers see the structured data without executing JS.
 */
function buildSportsEventJsonLd(match: TennisMatch) {
  const name = `${match.playerA.name} vs ${match.playerB.name} — ${match.tournament} ${match.round}`;
  return {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name,
    sport: "Tennis",
    startDate: match.scheduledAt,
    eventStatus: "https://schema.org/EventScheduled",
    location: {
      "@type": "Place",
      name: match.tournament,
    },
    homeTeam: {
      "@type": "SportsTeam",
      name: match.playerA.name,
      athlete: {
        "@type": "Person",
        name: match.playerA.name,
      },
    },
    awayTeam: {
      "@type": "SportsTeam",
      name: match.playerB.name,
      athlete: {
        "@type": "Person",
        name: match.playerB.name,
      },
    },
    url: `${SITE_URL}/`,
  };
}

// Error boundary to capture the intermittent client-side crash
// and log the exact error message for diagnosis.
class PageErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: { componentStack?: string }) {
    console.error("[SetPoint CRASH]", error.message, error.stack);
    if (typeof window !== "undefined") {
      // Also expose it on window for remote inspection
      (window as any).__SETPOINT_CRASH = { error: error.message, stack: error.stack, componentStack: info.componentStack };
    }
  }
  render() {
    if (this.state.error) {
      return <div />; // Let the parent error.tsx handle the fallback UI
    }
    return this.props.children;
  }
}

export default function Home() {
  const t = useTranslations("common");
  const tFilters = useTranslations("filters");
  const tTime = useTranslations("time");
  const tPrivacy = useTranslations("privacy");
  const tAbout = useTranslations("about");
  const tBankroll = useTranslations("bankroll");
  const tApiDocs = useTranslations("apiDocs");
  const tPaper = useTranslations("paperTrading");
  const tComparator = useTranslations("comparator");
  const tTerminal = useTranslations("terminal");

  const { data, error, isLoading, isValidating, mutate } = usePrematchMatches();
  const { liveStates, connectionStatus, latency } = useLiveMatches();
  const { favorites, count: favCount } = useFavorites();
  const { terminalMode } = useTerminalMode();
  const { track, getVariant, reloadFlags, setPersonProperties } = useAnalytics();

  const [filter, setFilter] = useState<FilterKey>("all");
  const [detailMatch, setDetailMatch] = useState<TennisMatch | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [betMatch, setBetMatch] = useState<TennisMatch | null>(null);
  const [betOpen, setBetOpen] = useState(false);

  const FILTERS: { key: FilterKey; label: string; hint: string }[] = [
    { key: "all", label: tFilters("all"), hint: tFilters("allHint") },
    { key: "favorites", label: tFilters("favorites"), hint: tFilters("favoritesHint") },
    { key: "balanced", label: tFilters("balanced"), hint: tFilters("balancedHint") },
    { key: "starred", label: `${tFilters("starred")} (${favCount})`, hint: tFilters("starredHint") },
  ];

  const openDetail = (match: TennisMatch) => {
    setDetailMatch(match);
    setDetailOpen(true);
    track("detail_dialog_open", {
      match_id: match.id,
      player_a: match.playerA.name,
      player_b: match.playerB.name,
    });
  };

  const openBet = (match: TennisMatch) => {
    setBetMatch(match);
    setBetOpen(true);
  };

  // A/B variant: "chips_visible" (control, default) vs "chips_collapsed" (treatment)
  // Treatment hides the stats chips behind a toggle to test if they hurt or help conversion
  const [variant, setVariant] = useState<AbTestVariant | null>(null);

  // Experiment assignment effect.
  //
  // In-vivo instrumentation (task ABTEST-1):
  //  1. A dev/QA override in localStorage wins over PostHog so the debug
  //     badge can force-switch variants.
  //  2. Otherwise we reload PostHog feature flags and read
  //     `tennis-prematch-chips-layout` via `getFeatureFlag`.
  //  3. We set a person property on the PostHog identity whose key is the
  //     flag key — PostHog then automatically attaches this property to
  //     EVERY subsequent event (match_card_view, bet_cta_click, detail_open,
  //     bet_placed, favorite_toggled, ...), so any funnel or insight can
  //     be broken down by variant without per-call plumbing.
  //  4. We fire a manual `experiment_assigned` sentinel event carrying the
  //     PostHog-convention `$feature/<flag_key>` property plus `experiment`
  //     and `variant` for human-readable attribution.
  //  5. In dev we log `[AB] variant=<v>` to the console for debugging.
  useEffect(() => {
    let cancelled = false;

    const assign = async (source: "override" | "posthog" | "default") => {
      // Dev/QA override wins
      const override = getAbTestOverride();
      if (override) {
        if (cancelled) return;
        await Promise.resolve();
        if (cancelled) return;
        setVariant(override);
        // Still record the override as a person property so dev events are
        // consistent with the production attribution flow.
        setPersonProperties({ [AB_TEST_FLAG_KEY]: override });
        track("experiment_assigned", {
          [`$feature/${AB_TEST_FLAG_KEY}`]: override,
          experiment: AB_TEST_FLAG_KEY,
          variant: override,
          overridden: true,
        });
        if (process.env.NODE_ENV !== "production") {
          console.log(`[AB] variant=${override} (overridden)`);
        }
        return;
      }

      // Read from PostHog (or fall back to the control variant when the
      // PostHog key is not configured — e.g. local dev without a key).
      let v: AbTestVariant;
      if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) {
        v = AB_TEST_DEFAULT_VARIANT;
      } else {
        await reloadFlags();
        const flagValue = getVariant(AB_TEST_FLAG_KEY);
        v = asAbTestVariant(flagValue ?? AB_TEST_DEFAULT_VARIANT);
      }
      if (cancelled) return;
      await Promise.resolve();
      if (cancelled) return;
      setVariant(v);
      // Propagate the variant to ALL subsequent PostHog events via a
      // person property — this is the recommended attribution mechanism.
      setPersonProperties({ [AB_TEST_FLAG_KEY]: v });
      track("experiment_assigned", {
        [`$feature/${AB_TEST_FLAG_KEY}`]: v,
        experiment: AB_TEST_FLAG_KEY,
        variant: v,
        source,
      });
      if (process.env.NODE_ENV !== "production") {
        console.log(`[AB] variant=${v}`);
      }
    };

    assign("posthog");

    // Re-assign whenever the debug badge toggles the override.
    const onOverrideChange = () => {
      assign("override");
    };
    window.addEventListener(AB_TEST_OVERRIDE_EVENT, onOverrideChange);
    return () => {
      cancelled = true;
      window.removeEventListener(AB_TEST_OVERRIDE_EVENT, onOverrideChange);
    };
  }, [reloadFlags, getVariant, track, setPersonProperties]);

  // Track page view once
  useEffect(() => {
    track("page_view", { route: "/", tab: "tennis_prematch" });
  }, [track]);

  const matches: TennisMatch[] = data?.matches ?? [];

  // Compute value bet edge for each match (P3 — Bet Action Hub default sort)
  const matchesWithEdge = useMemo(() => {
    return matches.map((m) => {
      let maxEdge = 0;
      if (m.allOdds) {
        for (const o of m.allOdds) {
          const edge = m.probA - o.impliedProbA;
          if (edge > maxEdge) maxEdge = edge;
        }
      }
      return { match: m, edge: maxEdge };
    });
  }, [matches]);

  const filtered = useMemo(() => {
    let result = matchesWithEdge;
    if (filter === "favorites") result = result.filter(({ match }) => match.probA >= 70);
    else if (filter === "balanced") result = result.filter(({ match }) => match.probA < 60);
    else if (filter === "starred") result = result.filter(({ match }) => favorites.has(match.id));
    // P3: sort by edge descending (value bets first), then by probA for tiebreaker
    return result
      .sort((a, b) => b.edge - a.edge || b.match.probA - a.match.probA)
      .map(({ match }) => match);
  }, [filter, matchesWithEdge, favorites]);

  // P3: value bets count for the banner
  const valueBetCount = matchesWithEdge.filter(({ edge }) => edge >= 3).length;

  const handleFilter = (key: FilterKey) => {
    setFilter(key);
    track("filter_click", { filter: key });
  };

  const handleRefresh = () => {
    mutate();
    track("manual_refresh");
  };

  return (
    <PageErrorBoundary>
    <div className="min-h-screen flex flex-col bg-background">
      {/* SportsEvent structured data (JSON-LD) — one per match.
          Uses the static MATCHES mock so the markup is present in the
          server-rendered HTML even before client-side SWR hydration. */}
      {MATCHES.map((match) => (
        <script
          key={`ld-${match.id}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(buildSportsEventJsonLd(match)),
          }}
        />
      ))}

      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white">
              <Trophy className="h-4 w-4" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-bold tracking-tight">{t("appName")}</span>
              <span className="hidden text-xs text-muted-foreground sm:inline">
                {t("tabName")}
              </span>
            </div>
            {(data?.source === "odds-api" || data?.source === "bsd") && (
              <Badge variant="outline" className="ml-1 gap-1 border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {data?.source === "bsd" ? "BSD Live" : t("liveBadge")}
              </Badge>
            )}
            {data?.source === "mock" && (
              <Badge variant="outline" className="ml-1 gap-1 border-amber-500/40 text-amber-600 dark:text-amber-400">
                {t("demoBadge")}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            <ConnectionStatusIndicator
              status={connectionStatus}
              latency={latency}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isValidating}
              className="hidden sm:flex"
            >
              <RefreshCw className={cn("mr-2 h-3.5 w-3.5", isValidating && "animate-spin")} />
              {t("refresh")}
            </Button>
            <Button variant="ghost" size="sm" className="hidden md:flex">
              <SlidersHorizontal className="mr-2 h-3.5 w-3.5" />
              {t("filters")}
            </Button>
            <LanguageToggle />
            <PushToggle />
            <EmailToggle />
            <TerminalToggle />
            <ValueBetScannerIndicator />
            <Button
              variant="ghost"
              size="sm"
              onClick={openBankrollDialog}
              className="gap-1.5 text-xs"
            >
              <Wallet className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{tBankroll("trigger")}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={openPaperTradingDialog}
              className="gap-1.5 text-xs text-purple-600 hover:text-purple-700 dark:text-purple-400"
              title={tPaper("subtitle")}
            >
              <FlaskConical className="h-3.5 w-3.5" />
              <span className="hidden md:inline">{tPaper("trigger")}</span>
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Hero / page title */}
      <section className="border-b border-border/60 bg-gradient-to-b from-muted/40 to-background">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="gap-1">
                  <TrendingUp className="h-3 w-3" />
                  {t("liveModel")}
                </Badge>
                {terminalMode && (
                  <Badge
                    variant="outline"
                    className="gap-1 border-emerald-500/50 bg-emerald-500/10 font-mono text-emerald-700 dark:text-emerald-300"
                    title={tTerminal("tooltip")}
                  >
                    <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                    {tTerminal("indicator")}
                  </Badge>
                )}
                <button
                  type="button"
                  onClick={openAboutDialog}
                  title={tAbout("trigger")}
                  className="inline-flex items-center gap-1 rounded text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                  {tAbout("trigger")}
                </button>
                <button
                  type="button"
                  onClick={openBookmakerComparatorDialog}
                  title={tComparator("subtitle")}
                  className="inline-flex items-center gap-1 rounded text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Scale className="h-3.5 w-3.5" />
                  {tComparator("trigger")}
                </button>
              </div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                {t("heroTitle")}
              </h1>
              <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
                {t("heroDesc")}
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5" />
              <span>{t("today", { n: matches.length })}</span>
            </div>
          </div>

          {/* Filtres */}
          <div className="mt-6 flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => handleFilter(f.key)}
                title={f.hint}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  filter === f.key
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-background hover:bg-muted"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Match list */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-lg border border-rose-500/40 bg-rose-500/5 p-4 text-sm text-rose-700 dark:text-rose-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">{t("errorTitle")}</p>
              <p className="mt-0.5 text-xs">
                {t("errorBody")}{" "}
                <button
                  onClick={() => mutate()}
                  className="underline underline-offset-2 font-semibold"
                >
                  {t("retry")}
                </button>
              </p>
            </div>
          </div>
        )}

        {isLoading ? (
          <div
            className={cn(
              "grid grid-cols-1 gap-5",
              terminalMode ? "lg:grid-cols-3" : "lg:grid-cols-2"
            )}
          >
            {[0, 1, 2, 3].map((i) => (
              <MatchCardSkeleton key={i} />
            ))}
          </div>
        ) : (
          <>
          {/* P3: Value bets banner */}
          {valueBetCount > 0 && (
            <button
              onClick={() => track("value_bet_banner_click", { count: valueBetCount })}
              className="mb-4 flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-500/20 dark:text-emerald-300"
            >
              <span className="animate-pulse">💎</span>
              {valueBetCount} value bet{valueBetCount > 1 ? "s" : ""} détecté{valueBetCount > 1 ? "s" : ""} — trié{valueBetCount > 1 ? "s" : ""} par edge décroissant
            </button>
          )}
          <div
            className={cn(
              "grid grid-cols-1 gap-5",
              terminalMode ? "lg:grid-cols-3" : "lg:grid-cols-2"
            )}
          >
            {filtered.map((match, idx) => (
              <MatchCard
                key={match.id}
                match={match}
                chipsCollapsedByDefault={variant === "chips_collapsed"}
                liveState={liveStates[match.id]}
                disconnected={connectionStatus === "disconnected"}
                onOpenDetail={() => openDetail(match)}
                onBetClick={() => openBet(match)}
                priority={idx < 2}
              />
            ))}
          </div>
          </>
        )}

        {!isLoading && filtered.length === 0 && !error && (
          <div className="mt-16 flex flex-col items-center justify-center gap-3 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Trophy className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">{t("noMatchTitle")}</p>
            <p className="text-xs text-muted-foreground">
              {t("noMatchHint")}
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-border/60 bg-muted/20">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
          <div className="flex flex-col items-start justify-between gap-3 text-xs text-muted-foreground sm:flex-row sm:items-center">
            <p>
              <span className="font-semibold text-foreground">{t("appName")}</span> ·
              {t("footerCopyright")} · © 2026
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={openPrivacyDialog}
                className="font-medium text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground"
              >
                {tPrivacy("footer.manageCookies")}
              </button>
              <span className="text-border">·</span>
              <button
                type="button"
                onClick={openAboutDialog}
                className="inline-flex items-center gap-1 font-medium text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground"
              >
                <HelpCircle className="h-3 w-3" />
                {tAbout("trigger")}
              </button>
              <span className="text-border">·</span>
              <button
                type="button"
                onClick={openApiDocsDialog}
                className="inline-flex items-center gap-1 font-medium text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground"
              >
                <Code className="h-3 w-3" />
                {tApiDocs("trigger")}
              </button>
              <span className="text-border">·</span>
              <p className="flex items-center gap-1.5">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {data
                  ? `${t("footerSource")} : ${data.source} · ${t("footerUpdated")} ${formatRelativeShort(data.updatedAt, tTime)}`
                  : t("loadingShort")}
              </p>
            </div>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground/80">
            {t("footerWarning")}
          </p>
        </div>
      </footer>

      {/* Match detail dialog (lazy-loaded — Recharts is heavy) */}
      <Suspense fallback={null}>
        <MatchDetailDialog
          match={detailMatch}
          open={detailOpen}
          onOpenChange={setDetailOpen}
        />
      </Suspense>

      {/* Bet dialog (bankroll management) */}
      <BetDialog
        match={betMatch ? { ...betMatch, surface: betMatch.stats.surface } : null}
        open={betOpen}
        onOpenChange={setBetOpen}
      />
    </div>
    </PageErrorBoundary>
  );
}

function formatRelativeShort(
  iso: string,
  t: (key: string, params?: Record<string, unknown>) => string,
): string {
  const d = new Date(iso);
  const diff = Math.round((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return t("justNow");
  if (diff < 3600) return t("minutesAgo", { n: Math.floor(diff / 60) });
  return t("hoursAgo", { n: Math.floor(diff / 3600) });
}

// Global WebSocket connection indicator shown in the page header.
// Green = connected, amber = connecting, red = disconnected.
function ConnectionStatusIndicator({
  status,
  latency,
}: {
  status: "connecting" | "connected" | "disconnected";
  latency: number;
}) {
  const t = useTranslations("common");

  const config = {
    connected: {
      dotClass: "bg-emerald-500",
      textClass: "text-emerald-600 dark:text-emerald-400",
      ringClass: "bg-emerald-500/10",
      label: t("liveShort"),
      title:
        latency > 0
          ? t("connectedLatency", { n: latency })
          : t("connected"),
    },
    connecting: {
      dotClass: "bg-amber-500 animate-pulse",
      textClass: "text-amber-600 dark:text-amber-400",
      ringClass: "bg-amber-500/10",
      label: t("connectingShort"),
      title: t("connecting"),
    },
    disconnected: {
      dotClass: "bg-rose-500",
      textClass: "text-rose-600 dark:text-rose-400",
      ringClass: "bg-rose-500/10",
      label: t("disconnectedShort"),
      title: t("disconnected"),
    },
  }[status];

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
        config.ringClass,
        config.textClass,
      )}
      role="status"
      aria-live="polite"
      title={config.title}
    >
      <span className="relative flex h-1.5 w-1.5">
        {status === "connected" && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
        )}
        <span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", config.dotClass)} />
      </span>
      <span className="hidden sm:inline">{config.label}</span>
      {status === "connected" && latency > 0 && (
        <span className="hidden font-mono text-[10px] opacity-70 md:inline">
          {latency}ms
        </span>
      )}
    </div>
  );
}

function MatchCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-6">
      <div className="flex items-center justify-between border-b border-border/60 pb-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-16" />
      </div>
      <div className="grid grid-cols-3 items-center gap-2 py-8">
        <div className="flex flex-col items-center gap-2">
          <Skeleton className="h-[72px] w-[72px] rounded-full" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-[92px] w-[92px] rounded-full" />
        </div>
        <div className="flex justify-center">
          <Skeleton className="h-11 w-11 rounded-full" />
        </div>
        <div className="flex flex-col items-center gap-2">
          <Skeleton className="h-[72px] w-[72px] rounded-full" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-[92px] w-[92px] rounded-full" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 pt-4 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12" />
        ))}
      </div>
    </div>
  );
}
