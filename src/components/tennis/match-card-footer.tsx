"use client";

import { ChevronDown, WifiOff, BarChart3, TrendingUp, Clock, Mail, Loader2, ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import { formatRelativeTime, type TennisMatch } from "@/lib/tennis-data";
import { fmtSPS, fmtSPSRank } from "@/lib/tennis-stats/sps-utils";
import type { PlayerStats } from "@/lib/tennis-stats/types";
import type { LiveMatchState } from "@/hooks/use-live-matches";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type Props = {
  match: TennisMatch;
  statsA?: PlayerStats;
  statsB?: PlayerStats;
  isLive: boolean;
  liveState?: LiveMatchState;
  disconnected: boolean;
  open: boolean;
  emailSending: boolean;
  modelUpdatedAt: string;
  onToggleDetail: () => void;
  onOpenDetail?: () => void;
  onEmailTestAlert: () => void;
  onBetCta: () => void;
};

/**
 * Pied de la MatchCard.
 *
 * Affiche la comparaison SPS entre les deux joueurs, le rang SPS,
 * l'horodatage du modèle, et les actions CTA : détail, analyse
 * complète, alerte email, parier.
 */
export function MatchCardFooter({
  match,
  statsA,
  statsB,
  isLive,
  liveState,
  disconnected,
  open,
  emailSending,
  modelUpdatedAt,
  onToggleDetail,
  onOpenDetail,
  onEmailTestAlert,
  onBetCta,
}: Props) {
  const t = useTranslations("match");
  const tTime = useTranslations("time");
  const tEmail = useTranslations("email");

  return (
    <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 bg-muted/20 px-4 py-3 sm:px-6">
      {/* Colonne gauche : SPS · classement · horodatage · offline */}
      <div className="flex min-w-0 flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
        {/* SPS player A vs B */}
        <span className="flex items-center gap-1.5">
          <BarChart3 className="h-3.5 w-3.5" />
          <span className="font-semibold">{t("spsLabel")}</span>
          <span className="font-medium text-foreground">
            {fmtSPS(statsA?.sps)}
          </span>
          <span className="text-border" aria-hidden>vs</span>
          <span className="font-medium text-foreground">
            {fmtSPS(statsB?.sps)}
          </span>
        </span>

        <span className="text-border">·</span>

        {/* SPS Ranking A vs B */}
        <span className="flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5" />
          <span className="font-semibold">{t("spsRankLabel")}</span>
          <span className="tabular-nums">
            {fmtSPSRank(statsA?.spsRank)} <span className="text-border">vs</span> {fmtSPSRank(statsB?.spsRank)}
          </span>
        </span>

        <span className="text-border">·</span>

        {/* Horodatage du modèle */}
        <span className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          <span>
            {isLive && liveState
              ? `${t("modelUpdated")} ${formatRelativeTime(liveState.lastUpdate, tTime)}`
              : `${t("modelUpdated")} ${formatRelativeTime(modelUpdatedAt, tTime)}`}
          </span>
        </span>

        {disconnected && (
          <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
            <span className="text-border">·</span>
            <WifiOff className="h-3.5 w-3.5" />
            <span className="font-semibold">{t("offline")}</span>
          </span>
        )}
      </div>

      {/* Colonne droite : boutons d'action */}
      <div className="flex shrink-0 items-center gap-2">
        {/* Détail accordéon */}
        <button
          type="button"
          onClick={onToggleDetail}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold",
            "text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
          aria-expanded={open}
          aria-controls={`match-${match.id}-details`}
        >
          {open ? t("detailHide") : t("detail")}
          <ChevronDown
            className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")}
          />
        </button>

        {/* Analyse complète (modale) */}
        {onOpenDetail && (
          <button
            type="button"
            onClick={onOpenDetail}
            className={cn(
              "flex items-center gap-1.5 rounded-md border border-border/60 px-2.5 py-1.5 text-xs font-semibold",
              "text-foreground transition-colors hover:bg-muted",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            <BarChart3 className="h-3 w-3" />
            <span className="hidden sm:inline">{t("analysis")}</span>
            <span className="sm:hidden">{t("analysisShort")}</span>
          </button>
        )}

        {/* Alerte email (tooltip) */}
        {match.odds && (
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onEmailTestAlert}
                  disabled={emailSending}
                  aria-label={tEmail("testAlert")}
                  className={cn(
                    "flex items-center justify-center rounded-md border border-border/60 p-1.5",
                    "text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    "disabled:cursor-not-allowed disabled:opacity-60",
                  )}
                >
                  {emailSending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Mail className="h-3.5 w-3.5" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent>{tEmail("testAlert")}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* Parier CTA */}
        <button
          type="button"
          onClick={onBetCta}
          className={cn(
            "flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white",
            "transition-colors hover:bg-emerald-700",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          )}
        >
          {t("bet")}
          <ExternalLink className="h-3 w-3" />
        </button>
      </div>
    </footer>
  );
}
