"use client";

import { useTranslations } from "next-intl";
import { PersonalDashboard } from "@/components/dashboard/personal-dashboard";
import { PersonalizedFeed } from "@/components/dashboard/personalized-feed";
import { SessionReminder } from "@/components/shared/session-reminder";
import { usePaperTrading } from "@/hooks/use-paper-trading";

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

      {/* Dashboard Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Colonne gauche : KPIs */}
        <div>
          <PersonalDashboard />
        </div>

        {/* Colonne droite : Feed personnalisé */}
        <div>
          <h3 className="mb-3 text-sm font-semibold">Pour toi</h3>
          <PersonalizedFeed />
        </div>
      </div>
    </div>
  );
}
