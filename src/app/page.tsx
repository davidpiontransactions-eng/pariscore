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
import { SportTabs } from "@/components/layout/sport-tabs";
import { TennisTabContent } from "@/components/football/tennis-tab-content";
import { FootballTabContent } from "@/components/football/football-tab-content";
import { Cs2TabContent } from "@/components/cs2/cs2-tab-content";
import { MmaTabContent } from "@/components/mma/mma-tab-content";
import { NbaTabContent } from "@/components/nba/nba-tab-content";
import { WnbaTabContent } from "@/components/wnba/wnba-tab-content";
import { CyclingTabContent } from "@/components/cycling/cycling-tab-content";
import { F1TabContent } from "@/components/f1/f1-tab-content";

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
      <div className="min-h-screen flex flex-col bg-[#0F0F1A]">
        {/* Header */}
        <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0F0F1A]/80 backdrop-blur-md">
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
        </header>

        {/* Sport tabs */}
        <SportTabs activeTab={activeTab} onTabChange={handleTabChange} />

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
        <footer className="mt-auto border-t border-white/10 bg-zinc-900/20">
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
      </div>
    </PageErrorBoundary>
  );
}
