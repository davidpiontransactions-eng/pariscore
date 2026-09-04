"use client";

import { useTranslations } from "next-intl";
import { PersonalDashboard } from "@/components/dashboard/personal-dashboard";
import { PersonalizedFeed } from "@/components/dashboard/personalized-feed";
import { SessionReminder } from "@/components/shared/session-reminder";
import { usePaperTrading } from "@/hooks/use-paper-trading";
import { BentoGrid, BentoTile } from "@/components/ui/bento-grid";

/**
 * Page Dashboard personnel.
 *
 * Affiche :
 * - KPIs favoris (win rate, profit, série)
 * - Feed personnalisé (matchs des follows)
 * - Session reminder (responsible gambling)
 *
 * Pattern The Athletic / FotMob : dashboard = hub central
 * avec accès rapide aux infos personnelles.
 */

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const { bets } = usePaperTrading();
  const pendingBets = bets.filter((b) => b.status === "pending").length;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-lg font-bold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("subtitle")}
        </p>
      </div>

      {/* Session Reminder */}
      <div className="mb-4">
        <SessionReminder betsPlaced={pendingBets} />
      </div>

      {/* Dashboard Grid — Bento layout */}
      <BentoGrid cols={4}>
        {/* KPIs — tile large */}
        <BentoTile size="wide" variant="glass">
          <PersonalDashboard />
        </BentoTile>

        {/* Feed personnalisé — tile standard */}
        <BentoTile size="standard" variant="glass">
          <h3 className="mb-3 text-sm font-semibold">Pour toi</h3>
          <PersonalizedFeed />
        </BentoTile>
      </BentoGrid>
    </div>
  );
}
