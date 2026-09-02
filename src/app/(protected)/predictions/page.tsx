"use client";

import { useTranslations } from "next-intl";
import { PredictionHistory } from "@/components/dashboard/prediction-history";
import { SessionReminder } from "@/components/shared/session-reminder";
import { usePaperTrading } from "@/hooks/use-paper-trading";

/**
 * Page Historique des prédictions.
 *
 * Affiche :
 * - Liste des paris avec statut (pending/won/lost)
 * - Stats agrégées (win rate, profit, ROI)
 * - Filtrage par sport, statut, période
 *
 * Pattern The Athletic : données claires avec disclosure progressif.
 */

export default function PredictionsPage() {
  const t = useTranslations("predictions");
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

      {/* Prediction History */}
      <PredictionHistory />
    </div>
  );
}
