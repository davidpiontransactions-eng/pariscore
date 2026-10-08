"use client";

import { useState, useMemo, useCallback, memo, lazy, Suspense, Component, useRef, type ReactNode } from "react";
import Link from "next/link";
import { Trophy, TrendingUp, Info, RefreshCw, AlertCircle, HelpCircle, Wallet, FlaskConical, Scale, SlidersHorizontal, ArrowUpDown, PictureInPicture2, BarChart3, X, ChevronRight, Target } from "lucide-react";
import { useTranslations } from "next-intl";
import { openAboutDialog } from "@/components/about-dialog";
import { openBookmakerComparatorDialog } from "@/components/bookmaker-comparator-dialog";
import { MatchCardBroadcast } from "@/components/tennis/match-card-broadcast";
import { FeaturedMatchesMarquee } from "@/components/tennis/featured-matches-marquee";
import {
  TennisSubTabs,
  TennisSubTabPanel,
  parseTennisSubTab,
  type TennisSubTab,
} from "@/components/tennis/tennis-sub-tabs";
import { TennisCalendarPanel } from "@/components/tennis/panels/tennis-calendar-panel";
import { TennisLivePanel } from "@/components/tennis/panels/tennis-live-panel";
import { TennisTop10Panel } from "@/components/tennis/panels/tennis-top10-panel";
import type { TopFocus } from "@/components/tennis/tennis-top10-matches-widget";
import { TimeRangeFilter } from "@/components/shared/time-range-filter";
import { StrategyFilterDropdown } from "@/components/shared/strategy-filter-dropdown";
import {
  filterByStartWindow,
  filterByToday,
  filterBySelection,
  filterByTomorrow,
  filterLiveByWindow,
  parseTimeFilter,
  type StrategyFilter,
} from "@/lib/match-view";
import { useSportsSidebarStore } from "@/stores/use-sports-sidebar-store";
import { useSportsTree } from "@/hooks/use-sports-tree";
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
import { useFavorites } from "@/hooks/use-favorites-adapter";
import { useTerminalMode } from "@/hooks/use-terminal-mode";
import { useMatchFilter, type FilterKey, type SortKey } from "@/hooks/use-match-filter";
import { useMatchCuration } from "@/hooks/use-match-curation";
import { useAnalytics } from "@/components/analytics-provider";
import { useDocumentPip } from "@/hooks/use-document-pip";
import { useIsMobile } from "@/hooks/use-mobile";
import { MatchPipWidget } from "@/components/tennis/match-pip-widget";
import { MatchCardSkeleton } from "@/components/mobile/match-card-skeleton";
import { FlashscoreTennisList } from "@/components/tennis/flashscore-tennis-list";
import { TennisCalendarStrategyView } from "@/components/tennis/tennis-calendar-strategy-view";
import { useEffect } from "react";
import type { TennisMatch } from "@/lib/tennis-data";
import { sameBsdMatch } from "@/lib/bsd-id";
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
import { BentoGrid, BentoTile } from "@/components/ui/bento-grid";

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

  const { data, error, isLoading, mutate } = usePrematchMatches();
  // Mode dégradé : la route sert du mock local ou du cache périmé, ou la
  // route elle-même est injoignable → bandeau ambre non-bloquant au lieu de
  // l'erreur pleine page. Rose uniquement si AUCUNE donnée à afficher.
  const degraded =
    error != null ||
    data?.source === "mock" ||
    data?.source === "cache-stale" ||
    data?.source === "error";
  const { liveStates, liveMatchList, connectionStatus, latency } = useLiveMatches();
  const { favorites, count: favCount, toggle: toggleFavorite } = useFavorites();
  const { terminalMode } = useTerminalMode();
  const { track, getVariant, reloadFlags, setPersonProperties } = useAnalytics();
  // Widget Document PiP — fenêtre always-on-top pour suivre les favoris live
  // à côté du bookmaker (1xWin+). Connexion SSE indépendante dans le PiP.
  const pip = useDocumentPip();

  const [filter, setFilter] = useState<StrategyFilter>("all");
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
      // R7.9 : Elo / rang / forme viennent du flux live enrichi (serveur).
      // `eloKnown: false` → on ne FABRIQUE plus de 1500 : l'UI affiche `—`
      // plutôt qu'un faux Elo qui masquait l'absence de donnée.
      const briefA = lm.playerA;
      const briefB = lm.playerB;
      const mkPlayer = (
        brief: typeof briefA,
        name: string,
        short: string,
      ): TennisMatch["playerA"] => ({
        id: name.toLowerCase().replace(/\s+/g, "_"),
        name,
        shortName: short,
        rank: brief?.rank ?? 0,
        elo: brief?.eloKnown ? brief.elo : 0,
        eloKnown: brief?.eloKnown ?? false,
        surfaceElo: brief?.eloKnown ? brief.surfaceElo : 0,
        sps: brief?.sps ?? undefined,
        spsRank: brief?.spsRank ?? undefined,
        // R4 hotfix (2026-07-21) : résolution photo réelle via
        // resolvePlayerPhoto (6 stars OSS + ~90 joueurs Tennis Warehouse
        // + fallback DiceBear). Avant : "" → AvatarFallback initiales.
        photoUrl: brief?.photoUrl || resolvePlayerPhoto(name),
        color: hashColor(name),
        form: brief?.form?.length ? brief.form : [],
      });

      synthetic.push({
        id: lm.id,
        // R7.3 : vrai nom tournoi BSD (remplace le fallback "Live").
        // Fallback propre si BSD ne renvoie pas le champ (anciens mocks).
        tournament: lm.tournamentName || "Live",
        round: lm.roundName || "En direct",
        scheduledAt: new Date().toISOString(),
        playerA: mkPlayer(briefA, nameA, shortA),
        playerB: mkPlayer(briefB, nameB, shortB),
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

  // Sélection sidebar : Set pour lookup O(1) + auto-scroll vers la première
  // carte sélectionnée (sinon elle tombe sous le fold et semble « absente »).
  const selectedIdSet = useMemo(
    () => new Set(selectedMatchIds),
    [selectedMatchIds],
  );

  const selectedCountryId = useSportsSidebarStore((s) => s.selectedCountryId);

  // Vérifie si un match est marqué comme live dans le tree sidebar (SWR).
  // Utile quand liveStates n'est pas encore peuplé (SSE pas encore reçu).
  const { data: treeData } = useSportsTree();
  const isInTreeAsLive = useCallback(
    (matchId: string): boolean => {
      if (!treeData) return false;
      for (const sport of treeData) {
        for (const country of sport.countries) {
          for (const league of country.leagues) {
            if (league.matches?.some((m) => m.id === matchId && m.isLive)) {
              return true;
            }
          }
        }
      }
      return false;
    },
    [treeData],
  );

  const matchesWithScoped = useMemo(() => {
    let list = matchesWithLive;
    if (selectedTournament) {
      const target = selectedTournament.name.toLowerCase().trim();
      list = list.filter(
        (m) =>
          (m.tournament ?? "").toLowerCase().trim() === target ||
          (m.tournament ?? "").toLowerCase().includes(target),
      );
    }
    // Filtre par catégorie de tournoi sélectionnée dans la sidebar
    // (tennis tree groupe par tournamentCategory, pas par nationalité joueur).
    // Exception : si le match est explicitement sélectionné dans la sidebar,
    // on le garde même si le tournamentCategory ne matche pas (live match).
    if (selectedCountryId) {
      const target = selectedCountryId.toLowerCase();
      const selectedSet = new Set(selectedMatchIds);
      list = list.filter(
        (m) =>
          selectedSet.has(m.id) ||
          m.tournamentCategory?.toLowerCase().replace(/\s+/g, "-") === target ||
          (m.tournament ?? "").toLowerCase().replace(/\s+/g, "-") === target,
      );
    }
    // Sélection sidebar : ne montrer que les matchs choisis. Vide = pas de filtre.
    return filterBySelection(list, selectedMatchIds, (m) => m.id);
  }, [matchesWithLive, selectedTournament, selectedCountryId, selectedMatchIds]);

  // Match ciblé par le bouton « Widget live » : le match ouvert en détail, sinon
  // l'unique match sélectionné dans la sidebar. Sans ce focus le widget s'ouvrait
  // vide (il ne listait que les favoris en direct) alors que l'utilisateur venait
  // de choisir un match. `sameBsdMatch` car la sidebar et le flux live n'utilisent
  // pas le même préfixe d'id.
  const pipFocusMatch = useMemo(() => {
    if (detailMatch) return detailMatch;
    if (selectedMatchIds.length !== 1) return null;
    const selectedId = selectedMatchIds[0];
    return matchesWithLive.find((m) => sameBsdMatch(m.id, selectedId)) ?? null;
  }, [detailMatch, selectedMatchIds, matchesWithLive]);

  const { filtered, valueBetCount } = useMatchFilter(matchesWithScoped, filter, favorites, sortKey);

  // R8 curation : sépare les matchs phares de la semaine (featured) du reste.
  // La section "À la une" s'affiche en haut d'affiche, la grille principale
  // ne contient plus que le reste pour éviter le doublon.
  const curation = useMatchCuration(filtered);

  // ─── Sous-onglet actif ───
  // Source de vérité UNIQUE : `useSportsSidebarStore.sportSubTabs.tennis`.
  // La rangée du header (`SportSubTabs`) lit/écrit la MÊME clé → les deux
  // rangées sont alignées et `?sub=` se partage. Même contrat que football.
  //
  // Le sous-onglet « Live » est INDÉPENDANT du mode de la sidebar : cliquer
  // « Live » ici ne bascule pas `modes.tennis`. Décision utilisateur : le
  // tennis se comporte comme le football, où le sous-onglet et le mode sidebar
  // sont deux commandes séparées.
  const subTab = parseTennisSubTab(useSportsSidebarStore((s) => s.sportSubTabs.tennis));
  const setTennisSubTab = useSportsSidebarStore((s) => s.setSubTab);
  const handleSubTabChange = useCallback(
    (tab: TennisSubTab) => {
      setTennisSubTab("tennis", tab);
    },
    [setTennisSubTab],
  );

  // Focus « TOP 10 » demandé depuis une pastille du calendrier.
  const [topFocus, setTopFocus] = useState<TopFocus | null>(null);
  const focusTop10 = useCallback((focus: TopFocus) => {
    setTopFocus(focus);
    // Id canonique `strategies` (l'ancien `top10` est migré par
    // `parseTennisSubTab`, mais écrire un alias ici le ferait revenir au
    // même tour).
    setTennisSubTab("tennis", "strategies");
  }, [setTennisSubTab]);

  // Sélection sidebar : auto-scroll vers la carte sélectionnée (sinon elle
  // tombe sous le fold et semble « absente »). Poll résilient : la carte peut
  // n'être rendue qu'après le chargement des données / le switch de sous-onglet.
  useEffect(() => {
    if (selectedMatchIds.length === 0) return;
    let attempts = 0;
    const iv = setInterval(() => {
      attempts += 1;
      const el = document.querySelector('[data-selected-match="true"]');
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        clearInterval(iv);
      } else if (attempts >= 20) {
        clearInterval(iv);
      }
    }, 200);
    return () => clearInterval(iv);
  }, [selectedMatchIds, subTab]);

  // Filtre par heure de début (fenêtre glissante 1h → 24h / jour calendaire) —
  // partagé avec la sidebar (store unique, modèle 1xBet). S'applique aux vues
  // pre-match ("today" / "list") : exclut les matchs déjà en live et ceux dont
  // le coup d'envoi sort de la fenêtre.
  const timeKey = useSportsSidebarStore((s) => s.selectedTimeFilter);
  const setTimeKey = useSportsSidebarStore((s) => s.setTimeFilter);
  const { hours: timeRange, today: timeToday, tomorrow: timeTomorrow } = parseTimeFilter(timeKey);

  // Ensemble des IDs de matchs live (fallback quand liveStates pas encore peuplé
  // par le SSE — évite le filtre 0 cartes au chargement initial ~5s).
  const liveMatchIdSet = useMemo(
    () => new Set(liveMatchList.filter((m) => m.isLive).map((m) => m.id)),
    [liveMatchList],
  );

    // Pas d'auto-bascule vers « Live » quand la sidebar sélectionne un match live :
  // ce comportementalamoutait le sous-onglet par-dessus le choix de
  // l'utilisateur. Le sous-onglet ne bouge que sur action explicite.

  /** Applique la fenêtre horaire (ou « aujourd'hui » / « demain ») en gardant le live visible. */
  const scopeByTime = useCallback(
    <T extends { id: string; scheduledAt: string }>(list: T[]): T[] => {
      if (timeRange === null && !timeToday && !timeTomorrow) return list;
      // Séparer live et prematch : le live reste toujours visible
      const liveItems = list.filter((m) => liveStates[m.id]?.isLive || liveMatchIdSet.has(m.id));
      const prematchOnly = list.filter((m) => !liveStates[m.id]?.isLive && !liveMatchIdSet.has(m.id));
      let filteredPrematch: T[];
      if (timeRange !== null) {
        filteredPrematch = filterByStartWindow(prematchOnly, timeRange, (m) => m.scheduledAt);
      } else if (timeTomorrow) {
        filteredPrematch = filterByTomorrow(prematchOnly, (m) => m.scheduledAt);
      } else {
        filteredPrematch = filterByToday(prematchOnly, (m) => m.scheduledAt);
      }
      return [...liveItems, ...filteredPrematch];
    },
    [liveStates, liveMatchIdSet, timeRange, timeToday, timeTomorrow],
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
      const liveOnly = filtered.filter((m) => liveStates[m.id]?.isLive || liveMatchIdSet.has(m.id));
      // Les lives ne sont PAS filtrés par le filtre temporel (time=2h) :
      // un match commencé il y a 3h et toujours en cours doit rester visible.
      if (timeToday) return filterByToday(liveOnly, (m) => m.scheduledAt);
      return liveOnly;
    }
    return scopeByTime(filtered); // "today" = tout (hors filtre horaire)
  }, [subTab, filtered, liveStates, liveMatchIdSet, scopeByTime, timeRange, timeToday]);

  // Grille du sous-onglet « Live » : `curation.rest` filtré sur l'état live.
  // Le filtre temporel ne s'applique pas — un match commencé il y a 3h et
  // toujours en cours doit rester visible.
  const liveMatches = useMemo(() => {
    const liveOnly = curation.rest.filter(
      (m) => liveStates[m.id]?.isLive || liveMatchIdSet.has(m.id),
    );
    if (timeToday) return filterByToday(liveOnly, (m) => m.scheduledAt);
    return liveOnly;
  }, [curation.rest, liveStates, liveMatchIdSet, timeToday]);

  // Featured live du carrousel (indépendant de la grille).
  const liveFeatured = useMemo(() => {
    const liveOnly = curation.featured.filter(
      (m) => liveStates[m.id]?.isLive || liveMatchIdSet.has(m.id),
    );
    if (timeToday) return filterByToday(liveOnly, (m) => m.scheduledAt);
    return liveOnly;
  }, [curation.featured, liveStates, liveMatchIdSet, timeToday]);

  // Cotes live P1/P2 — 1xBet avec repli BSD. Un seul POST batch
  // /api/v1/odds/live toutes les 15s sur la grille live ; chaque slot est
  // identité-stable → seules les cartes dont la cote a bougé se re-renderent
  // (la carte memo ne voit jamais un objet neuf si rien n'a changé).
  const onexRequest = useMemo(
    () =>
      liveMatches.map((m) => ({
        matchId: m.id,
        nameA: m.playerA.name,
        nameB: m.playerB.name,
      })),
    [liveMatches],
  );
  const onexLive = useOnexLiveOdds(onexRequest, liveStates);

  const handleFilter = (key: StrategyFilter) => {
    setFilter(key);
    track("filter_click", { filter: key });
  };

  const handleRefresh = () => {
    mutate();
    track("manual_refresh");
  };

  return (
    <TennisErrorBoundary>
      {/* SportsEvent JSON-LD — données réelles (pas de mock) */}
      {matchesWithLive.slice(0, 50).map((match) => (
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

      {/* Breadcrumb contextuel — sport > pays */}
      {selectedCountryId && (
        <div className="mx-auto max-w-6xl px-4 pt-4">
          <div className="flex items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => useSportsSidebarStore.getState().selectCountry(null)}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-emerald-400 transition-colors hover:bg-emerald-500/10 hover:text-emerald-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
            >
              ← Retour
            </button>
            <ChevronRight className="h-3 w-3 text-slate-400" />
            <span className="font-medium text-slate-300">Tennis</span>
            <ChevronRight className="h-3 w-3 text-slate-400" />
            <span className="font-semibold text-emerald-400 capitalize">{selectedCountryId}</span>
          </div>
        </div>
      )}
      {/* Bento Grid — grille principale avec 4 colonnes responsive */}
      <BentoGrid cols={2} className="mx-auto w-full px-4 sm:px-6">
      {/* Hero — Bento Grid : tile hero (2×2) */}
      <BentoTile size="hero" variant="solid">
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
                <Link href="/tennis/markets" title="Marchés tennis" className="inline-flex items-center gap-1 rounded text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Target className="h-3.5 w-3.5" />
                  Marchés
                </Link>
                {pip.supported && (
                  <button
                    type="button"
                    onClick={() => pip.open(<MatchPipWidget focusMatch={pipFocusMatch} />)}
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
              <div className="mt-4">
                <StrategyFilterDropdown
                  sport="tennis"
                  value={filter}
                  onChange={setFilter}
                />
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
      </BentoTile>

      {/* R8 — Section "À la une" : carrousel horizontal des tournois phares
          de la semaine (ex S29 : Kitzbühel, Estoril, Hambourg). Disparaît
          automatiquement si la semaine n'a pas de marquee configuré. */}
      <BentoTile size="wide" variant="glass">
      <FeaturedMatchesMarquee
        featured={curation.featured}
        marquee={curation.marquee}
        liveStates={liveStates}
        hasFeatured={curation.hasFeatured}
        onOpenDetail={openDetail}
        onBetClick={openBet}
      />
      </BentoTile>

      {/* Phase 7 — Sous-onglets Live / Aujourd'hui / Tournois — Bento Grid : tile standard (1×1) */}
      {/* Rangée de sous-onglets — TILE WIDE. La rangée était en `size="standard"`
          (1×1) sur une BentoGrid à 2 colonnes : la moitié de la largeur, rangée
          contrainte à `overflow-x-auto`, 2 onglets sur 6 hors écran. Elle
          commande le contenu → elle doit occuper la largeur du contenu. */}
      <BentoTile size="wide" variant="glass">
      <div className="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6">
        <TennisSubTabs
          activeSubTab={subTab}
          onSubTabChange={handleSubTabChange}
        />
      </div>
      </BentoTile>

      {/* Panneau du sous-onglet actif — Bento Grid : tile wide (2×1) */}
      <BentoTile size="wide" variant="glass">
      <main className="w-full flex-1 px-4 py-6 sm:px-6">
      {subTab === "prematch" ? (
        <TennisCalendarPanel onFocusTop10={focusTop10} />
      ) : subTab === "live" ? (
        <TennisLivePanel
          matches={liveMatches}
          featured={liveFeatured}
          marquee={curation.marquee}
          liveStates={liveStates}
          liveOdds={onexLive.odds}
          disconnected={connectionStatus === "disconnected"}
          isLoading={isLoading}
          onOpenDetail={openDetail}
          onBetClick={openBet}
        />
      ) : subTab === "strategies" ? (
        <TennisTop10Panel focused={topFocus} />
      ) : (
        <TennisSubTabPanel sub={subTab} />
      )}
      </main>
      </BentoTile>
      </BentoGrid>

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
