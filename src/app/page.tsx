"use client";

import { useState, Component, type ReactNode, useCallback, useMemo, useEffect, lazy, Suspense } from "react";
import { cn } from "@/lib/utils";
import {
  Trophy,
  Code,
  HelpCircle,
  Star,
  Timer,
  Sparkles,
  BarChart3,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { openPrivacyDialog } from "@/components/privacy-dialog";
import { openAboutDialog } from "@/components/about-dialog";
import { openApiDocsDialog } from "@/components/api-docs-dialog";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";

import {
  SportsSidebar,
  SportsSidebarUrlSync,
} from "@/components/layout/sports-sidebar";
import { useSportsSidebarStore } from "@/stores/use-sports-sidebar-store";
import type { SportTabId } from "@/types/sports-sidebar";
import { TennisTabContent } from "@/components/football/tennis-tab-content";
import { motion, useReducedMotion } from "framer-motion";
import { FootballTabContent } from "@/components/football/football-tab-content";
import { Cs2TabContent } from "@/components/cs2/cs2-tab-content";
import { MmaTabContent } from "@/components/mma/mma-tab-content";
import { BasketballTabContent } from "@/components/basketball/basketball-tab-content";
import { CyclingTabContent } from "@/components/cycling/cycling-tab-content";
import { F1TabContent } from "@/components/f1/f1-tab-content";
import { BaseballTabContent } from "@/components/baseball/baseball-tab-content";
import { RugbyTabContent } from "@/components/rugby/rugby-tab-content";
import { BestMatchesTabs } from "@/components/dashboard/best-matches-tabs";
import { UpcomingTenMatchesTable } from "@/components/dashboard/upcoming-ten-matches-table";
import { HeroSection } from "@/components/dashboard/hero-stats";
import { AIInsightCard } from "@/components/ai/ai-insight-card";
import { HomeDashboard } from "@/components/dashboard/home-dashboard";
import { PersonalDashboard } from "@/components/dashboard/personal-dashboard";
import { PersonalizedFeed } from "@/components/dashboard/personalized-feed";
import { Top5SelectionPanel } from "@/components/football/top5-selection-panel";
import {
  LiveNavView,
  ValueNavView,
  FavorisNavView,
  ProfilNavView,
} from "@/components/dashboard/nav-extra-views";
import { DashboardDataProvider, useDashboardData } from "@/components/dashboard/dashboard-data-provider";
import { FeatureCards } from "@/components/dashboard/feature-cards";
import type { TennisMatch } from "@/lib/tennis-data";
import type { FootballMatch } from "@/lib/football-data";
import type { BasketballMatch } from "@/lib/basketball-data";

// Dialogs de détail globaux — lazy : ne chargent le code que si un match est
// réellement ouvert via le tableau "10 prochains matchs" (event open-match-detail).
// Miroir du pattern lazy utilisé dans les onglets tennis/football.
const TennisMatchDetailDialog = lazy(() =>
  import("@/components/tennis/match-detail-dialog").then((m) => ({
    default: m.MatchDetailDialog,
  })),
);
const FootballMatchDetailDialog = lazy(() =>
  import("@/components/football/football-match-detail-dialog").then((m) => ({
    default: m.FootballMatchDetailDialog,
  })),
);
const BasketballMatchDetailDialog = lazy(() =>
  import("@/components/basketball/basketball-match-detail-dialog").then((m) => ({
    default: m.BasketballMatchDetailDialog,
  })),
);

/** Demande d'ouverture d'un dialog de détail — union discriminée par sport. */
type DetailRequest =
  | { sport: "tennis"; match: TennisMatch }
  | { sport: "football"; match: FootballMatch }
  | { sport: "basketball"; match: BasketballMatch };

type SportTab =
  | "home"
  | "tennis"
  | "football"
  | "cs2"
  | "mma"
  | "basketball"
  | "cycling"
  | "f1"
  | "baseball"
  | "rugby"
  /** Vues nav mobile (bottom nav) — pas des sports : jamais synchronisées au store. */
  | "live"
  | "value"
  | "favoris"
  | "profil";

/** Ids de sport réels — les ids de nav mobile ("live", "profil"…) ne sont pas des sports. */
const SPORT_IDS: ReadonlySet<string> = new Set<SportTab>([
  "tennis",
  "football",
  "cs2",
  "mma",
  "basketball",
  "cycling",
  "f1",
  "baseball",
  "rugby",
]);

/** Vues nav (bottom nav mobile) + accueil : gérées par la page, hors store sport. */
const VIEW_TABS: ReadonlySet<string> = new Set<SportTab>([
  "home",
  "live",
  "value",
  "favoris",
  "profil",
]);

class PageErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: { componentStack?: string }) {
    if (process.env.NODE_ENV === "development" && typeof window !== "undefined") {
      (window as any).__PARISCORE_CRASH = {
        error: error.message,
        stack: error.stack,
        componentStack: info.componentStack,
      };
    }
  }
  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-bg-deep p-8" role="alert">
          <div className="text-center">
            <p className="text-sm text-red-400">Une erreur est survenue.</p>
            <button
              type="button"
              onClick={() => this.setState({ error: null })}
              className="mt-3 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-500"
              aria-label="Réessayer le chargement"
            >
              Réessayer
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function Home() {
  return (
    <DashboardDataProvider>
      <HomeInner />
    </DashboardDataProvider>
  );
}

