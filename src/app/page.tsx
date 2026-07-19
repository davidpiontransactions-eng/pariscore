"use client";

import { useState, Component, type ReactNode } from "react";
import { Trophy, RefreshCw, Wallet, Code, FlaskConical, HelpCircle, Info } from "lucide-react";
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
import { TennisTabContent } from "@/components/football/tennis-tab-content";
import { FootballTabContent } from "@/components/football/football-tab-content";
import { cn } from "@/lib/utils";

type SportTab = "tennis" | "football";

const SPORTS: { key: SportTab; label: string; icon: string }[] = [
  { key: "tennis", label: "Tennis", icon: "🎾" },
  { key: "football", label: "Football", icon: "⚽" },
];

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
      (window as any).__PARISCORE_CRASH = { error: error.message, stack: error.stack, componentStack: info.componentStack };
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

  return (
    <PageErrorBoundary>
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white">
              <Trophy className="h-4 w-4" />
            </div>
            <span className="text-sm font-bold tracking-tight">{t("appName")}</span>
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

      {/* Sport tabs */}
      <div className="border-b border-border/60 bg-muted/30">
        <div className="mx-auto flex max-w-6xl px-4 sm:px-6">
          {SPORTS.map((s) => (
            <button
              key={s.key}
              onClick={() => setActiveTab(s.key)}
              className={cn(
                "relative flex items-center gap-2 px-4 py-3 text-sm font-semibold transition-colors",
                "hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                activeTab === s.key
                  ? "text-foreground after:absolute after:bottom-0 after:left-2 after:right-2 after:h-0.5 after:rounded-full after:bg-emerald-500"
                  : "text-muted-foreground",
              )}
            >
              <span>{s.icon}</span>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {activeTab === "tennis" ? <TennisTabContent /> : <FootballTabContent />}

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
            </div>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground/80">
            {t("footerWarning")}
          </p>
        </div>
      </footer>
    </div>
    </PageErrorBoundary>
  );
}
