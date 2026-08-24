"use client";

import { useState, useMemo, useCallback, memo, lazy, Suspense, Component, type ReactNode } from "react";
import Link from "next/link";
import { Trophy, TrendingUp, Info, RefreshCw, AlertCircle, HelpCircle, Wallet, FlaskConical, Scale, SlidersHorizontal, ArrowUpDown, PictureInPicture2, BarChart3 } from "lucide-react";
import { useTranslations } from "next-intl";
import { openAboutDialog } from "@/components/about-dialog";
import { openBookmakerComparatorDialog } from "@/components/bookmaker-comparator-dialog";
import { MatchCard } from "@/components/tennis/match-card";
import { MatchCardBroadcast } from "@/components/tennis/match-card-broadcast";
import { FeaturedMatchesMarquee } from "@/components/tennis/featured-matches-marquee";
import { TennisSubTabs, type TennisSubTab } from "@/components/tennis/tennis-sub-tabs";
import { TimeRangeFilter } from "@/components/shared/time-range-filter";
import {
  filterByStartWindow,
  filterByToday,
  filterBySelection,
  filterByTomorrow,
  filterLiveByWindow,
  parseTimeFilter,
} from "@/lib/match-view";
import { useSportsSidebarStore } from "@/stores/use-sports-sidebar-store";
import { TournamentsList } from "@/components/tennis/tournaments-list";
import { TennisSearchBar } from "@/components/tennis/tennis-search-bar";
import { TournamentHeaderCard } from "@/components/tennis/tournament-header-card";
const MatchDetailDialog = lazy(() =>
  import("@/components/tennis/match-detail-dialog").then((m) => ({ default: m.MatchDetailDialog }))
);
const PlayerProfileDialog = lazy(() =>
  import("@/components/tennis/player-profile-dialog").then((m) => ({ default: m.PlayerProfileDialog }))
);
import type { PlayerResult, TournamentResult } from "@/lib/tennis-search-types";
import { openBankrollDialog } from "@/components/bankroll-dialog";
import { openPaperTradingDialog } from "@/components/paper-trading-dialog";
import { ValueBetScannerIndicator } from "@/components/value-bet-scanner-indicator";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Badge } from "@/components/ui/badge";
import { usePrematchMatches } from "@/hooks/use-prematch-matches";
import { useLiveMatches } from "@/hooks/use-live-matches";
import { useOnexLiveOdds } from "@/hooks/use-onex-live-odds";
import { useFavorites } from "@/hooks/use-favorites";
import { useTerminalMode } from "@/hooks/use-terminal-mode";
import { useMatchFilter, type FilterKey, type SortKey } from "@/hooks/use-match-filter";
import { useMatchCuration } from "@/hooks/use-match-curation";
import { useAnalytics } from "@/components/analytics-provider";
import { useDocumentPip } from "@/hooks/use-document-pip";
import { useIsMobile } from "@/hooks/use-mobile";
import { MatchPipWidget } from "@/components/tennis/match-pip-widget";
import { MatchCardSkeleton } from "@/components/tennis/match-card-skeleton";
import { FlashscoreTennisList } from "@/components/tennis/flashscore-tennis-list";
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
import { BetDialog } from "@/components/bet-dialog";
import { resolvePlayerPhoto } from "@/lib/player-photos";
import { cn } from "@/lib/utils";

/** Simple deterministic color from a string. Used for synthetic live-match cards. */
function hashColor(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  const hue = Math.abs(h) % 360;
  return `hsl(${hue}, 60%, 40%)`;
}

class TennisErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: { componentStack?: string }) {
    console.error("[PariScore CRASH]", error.message, error.stack);
    if (typeof window !== "undefined") {
      (window as any).__SETPOINT_CRASH = {
        error: error.message,
        stack: error.stack,
        componentStack: info.componentStack,
        at: new Date().toISOString(),
      };
    }
  }
  render() {
    if (this.state.error) {
      // Fallback visible (au lieu de <div/> vide qui donnait l'impression
      // d'un "faux masque non fini"). Le user voit au moins qu'il y a eu
      // une erreur et peut nous donner le message pour debug.
      return (
        <div className="mx-auto max-w-2xl px-4 py-12 text-center">
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-6">
            <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">
              Erreur temporaire sur l&apos;onglet tennis
            </p>
            <p className="mt-2 font-mono text-xs text-muted-foreground">
              {this.state.error?.message ?? "Unknown error"}
            </p>
            <button
              type="button"
              onClick={() => {
                this.setState({ error: null });
                if (typeof window !== "undefined") window.location.reload();
              }}
              className="mt-4 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Recharger
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}


/** Wrapper to stabilize callbacks for MatchCardBroadcast — prevents new refs each render in .map(). */
function MatchCardBroadcastItem({
  match,
  chipsCollapsedByDefault,
  liveState,
  liveOdds,
  disconnected,
  onOpenDetail,
  onBetClick,
  priority,
}: {
  match: TennisMatch;
  chipsCollapsedByDefault: boolean;
  liveState?: import("@/hooks/use-live-matches").LiveMatchState;
  liveOdds?: import("@/hooks/use-onex-live-odds").LiveResolvedOdds | null;
  disconnected: boolean;
  onOpenDetail: (m: TennisMatch) => void;
  onBetClick: (m: TennisMatch) => void;
  priority: boolean;
}) {
  const handleOpen = useCallback(() => onOpenDetail(match), [onOpenDetail, match]);
  const handleBet = useCallback(() => onBetClick(match), [onBetClick, match]);
  return (
    <MatchCardBroadcast
      match={match}
      chipsCollapsedByDefault={chipsCollapsedByDefault}
      liveState={liveState}
      liveOdds={liveOdds}
      disconnected={disconnected}
      onOpenDetail={handleOpen}
      onBetClick={handleBet}
      priority={priority}
    />
  );
}

// R9 (latence live) : wrapper memo — avec `liveState` identity-stable (use-live-stream),
// les cartes inchangées ne se re-renderent plus à chaque push ~5s du broker.
const MemoMatchCardBroadcastItem = memo(MatchCardBroadcastItem);

export function TennisTabContent() {
  const t = useTranslations("common");
  const tFilters = useTranslations("filters");
  const tTime = useTranslations("time");
  const tAbout = useTranslations("about");
  const tBankroll = useTranslations("bankroll");
  const tPaper = useTranslations("paperTrading");
  const tComparator = useTranslations("comparator");
  const tTerminal = useTranslations("terminal");
  const tTennis = useTranslations("tennis");
  const tStatsLb = useTranslations("tennis.statsLeaderboard");

  const { data, error, isLoading, isValidating, mutate } = usePrematchMatches();
  // Mode dégradé : la route sert du mock local ou du cache périmé, ou la
  // route elle-même est injoignable → bandeau ambre non-bloquant au lieu de
  // l'erreur pleine page. Rose uniquement si AUCUNE donnée à afficher.
  const degraded =
    error != null ||
    data?.source === "mock" ||
    data?.source === "cache-stale";
  const { liveStates, liveMatchList, connectionStatus, latency } = useLiveMatches();
  const { favorites, count: favCount, toggle: toggleFavorite } = useFavorites();
  const { terminalMode } = useTerminalMode();
  const { track, getVariant, reloadFlags, setPersonProperties } = useAnalytics();
  // Widget Document PiP — fenêtre always-on-top pour suivre les favoris live
  // à côté du bookmaker (1xWin+). Connexion SSE indépendante dans le PiP.
  const pip = useDocumentPip();

  const [filter, setFilter] = useState<FilterKey>("all");
  const [sortKey, setSortKey] = useState<SortKey>("default");
  const [detailMatch, setDetailMatch] = useState<TennisMatch | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [betMatch, setBetMatch] = useState<TennisMatch | null>(null);
  const [betOpen, setBetOpen] = useState(false);
  const [variant, setVariant] = useState<AbTestVariant | null>(null);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const isMobile = useIsMobile();

  const FILTERS: { key: FilterKey; label: string; hint: string }[] = [
    { key: "all", label: tFilters("all"), hint: tFilters("allHint") },
    { key: "favorites", label: tFilters("favorites"), hint: tFilters("favoritesHint") },
    { key: "balanced", label: tFilters("balanced"), hint: tFilters("balancedHint") },
    { key: "starred", label: `${tFilters("starred")} (${favCount})`, hint: tFilters("starredHint") },
  ];

  const openDetail = useCallback((match: TennisMatch) => {
    setDetailMatch(match);
    setDetailOpen(true);
    track("detail_dialog_open", {
      match_id: match.id,
      player_a: match.playerA.name,
      player_b: match.playerB.name,
    });
  }, [track]);

  const openBet = useCallback((match: TennisMatch) => {
    setBetMatch(match);
    setBetOpen(true);
  }, []);

  const betMatchForDialog = useMemo(() =>
    betMatch ? { ...betMatch, surface: betMatch.stats.surface } : null,
    [betMatch],
  );

  useEffect(() => {
    let cancelled = false;
    const assign = async (source: "override" | "posthog" | "default") => {
      const override = getAbTestOverride();
      if (override) {
        if (cancelled) return;
        await Promise.resolve();
        if (cancelled) return;
        setVariant(override);
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
    const onOverrideChange = () => { assign("override"); };
    window.addEventListener(AB_TEST_OVERRIDE_EVENT, onOverrideChange);
    return () => {
      cancelled = true;
      window.removeEventListener(AB_TEST_OVERRIDE_EVENT, onOverrideChange);
    };
  }, [reloadFlags, getVariant, track, setPersonProperties]);

  useEffect(() => {
    track("page_view", { route: "/", tab: "tennis_prematch" });
  }, [track]);

  // R8 (2026-07-28) : auto-open du widget PiP si l'URL contient ?openWidget=1.
  // Permet au shortcut PWA "Widget live" du manifest d'ouvrir directement le
  // widget en 1 clic depuis l'écran d'accueil Win 11, sans avoir à chercher le
  // bouton dans la toolbar. On nettoie le query param après ouverture pour
  // éviter une ré-ouverture à chaque re-render.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!pip.supported) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("openWidget") !== "1") return;
    // Petit délai pour laisser les données live arriver (sinon widget vide).
    const timer = setTimeout(() => {
      pip.open(<MatchPipWidget />);
      // Nettoie l'URL sans recharger la page.
      params.delete("openWidget");
      const clean = params.toString();
      const newUrl = clean ? `${window.location.pathname}?${clean}` : window.location.pathname;
      window.history.replaceState({}, "", newUrl);
      track("pip_auto_open", { source: "pwa_shortcut" });
    }, 500);
    return () => clearTimeout(timer);
  }, [pip.supported]);

  // Merge live-only matches as synthetic cards: some live matches (e.g. ITF futures)
  // never appear in the prematch scheduled endpoint because BSD separates by status.
  // We build minimal TennisMatch objects so the MatchCard can render them with live overlays.
  // Defensive normalization — protects against API shape drift (bug A9).
  const rawMatches = data?.matches;
  const matches: TennisMatch[] = Array.isArray(rawMatches)
    ? rawMatches
    : Array.isArray((rawMatches as any)?.data)
      ? (rawMatches as any).data
      : [];

  const matchesWithLive: TennisMatch[] = useMemo(() => {
    if (!liveMatchList.length) return matches;

    const prematchIds = new Set(matches.map((m) => m.id));
    const synthetic: TennisMatch[] = [];

    for (const lm of liveMatchList) {
      if (!lm.isLive) continue;
      if (prematchIds.has(lm.id)) continue; // already in prematch list, liveState will overlay

      const nameA = lm.playerA?.name ?? "Joueur 1";
      const nameB = lm.playerB?.name ?? "Joueur 2";
      const shortA = nameA.split(" ").slice(-1)[0].toUpperCase();
      const shortB = nameB.split(" ").slice(-1)[0].toUpperCase();

      synthetic.push({
        id: lm.id,
        // R7.3 : vrai nom tournoi BSD (remplace le fallback "Live").
        // Fallback propre si BSD ne renvoie pas le champ (anciens mocks).
        tournament: lm.tournamentName || "Live",
        round: lm.roundName || "En direct",
        scheduledAt: new Date().toISOString(),
        playerA: {
          id: nameA.toLowerCase().replace(/\s+/g, "_"),
          name: nameA,
          shortName: shortA,
          rank: 0,
          elo: 1500,
          // R4 hotfix (2026-07-21) : résolution photo réelle via
          // resolvePlayerPhoto (6 stars OSS + ~90 joueurs Tennis Warehouse
          // + fallback DiceBear). Avant : "" → AvatarFallback initiales.
          photoUrl: resolvePlayerPhoto(nameA),
          color: hashColor(nameA),
          form: ["W", "L", "W", "L", "W", "L"],
        },
        playerB: {
          id: nameB.toLowerCase().replace(/\s+/g, "_"),
          name: nameB,
          shortName: shortB,
          rank: 0,
          elo: 1500,
          photoUrl: resolvePlayerPhoto(nameB),
          color: hashColor(nameB),
          form: ["L", "W", "L", "W", "L", "W"],
        },
        probA: 50,
        probB: 50,
        stats: {
          form: "LIVE",
          eloGap: 0,
          surface: "Dur",
          h2h: "—",
          ic: [0, 100],
          confidence: 0,
        },
        model: "Live",
        modelUpdatedAt: new Date().toISOString(),
        synthetic: true,
      });
    }

return [...matches, ...synthetic];
  }, [matches, liveMatchList]);

  // --- Recherche (P8) : joueur sélectionné → profil in-page ; tournoi
  // sélectionné → filtre de la liste des matchs + carte d'en-tête. ---
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerResult | null>(null);
  const [selectedTournament, setSelectedTournament] = useState<TournamentResult | null>(null);

  const onSelectPlayer = useCallback((player: PlayerResult) => {
    setSelectedPlayer(player);
  }, []);

  const onSelectTournament = useCallback((tournament: TournamentResult) => {
    setSelectedTournament(tournament);
    // On bascule sur l'onglet "Aujourd'hui" pour que la carte + la grille
    // filtrée soient visibles immédiatement.
    setFilter("all");
  }, []);

  const clearTournament = useCallback(() => setSelectedTournament(null), []);

  // Filtre tournoi : appliqué en amont du filtrage/curation pour que la
  // grille et le carrousel reflètent le tournoi sélectionné. Sans sélection
  // → liste complète (pas de changement de comportement).
  const selectedMatchIds = useSportsSidebarStore((s) => s.selectedMatchIds);

  const matchesWithScoped = useMemo(() => {
    let list = matchesWithLive;
    if (selectedTournament) {
      const target = selectedTournament.name.toLowerCase().trim();
      list = list.filter(
        (m) =>
          m.tournament.toLowerCase().trim() === target ||
          m.tournament.toLowerCase().includes(target),
      );
    }
    // Sélection sidebar : ne montrer que les matchs choisis. Vide = pas de filtre.
    return filterBySelection(list, selectedMatchIds, (m) => m.id);
  }, [matchesWithLive, selectedTournament, selectedMatchIds]);

  const { filtered, valueBetCount } = useMatchFilter(matchesWithScoped, filter, favorites, sortKey);

  // R8 curation : sépare les matchs phares de la semaine (featured) du reste.
  // La section "À la une" s'affiche en haut d'affiche, la grille principale
  // ne contient plus que le reste pour éviter le doublon.
  const curation = useMatchCuration(filtered);

  // Phase 7 — sous-onglets Live / Aujourd'hui / Tournois
  const [subTab, setSubTab] = useState<TennisSubTab>("today");

  // Filtre par heure de début (fenêtre glissante 1h → 24h / jour calendaire) —
  // partagé avec la sidebar (store unique, modèle 1xBet). S'applique aux vues
  // pre-match ("today" / "list") : exclut les matchs déjà en live et ceux dont
  // le coup d'envoi sort de la fenêtre.
  const timeKey = useSportsSidebarStore((s) => s.selectedTimeFilter);
  const setTimeKey = useSportsSidebarStore((s) => s.setTimeFilter);
  const { hours: timeRange, today: timeToday, tomorrow: timeTomorrow } = parseTimeFilter(timeKey);
  /** Applique la fenêtre horaire (ou « aujourd'hui » / « demain ») en excluant le live. */
  const scopeByTime = useCallback(
    <T extends { id: string; scheduledAt: string }>(list: T[]): T[] => {
      if (timeRange === null && !timeToday && !timeTomorrow) return list;
      const prematchOnly = list.filter((m) => !liveStates[m.id]?.isLive);
      if (timeRange !== null) {
        return filterByStartWindow(prematchOnly, timeRange, (m) => m.scheduledAt);
      }
      if (timeTomorrow) {
        return filterByTomorrow(prematchOnly, (m) => m.scheduledAt);
      }
      return filterByToday(prematchOnly, (m) => m.scheduledAt);
    },
    [liveStates, timeRange, timeToday, timeTomorrow],
  );

  // Nombre de matchs pour la carte tournoi (sur la liste scoped).
  const tournamentMatchCount = matchesWithScoped.length;

  // Compteurs dynamiques pour les badges des SubTabs
  const liveCount = useMemo(
    () => liveMatchList.filter((m) => m.isLive).length,
    [liveMatchList],
  );
  const todayCount = matchesWithLive.length;

  // Filtrage par sous-onglet — appliqué sur `filtered` (avec featured inclus
  // pour les compteurs), mais la grille principale n'affiche que `rest`.
  const subFiltered = useMemo(() => {
    if (subTab === "live") {
      const liveOnly = filtered.filter((m) => liveStates[m.id]?.isLive);
      if (timeRange !== null) return filterLiveByWindow(liveOnly, timeRange, (m) => m.scheduledAt);
      if (timeToday) return filterByToday(liveOnly, (m) => m.scheduledAt);
      return liveOnly;
    }
    return scopeByTime(filtered); // "today" = tout (hors filtre horaire)
  }, [subTab, filtered, liveStates, scopeByTime, timeRange, timeToday]);

  // Version "rest" filtrée par sous-onglet (pour la grille principale).
  // En live, on garde featured + rest (sinon les matchs phares live
  // disparaîtraient du sous-onglet live). En "today", la grille n'affiche
  // que `rest` car featured est déjà dans le carrousel.
  const restForGrid = useMemo(() => {
    if (subTab === "live") {
      const liveOnly = curation.rest.filter((m) => liveStates[m.id]?.isLive);
      if (timeRange !== null) return filterLiveByWindow(liveOnly, timeRange, (m) => m.scheduledAt);
      if (timeToday) return filterByToday(liveOnly, (m) => m.scheduledAt);
      return liveOnly;
    }
    return scopeByTime(curation.rest);
  }, [subTab, curation.rest, liveStates, scopeByTime, timeRange, timeToday]);

  // Cotes live P1/P2 — 1xBet avec repli BSD. Un seul POST batch
  // /api/v1/odds/live toutes les 15s sur la grille live ; chaque slot est
  // identité-stable → seules les cartes dont la cote a bougé se re-renderent
  // (la carte memo ne voit jamais un objet neuf si rien n'a changé).
  const onexRequest = useMemo(
    () =>
      restForGrid.map((m) => ({
        matchId: m.id,
        nameA: m.playerA.name,
        nameB: m.playerB.name,
      })),
    [restForGrid],
  );
  const onexLive = useOnexLiveOdds(onexRequest, liveStates);

  // Featured filtré par sous-onglet (en live, on ne montre en carrousel que
  // les featured live ; en "today", tous les featured).
  const featuredForMarquee = useMemo(() => {
    if (subTab === "live") {
      const liveOnly = curation.featured.filter((m) => liveStates[m.id]?.isLive);
      if (timeRange !== null) return filterLiveByWindow(liveOnly, timeRange, (m) => m.scheduledAt);
      if (timeToday) return filterByToday(liveOnly, (m) => m.scheduledAt);
      return liveOnly;
    }
    return scopeByTime(curation.featured);
  }, [subTab, curation.featured, liveStates, scopeByTime, timeRange, timeToday]);

  const handleSubTabChange = (tab: TennisSubTab) => {
    setSubTab(tab);
    track("sub_tab_click", { tab });
  };

  const handleFilter = (key: FilterKey) => {
    setFilter(key);
    track("filter_click", { filter: key });
  };

  const handleRefresh = () => {
    mutate();
    track("manual_refresh");
  };

  return (
    <TennisErrorBoundary>
      {/* SportsEvent JSON-LD */}
      {MATCHES.map((match) => (
        <script
          key={`ld-${match.id}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SportsEvent",
              name: `${match.playerA.name} vs ${match.playerB.name} — ${match.tournament} ${match.round}`,
              sport: "Tennis",
              startDate: match.scheduledAt,
              eventStatus: "https://schema.org/EventScheduled",
              location: { "@type": "Place", name: match.tournament },
              homeTeam: { "@type": "SportsTeam", name: match.playerA.name, athlete: { "@type": "Person", name: match.playerA.name } },
              awayTeam: { "@type": "SportsTeam", name: match.playerB.name, athlete: { "@type": "Person", name: match.playerB.name } },
              url: `${process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://pariscore.fr"}/`,
            }),
          }}
        />
      ))}

      {/* Hero */}
      <section className="border-b border-border/60 bg-gradient-to-b from-muted/40 to-background">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="gap-1">
                  <TrendingUp className="h-3 w-3" />
                  {t("liveModel")}
                </Badge>
                {terminalMode && (
                  <Badge variant="outline" className="gap-1 border-emerald-500/50 bg-emerald-500/10 font-mono text-emerald-700 dark:text-emerald-300" title={tTerminal("tooltip")}>
                    <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                    {tTerminal("indicator")}
                  </Badge>
                )}
                <button type="button" onClick={openAboutDialog} title={tAbout("trigger")} className="inline-flex items-center gap-1 rounded text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <HelpCircle className="h-3.5 w-3.5" />
                  {tAbout("trigger")}
                </button>
                <button type="button" onClick={openBookmakerComparatorDialog} title={tComparator("subtitle")} className="inline-flex items-center gap-1 rounded text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Scale className="h-3.5 w-3.5" />
                  {tComparator("trigger")}
                </button>
                <Link href="/tennis/stats" title={tStatsLb("title")} className="inline-flex items-center gap-1 rounded text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <BarChart3 className="h-3.5 w-3.5" />
                  {tStatsLb("title")}
                </Link>
                {pip.supported && (
                  <button
                    type="button"
                    onClick={() => pip.open(<MatchPipWidget />)}
                    title={
                      pip.mode === "pip"
                        ? "Ouvrir le widget live en fenêtre always-on-top (reste au-dessus du bookmaker)"
                        : "Ouvrir le widget live en fenêtre popup (votre navigateur ne supporte pas l'always-on-top natif — Chrome/Edge 116+ requis pour cette fonction)"
                    }
                    className="inline-flex items-center gap-1 rounded text-xs font-medium text-emerald-600 transition-colors hover:bg-emerald-500/10 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <PictureInPicture2 className="h-3.5 w-3.5" />
                    Widget live
                    {pip.mode === "popup" && (
                      <span className="text-[11px] text-muted-foreground/60 ml-0.5">(popup)</span>
                    )}
                  </button>
                )}
              </div>
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
                {t("heroTitle")}
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                {t("heroDesc")}
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5" />
              <span>{t("today", { n: matchesWithLive.length })}</span>
              {data && (
                <span
                  title={t("sourceTitle", {
                    source: data.source,
                    updatedAt: new Date(data.updatedAt).toLocaleTimeString(),
                  })}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
                    data.source === "bsd" || data.source === "odds-api"
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : data.source === "cache-stale"
                        ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                        : "border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-400",
                  )}
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      data.source === "bsd" || data.source === "odds-api"
                        ? "bg-emerald-500"
                        : data.source === "cache-stale"
                          ? "bg-amber-500"
                          : "bg-orange-500",
                    )}
                  />
                  {data.source === "bsd" || data.source === "odds-api"
                    ? t("sourceLive")
                    : data.source === "cache-stale"
                      ? t("sourceCache")
                      : t("sourceDemo")}
                </span>
              )}
            </div>
          </div>

          {/* Module de recherche joueurs + tournois — visible quel que soit le sous-onglet tennis */}
          <div className="mt-4">
            <TennisSearchBar
              onSelectPlayer={onSelectPlayer}
              onSelectTournament={onSelectTournament}
            />
          </div>

          {/* Carte tournoi sélectionné — filtre actif sur la grille */}
          {selectedTournament && (
            <div className="mt-4">
              <TournamentHeaderCard
                tournament={selectedTournament}
                matchCount={tournamentMatchCount}
                onClear={clearTournament}
              />
            </div>
          )}

          {isMobile ? (
            <>
              <Button variant="outline" size="sm" onClick={() => setFilterSheetOpen(true)} className="mt-4">
                <SlidersHorizontal className="h-4 w-4 mr-2" />
                Filtres
              </Button>
              <BottomSheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen} title="Filtres">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-wrap gap-2">
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

                  {/* Sort controls */}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <ArrowUpDown className="h-3.5 w-3.5" />
                    <span className="font-medium">{tFilters("sortBy")}:</span>
                    {([
                      { key: "default" as SortKey, label: tFilters("sortDefault") },
                      { key: "rank_asc" as SortKey, label: tFilters("sortRankAsc") },
                      { key: "rank_desc" as SortKey, label: tFilters("sortRankDesc") },
                      { key: "elo_asc" as SortKey, label: tFilters("sortEloAsc") },
                      { key: "elo_desc" as SortKey, label: tFilters("sortEloDesc") },
                    ] as const).map((opt) => (
                      <button
                        key={opt.key}
                        onClick={() => {
                          setSortKey(opt.key);
                          track("sort_click", { sort: opt.key });
                        }}
                        className={cn(
                          "rounded px-2 py-1 transition-colors",
                          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          sortKey === opt.key
                            ? "bg-foreground/10 font-semibold text-foreground"
                            : "hover:text-foreground"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </BottomSheet>
            </>
          ) : (
            <>
              <div className="mt-4 flex flex-wrap gap-2">
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
                        : "border-border bg-background text-[#C0C0C0] hover:bg-muted hover:text-white"
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Sort controls */}
              <div className="mt-3 flex items-center gap-2 text-xs text-[#C0C0C0]">
                <ArrowUpDown className="h-3.5 w-3.5" />
                <span className="font-medium">{tFilters("sortBy")}:</span>
                {([
                  { key: "default" as SortKey, label: tFilters("sortDefault") },
                  { key: "rank_asc" as SortKey, label: tFilters("sortRankAsc") },
                  { key: "rank_desc" as SortKey, label: tFilters("sortRankDesc") },
                  { key: "elo_asc" as SortKey, label: tFilters("sortEloAsc") },
                  { key: "elo_desc" as SortKey, label: tFilters("sortEloDesc") },
                ] as const).map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => {
                      setSortKey(opt.key);
                      track("sort_click", { sort: opt.key });
                    }}
                    className={cn(
                      "rounded px-2 py-1 transition-colors",
                      "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      sortKey === opt.key
                        ? "bg-foreground/10 font-semibold text-foreground"
                        : "hover:text-foreground"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {/* R8 — Section "À la une" : carrousel horizontal des tournois phares
          de la semaine (ex S29 : Kitzbühel, Estoril, Hambourg). Disparaît
          automatiquement si la semaine n'a pas de marquee configuré. */}
      <FeaturedMatchesMarquee
        featured={featuredForMarquee}
        marquee={curation.marquee}
        liveStates={liveStates}
        hasFeatured={curation.hasFeatured && featuredForMarquee.length > 0}
        onOpenDetail={openDetail}
        onBetClick={openBet}
      />

      {/* Phase 7 — Sous-onglets Live / Aujourd'hui / Tournois */}
      <div className="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6">
        <TennisSubTabs
          activeSubTab={subTab}
          onSubTabChange={handleSubTabChange}
          liveCount={liveCount}
          todayCount={todayCount}
        />

        {/* Filtre par heure de début — vues pre-match uniquement */}
        {subTab !== "live" && subTab !== "tournaments" && (
          <div className="mt-3">
            <TimeRangeFilter value={timeKey} onChange={setTimeKey} />
          </div>
        )}
      </div>

      {/* Match list / Tournaments list / Flashscore list */}
      <main className="w-full flex-1 px-4 py-6 sm:px-6">
      {subTab === "tournaments" ? (
        <TournamentsList />
      ) : subTab === "list" ? (
        <FlashscoreTennisList
          matches={subFiltered}
          liveStates={liveStates}
          favoriteIds={favorites}
          onToggleFavorite={toggleFavorite}
          onOpenDetail={openDetail}
          isLoading={isLoading}
          error={error?.message ?? null}
          onRetry={() => mutate()}
        />
      ) : (
        <>
        {degraded && (
          <div
            className={cn(
              "mb-6 flex items-start gap-3 rounded-lg border p-4 text-sm",
              !data
                ? "border-rose-500/40 bg-rose-500/5 text-rose-700 dark:text-rose-300"
                : "border-amber-500/40 bg-amber-500/5 text-amber-800 dark:text-amber-300",
            )}
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">
                {data ? t("degradedTitle") : t("errorTitle")}
              </p>
              <p className="mt-0.5 text-xs">
                {data ? t("degradedBody") : t("errorBody")}{" "}
                <button onClick={() => mutate()} className="underline underline-offset-2 font-semibold">
                  {t("retry")}
                </button>
              </p>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className={cn("grid grid-cols-1 gap-5", terminalMode ? "lg:grid-cols-3" : "lg:grid-cols-2")}>
            {[0, 1, 2, 3].map((i) => <MatchCardSkeleton key={i} />)}
          </div>
        ) : (
          <>
            {valueBetCount > 0 && (
              <button
                onClick={() => track("value_bet_banner_click", { count: valueBetCount })}
                className="mb-4 flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-500/20 dark:text-emerald-300"
              >
                <span className="animate-pulse">💎</span>
                {valueBetCount} value bet{valueBetCount > 1 ? "s" : ""} détecté{valueBetCount > 1 ? "s" : ""} — trié{valueBetCount > 1 ? "s" : ""} par edge décroissant
              </button>
            )}
            <div className={cn("grid grid-cols-1 gap-5", terminalMode ? "lg:grid-cols-3" : "lg:grid-cols-2")}>
              {restForGrid.map((match, idx) => (
                <MemoMatchCardBroadcastItem
                  key={match.id}
                  match={match}
                  chipsCollapsedByDefault={variant === "chips_collapsed"}
                  liveState={liveStates[match.id]}
                  liveOdds={onexLive.odds[match.id] ?? null}
                  disconnected={connectionStatus === "disconnected"}
                  onOpenDetail={openDetail}
                  onBetClick={openBet}
                  priority={idx < 2}
                />
              ))}
            </div>
          </>
        )}

        {!isLoading && subFiltered.length === 0 && !error && (
          <div className="mt-16 flex flex-col items-center justify-center gap-3 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Trophy className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">
              {subTab === "live" ? tTennis("noLiveMatches") : t("noMatchTitle")}
            </p>
            <p className="text-xs text-muted-foreground">{t("noMatchHint")}</p>
          </div>
        )}
        </>
      )}
      </main>

      <Suspense fallback={null}>
        <MatchDetailDialog match={detailMatch} open={detailOpen} onOpenChange={setDetailOpen} />
      </Suspense>
      <Suspense fallback={null}>
        <PlayerProfileDialog
          player={selectedPlayer}
          matches={matchesWithLive}
          open={selectedPlayer !== null}
          onOpenChange={(open) => { if (!open) setSelectedPlayer(null); }}
        />
      </Suspense>
      <BetDialog match={betMatchForDialog} open={betOpen} onOpenChange={setBetOpen} />
    </TennisErrorBoundary>
  );
}