function HomeInner() {
  const t = useTranslations("common");
  const tPrivacy = useTranslations("privacy");
  const tAbout = useTranslations("about");
  const tBankroll = useTranslations("bankroll");
  const tApiDocs = useTranslations("apiDocs");
  const tPaper = useTranslations("paperTrading");

  // La landing affiche la vue Accueil (dashboard neutre) — pas de sport imposé.
  const [activeTab, setActiveTab] = useState<SportTab>("home");
  const reduceMotion = useReducedMotion();

  // Pills navigation active state
  const [activePill, setActivePill] = useState("best-matches");

  // IntersectionObserver pour synchroniser le pill actif avec le scroll
  useEffect(() => {
    const sections = ["best-matches", "upcoming", "gemini"];
    const els = sections.map((s) => document.getElementById(`section-${s}`)).filter(Boolean);
    if (els.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio > 0.3) {
            const id = entry.target.id.replace("section-", "");
            setActivePill(id);
            break;
          }
        }
      },
      { threshold: [0, 0.3, 0.5, 1], rootMargin: "-80px 0px -40% 0px" },
    );

    els.forEach((el) => observer.observe(el!));
    return () => observer.disconnect();
  }, []);

  /** Scroll + met à jour activePill */
  const scrollToSection = (sectionId: string, pillId: string) => {
    setActivePill(pillId);
    const el = document.getElementById(sectionId);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  // Real data hooks
  const { tennisData, footData, tennisLoading, footLoading } = useDashboardData();

  // ── Dialog de détail global (I5) ──
  // Le tableau "10 prochains matchs" émet window CustomEvent("open-match-detail")
  // avec { sport, matchId }. On résout l'objet match complet depuis les données
  // du provider, puis on rend le dialog correspondant (tennis | football).
  const [detail, setDetail] = useState<DetailRequest | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const evt = e as CustomEvent<{ sport?: string; matchId?: string; match?: unknown }>;
      const { sport, matchId, match } = evt.detail ?? {};
      if (!sport || !matchId) return;
      if (sport === "tennis") {
        const m = (tennisData?.matches ?? []).find((item) => item.id === matchId);
        if (m) setDetail({ sport: "tennis", match: m });
      } else if (sport === "football") {
        const m = (footData?.matches ?? []).find((item) => item.id === matchId);
        if (m) setDetail({ sport: "football", match: m });
      }
      // basketball est géré dans BasketballTabContent (données locales)
    };
    window.addEventListener("open-match-detail", handler);
    return () => window.removeEventListener("open-match-detail", handler);
  }, [tennisData, footData]);

  // Compute stats dynamically
  const stats = useMemo(() => {
    const tennisMatches = tennisData?.matches ?? [];
    const footMatches = footData?.matches ?? [];

    // Count value bets (edge > 0 across all bookmakers)
    let tennisValues = 0;
    for (const m of tennisMatches) {
      if (!m.allOdds) continue;
      for (const odd of m.allOdds) {
        if (m.probA - odd.impliedProbA > 0 || m.probB - odd.impliedProbB > 0) {
          tennisValues++;
          break;
        }
      }
    }

    return {
      tennis: { matchCount: tennisMatches.length, valueCount: tennisValues },
      football: { matchCount: footMatches.length, valueCount: 0 },
      totalValueBets: tennisValues,
    };
  }, [tennisData?.matches, footData?.matches]);

  const handleTabChange = useCallback((tab: string) => {
    // Ignore les ids inconnus (protection) ; "home"/vues nav ne touchent pas
    // au store : l'arbre latéral garde le dernier sport, l'URL ?sport= reste stable.
    if (!VIEW_TABS.has(tab) && !SPORT_IDS.has(tab)) return;
    setActiveTab(tab as SportTab);
    if (SPORT_IDS.has(tab)) {
      useSportsSidebarStore.getState().syncSportFromTab(tab);
    }
  }, []);

  // Sidebar (store) → onglet central : un clic sport/ligue dans le filtre
  // latéral bascule la grille. Le store reste source de vérité URL-partageable.
  const storeSportId = useSportsSidebarStore((s) => s.selectedSportId);
  useEffect(() => {
    // activeTab volontairement hors deps : réagir à son changement re-déclencherait
    // la bascule en boucle (store = seule source de vérité pour ce retour).
    if (storeSportId && storeSportId !== activeTab) {
      setActiveTab(storeSportId as SportTab);
    }
  }, [storeSportId]);

  return (
    <PageErrorBoundary>
      <div className="min-h-screen flex flex-col bg-bg-deep pb-16 md:pb-0">
        {/* Ancien header supprimé — maintenant dans SiteHeader (layout.tsx) */}

        {/* Filtre latéral multi-sports (1xBet) : sync URL + aside desktop */}
        <SportsSidebarUrlSync />
        <div className="flex w-full flex-1 items-start">
          <SportsSidebar activeSport={activeTab} onSportChange={handleTabChange} />
          <div className="flex min-w-0 flex-1 flex-col">

        {/* Hero Dashboard Section (refonte 2026-08-25 — cf. .context/design-refonte-2026-08-25.md) */}
        <section className="sport-ambient max-w-6xl mx-auto w-full px-4 sm:px-6 pt-6" data-sport={activeTab}>
          <HeroSection totalValueBets={stats.totalValueBets} />

          {/* Feature Cards — bento grid avec images sportives */}
          <div className="mt-5">
            <FeatureCards />
          </div>

          {/* Ancres de navigation rapide */}
          <div className="mt-4 flex items-center gap-3 text-xs text-zinc-500 overflow-x-auto pb-1 scrollbar-none">
            <span className="shrink-0 font-medium text-zinc-400">Aller à :</span>
            <button
              type="button"
              onClick={() => scrollToSection("section-best-matches", "best-matches")}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1 transition-colors inline-flex items-center gap-1.5",
                activePill === "best-matches"
                  ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30 border-emerald-500/40"
                  : "border-border/50 hover:border-emerald-500/40 hover:text-emerald-400",
              )}
            >
              <Star className="h-3 w-3" /> Meilleurs matchs
            </button>
            <button
              type="button"
              onClick={() => scrollToSection("section-upcoming", "upcoming")}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1 transition-colors inline-flex items-center gap-1.5",
                activePill === "upcoming"
                  ? "bg-sky-500/20 text-sky-400 ring-1 ring-sky-500/30 border-sky-500/40"
                  : "border-border/50 hover:border-sky-500/40 hover:text-sky-400",
              )}
            >
              <Timer className="h-3 w-3" /> Prochains matchs
            </button>
            <button
              type="button"
              onClick={() => scrollToSection("section-gemini", "gemini")}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1 transition-colors inline-flex items-center gap-1.5",
                activePill === "gemini"
                  ? "bg-purple-500/20 text-purple-400 ring-1 ring-purple-500/30 border-purple-500/40"
                  : "border-border/50 hover:border-purple-500/40 hover:text-purple-400",
              )}
            >
              <Sparkles className="h-3 w-3" /> Gemini AI
            </button>
          </div>
        </section>



        {/* Content — entrée douce au changement de sport */}
        <motion.div
          key={activeTab}
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
        >
        {activeTab === "home" && (
          <>
            <HomeDashboard onSportSelect={handleTabChange} />
            <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 mt-6">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <PersonalDashboard />
                <div>
                  <h3 className="mb-3 text-sm font-semibold">Pour toi</h3>
                  <PersonalizedFeed />
                </div>
              </div>
            </div>
          </>
        )}
        {activeTab === "live" && <LiveNavView onSportSelect={handleTabChange} />}
        {activeTab === "value" && <ValueNavView />}
        {activeTab === "favoris" && (
          <FavorisNavView onOpenDrawer={() => useSportsSidebarStore.getState().setDrawerOpen(true)} />
        )}
        {activeTab === "profil" && <ProfilNavView />}
        {activeTab === "tennis" && <TennisTabContent />}
        {activeTab === "football" && <FootballTabContent />}
        {activeTab === "cs2" && <Cs2TabContent />}
        {activeTab === "mma" && <MmaTabContent />}
        {activeTab === "basketball" && <BasketballTabContent />}
        {activeTab === "cycling" && <CyclingTabContent />}
        {activeTab === "f1" && <F1TabContent />}
        {activeTab === "baseball" && <BaseballTabContent />}
        {activeTab === "rugby" && <RugbyTabContent />}
        </motion.div>

        {/* Sections déplacées : Meilleurs Matchs + Prochains Matchs + Gemini */}
        <section className="max-w-6xl mx-auto w-full px-4 sm:px-6 pt-8 space-y-6">
          <Top5SelectionPanel variant="inline" />
          <BestMatchesTabs id="section-best-matches" />
          <UpcomingTenMatchesTable id="section-upcoming" />
          <AIInsightCard id="section-gemini" />
        </section>
          </div>
        {/* Panneau des matchs sélectionnés Top5 — rail droit (desktop) */}
        <aside
          aria-label="Matchs sélectionnés"
          className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-72 shrink-0 overflow-y-auto border-l border-slate-800 bg-[#0b0f19]/40 xl:block"
        >
          <Top5SelectionPanel variant="rail" />
        </aside>
        </div>

        {/* Footer — toujours visible, padding bottom pour la bottom nav mobile */}
        <footer className="block mt-auto border-t border-white/10 bg-zinc-900/20 pb-20 md:pb-6">
          <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
            <div className="flex flex-col items-start justify-between gap-3 text-xs text-zinc-500 sm:flex-row sm:items-center">
              <p>
                <span className="font-semibold text-zinc-300">
                  {t("appName")}
                </span>{" "}
                · {t("footerCopyright")} · © 2026
              </p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={openPrivacyDialog}
                  className="font-medium underline underline-offset-2 transition-colors hover:text-zinc-300"
                >
                  {tPrivacy("footer.manageCookies")}
                </button>
                <span className="text-zinc-700">·</span>
                <button
                  type="button"
                  onClick={openAboutDialog}
                  className="inline-flex items-center gap-1 font-medium underline underline-offset-2 transition-colors hover:text-zinc-300"
                >
                  <HelpCircle className="h-3 w-3" />
                  {tAbout("trigger")}
                </button>
                <span className="text-zinc-700">·</span>
                <button
                  type="button"
                  onClick={openApiDocsDialog}
                  className="inline-flex items-center gap-1 font-medium underline underline-offset-2 transition-colors hover:text-zinc-300"
                >
                  <Code className="h-3 w-3" />
                  {tApiDocs("trigger")}
                </button>
              </div>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-zinc-600/80">
              {t("footerWarning")}
            </p>
          </div>
        </footer>

        {/* Mobile bottom navigation */}
        <MobileBottomNav activeTab={activeTab} onTabChange={handleTabChange} />

        {/* Dialog de détail global — ouvert par CustomEvent("open-match-detail").
            Rend le dialog du sport correspondant ; ESC / clic overlay → onOpenChange(false). */}
        {detail?.sport === "tennis" && (
          <Suspense fallback={null}>
            <TennisMatchDetailDialog
              match={detail.match}
              open
              onOpenChange={(open) => {
                if (!open) setDetail(null);
              }}
            />
          </Suspense>
        )}
        {detail?.sport === "football" && (
          <Suspense fallback={null}>
            <FootballMatchDetailDialog
              match={detail.match}
              open
              onOpenChange={(open) => {
                if (!open) setDetail(null);
              }}
            />
          </Suspense>
        )}
      </div>
    </PageErrorBoundary>
  );
}
