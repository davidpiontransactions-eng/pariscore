"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, Share2, Heart, Bell } from "lucide-react";
import { DrawerDetail } from "@/components/layout/drawer-detail";
import { SwipeableTabs } from "@/components/mobile/swipeable-tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FollowButton } from "@/components/shared/follow-button";
import { OddsSparkline } from "@/components/shared/odds-sparkline";
import { MiniProbabilityCurve } from "@/components/shared/mini-probability-curve";
import { ConfidenceRing } from "@/components/shared/confidence-ring";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

/**
 * T22 — MobileMatchDetail
 *
 * Version mobile-optimisée du match detail (FotMob-style).
 * Utilise DrawerDetail pour un BottomSheet sur mobile, Dialog sur desktop.
 *
 * Structure mobile-first :
 * - Header fixe (player names, score, boutons retour/partager/suivre)
 * - Tabs scrollables horizontalement (overview, stats, odds, etc.)
 * - Contenu scrollable avec disclosure progressif
 * - Footer sticky (bouton "Parier" ou "Voir les pronos")
 */

type MatchData = {
  id: string;
  playerA: string;
  playerB: string;
  scoreA?: string;
  scoreB?: string;
  tournament?: string;
  round?: string;
  startTime?: string;
  sport?: string;
  // Prédictions
  probA?: number;
  odds?: { bookmaker: string; decimal: number }[];
  confidence?: number;
};

type Props = {
  match: MatchData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children?: React.ReactNode;
};

export function MobileMatchDetail({ match, open, onOpenChange, children }: Props) {
  const t = useTranslations("match");
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState("overview");

  if (!match) return null;

  return (
    <DrawerDetail open={open} onOpenChange={onOpenChange}>
      <div className="flex flex-col max-h-[80vh]">
        {/* Header — Score + Actions */}
        <div className="sticky top-0 z-10 bg-card border-b border-border/30">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              {isMobile && (
                <button
                  onClick={() => onOpenChange(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-muted/50 text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
              )}
              <div>
                <div className="text-[10px] text-muted-foreground">
                  {match.tournament} {match.round && `• ${match.round}`}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <FollowButton
                id={`match:${match.sport}:${match.id}`}
                name={`${match.playerA} vs ${match.playerB}`}
                category="match"
                sport={match.sport}
                size="sm"
              />
              <button
                className="flex h-8 w-8 items-center justify-center rounded-full bg-muted/50 text-muted-foreground hover:text-foreground"
                aria-label="Partager"
              >
                <Share2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Score display */}
          <div className="px-4 pb-3">
            <div className="flex items-center justify-center gap-4">
              <div className="flex-1 text-right">
                <div className="font-semibold text-sm">{match.playerA}</div>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="font-mono text-2xl font-bold tabular-nums">
                  {match.scoreA ?? "-"}
                </div>
                <div className="font-mono text-2xl font-bold tabular-nums">
                  {match.scoreB ?? "-"}
                </div>
              </div>
              <div className="flex-1 text-left">
                <div className="font-semibold text-sm">{match.playerB}</div>
              </div>
            </div>
          </div>

          {/* Tabs — SwipeableTabs pour swipe horizontal mobile */}
          <SwipeableTabs
            tabs={[
              { id: "overview", label: t("overview") },
              { id: "stats", label: t("stats") },
              { id: "odds", label: t("odds") },
              { id: "h2h", label: "H2H" },
            ]}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            className="border-b border-border/30"
          />
        </div>

        {/* Scrollable content */}
        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-4">
            {activeTab === "overview" && (
              <div className="space-y-4">
                {/* Prédictions */}
                  {match.probA !== undefined && (
                  <div className="flex items-center justify-center gap-6">
                    <ConfidenceRing
                      value={match.probA * 100}
                      confidence={match.confidence ?? 0}
                      size={80}
                      color="#00e676"
                    />
                    <div className="text-xs text-muted-foreground space-y-1">
                      <div>
                        <span className="font-medium text-foreground">{match.playerA}</span>{" "}
                        <span className="font-mono">{(match.probA * 100).toFixed(1)}%</span>
                      </div>
                      <div>
                        <span className="font-medium text-foreground">{match.playerB}</span>{" "}
                        <span className="font-mono">{((1 - match.probA) * 100).toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Cotes rapides */}
                {match.odds && match.odds.length > 0 && (
                  <div className="rounded-lg border border-border/30 p-3">
                    <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
                      Cotes
                    </div>
                    <div className="flex items-center justify-between">
                      {match.odds.slice(0, 3).map((odd) => (
                        <div key={odd.bookmaker} className="text-center">
                          <div className="text-[10px] text-muted-foreground">{odd.bookmaker}</div>
                          <div className="font-mono text-sm font-medium">{odd.decimal.toFixed(2)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {children}
              </div>
            )}

            {activeTab === "stats" && (
              <div className="text-sm text-muted-foreground">
                Statistiques détaillées du match...
              </div>
            )}

            {activeTab === "odds" && (
              <div className="text-sm text-muted-foreground">
                Historique des cotes...
              </div>
            )}

            {activeTab === "h2h" && (
              <div className="text-sm text-muted-foreground">
                Confrontations directes...
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </DrawerDetail>
  );
}
