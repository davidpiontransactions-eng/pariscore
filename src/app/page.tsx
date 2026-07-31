"use client";

import { useState, Component, type ReactNode, useCallback } from "react";
import {
  Trophy,
  Wallet,
  Code,
  FlaskConical,
  HelpCircle,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { openPrivacyDialog } from "@/components/privacy-dialog";
import { openAboutDialog } from "@/components/about-dialog";
import { openApiDocsDialog } from "@/components/api-docs-dialog";
import { openPaperTradingDialog } from "@/components/paper-trading-dialog";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { PushToggle } from "@/components/push-toggle";
import { EmailToggle } from "@/components/email-toggle";
import { TerminalToggle } from "@/components/terminal-toggle";
import { ValueBetScannerIndicator } from "@/components/value-bet-scanner-indicator";
import { Button } from "@/components/ui/button";
import { openBankrollDialog } from "@/components/bankroll-dialog";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { AutoHideHeader } from "@/components/layout/auto-hide-header";
import { SportSwipeHeader } from "@/components/layout/sport-swipe-header";
import { TennisTabContent } from "@/components/football/tennis-tab-content";
import { FootballTabContent } from "@/components/football/football-tab-content";
import { Cs2TabContent } from "@/components/cs2/cs2-tab-content";
import { MmaTabContent } from "@/components/mma/mma-tab-content";
import { NbaTabContent } from "@/components/nba/nba-tab-content";
import { WnbaTabContent } from "@/components/wnba/wnba-tab-content";
import { CyclingTabContent } from "@/components/cycling/cycling-tab-content";
import { F1TabContent } from "@/components/f1/f1-tab-content";
import { TopValueBetsList } from "@/components/dashboard/top-value-bets";
import { LiveNowCrossSport } from "@/components/dashboard/live-now-cross-sport";
import { AIInsightCard } from "@/components/ai/ai-insight-card";

type SportTab = "tennis" | "football" | "cs2" | "mma" | "nba" | "wnba" | "cycling" | "f1";

class PageErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: { componentStack?: string }) {
    console.error("[PariScore CRASH]", error.message, error.stack);
    if (typeof window !== "undefined") {
      (window as any).__PARISCORE_CRASH = {
        error: error.message,
        stack: error.stack,
        componentStack: info.componentStack,
      };
    }
  }
  render() {
    if (this.state.error) return <div />;
    return this.props.children;
  }
}

export default function Home() {
  const t = useTranslations("common");
  const tPrivacy = useTranslations("privacy");
  const tAbout = useTranslations("about");
  const tBankroll = useTranslations("bankroll");
  const tApiDocs = useTranslations("apiDocs");
  const tPaper = useTranslations("paperTrading");

  const [activeTab, setActiveTab] = useState<SportTab>("tennis");

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab as SportTab);
  }, []);

  return (
    <PageErrorBoundary>
      <div className="min-h-screen flex flex-col bg-bg-deep pb-16 md:pb-0">
        {/* Header */}
        <AutoHideHeader className="bg-bg-deep/80 backdrop-blur-md">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white">
                <Trophy className="h-4 w-4" />
              </div>
              <span className="text-sm font-bold tracking-tight text-white">
                {t("appName")}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <LanguageToggle />
              <PushToggle />
              <EmailToggle />
              <TerminalToggle />
              <ValueBetScannerIndicator />
              <Button
                variant="ghost"
                size="sm"
                onClick={openBankrollDialog}
                className="gap-1.5 text-xs text-zinc-300 hover:text-white"
              >
                <Wallet className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{tBankroll("trigger")}</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={openPaperTradingDialog}
                className="gap-1.5 text-xs text-purple-400 hover:text-purple-300"
                title={tPaper("subtitle")}
              >
                <FlaskConical className="h-3.5 w-3.5" />
                <span className="hidden md:inline">{tPaper("trigger")}</span>
              </Button>
              <ThemeToggle />
            </div>
          </div>
        </AutoHideHeader>

        {/* Hero Dashboard Section */}
        <section className="max-w-6xl mx-auto w-full px-4 sm:px-6 pt-6">
          <h1 className="text-2xl font-bold text-white">Bonjour</h1>
          <p className="text-sm text-zinc-400 mt-1">
            3 value bets détectés aujourd&apos;hui
          </p>

          {/* Sport Trend Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            {([
              { id: "tennis", label: "Tennis", emoji: "🎾", matchCount: 14, valueCount: 5, accent: "border-emerald-500/30 hover:border-emerald-500/60", accentBg: "bg-emerald-500/10", accentText: "text-emerald-400" },
              { id: "football", label: "Football", emoji: "⚽", matchCount: 22, valueCount: 3, accent: "border-sky-500/30 hover:border-sky-500/60", accentBg: "bg-sky-500/10", accentText: "text-sky-400" },
              { id: "mma", label: "MMA", emoji: "🥊", matchCount: 8, valueCount: 2, accent: "border-red-500/30 hover:border-red-500/60", accentBg: "bg-red-500/10", accentText: "text-red-400" },
              { id: "cycling", label: "Cycling", emoji: "🚴", matchCount: 6, valueCount: 1, accent: "border-amber-500/30 hover:border-amber-500/60", accentBg: "bg-amber-500/10", accentText: "text-amber-400" },
            ] as const).map((sport) => (
              <button
                key={sport.id}
                type="button"
                onClick={() => handleTabChange(sport.id)}
                className={`flex flex-col items-start gap-1.5 rounded-xl border bg-zinc-900/60 p-4 text-left transition-all duration-200 hover:bg-zinc-800/60 hover:scale-[1.02] ${sport.accent} ${activeTab === sport.id ? "ring-1 ring-white/20" : ""}`}
              >
                <div className="flex items-center gap-2 w-full">
                  <span className="text-xl">{sport.emoji}</span>
                  <span className="text-sm font-semibold text-white">{sport.label}</span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-zinc-400">
                    <span className="font-medium text-zinc-200">{sport.matchCount}</span> matchs
                  </span>
                  <span className={`font-semibold ${sport.accentText}`}>
                    <span className={`inline-flex items-center justify-center rounded-full ${sport.accentBg} px-1.5 py-0.5 text-[11px]`}>
                      {sport.valueCount} values
                    </span>
                  </span>
                </div>
              </button>
            ))}
          </div>

          {/* P4: Top Value Bets + Live Now (cross-sport) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
            <TopValueBetsList />
            <LiveNowCrossSport />
          </div>

          {/* P4: AI Insight Card */}
          <div className="mt-4">
            <AIInsightCard />
          </div>
        </section>

        {/* Sport tabs */}
        <SportSwipeHeader activeTab={activeTab} onTabChange={handleTabChange} />

        {/* Content */}
        {activeTab === "tennis" && <TennisTabContent />}
        {activeTab === "football" && <FootballTabContent />}
        {activeTab === "cs2" && <Cs2TabContent />}
        {activeTab === "mma" && <MmaTabContent />}
        {activeTab === "nba" && <NbaTabContent />}
        {activeTab === "wnba" && <WnbaTabContent />}
        {activeTab === "cycling" && <CyclingTabContent />}
        {activeTab === "f1" && <F1TabContent />}

        {/* Footer */}
        <footer className="hidden md:block mt-auto border-t border-white/10 bg-zinc-900/20">
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
      </div>
    </PageErrorBoundary>
  );
}
