"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

type DisclosureLevel = "level1" | "level2" | "level3";

type ProgressiveDisclosureProps = {
  /** Sport name */
  sport: string;
  /** Home team name */
  homeTeam: string;
  /** Away team name */
  awayTeam: string;
  /** Home odd (optional) */
  oddHome?: number;
  /** Away odd (optional) */
  oddAway?: number;
  /** Probabilities object (optional) */
  probabilities?: {
    homeWin?: number;
    awayWin?: number;
    draw?: number;
  };
  /** Stats object (optional) */
  stats?: {
    homeShots?: number;
    awayShots?: number;
    homeSOT?: number;
    awaySOT?: number;
  };
  /** Callback when level changes */
  onLevelChange?: (level: DisclosureLevel) => void;
};

/**
 * ProgressiveDisclosure — Disclosure progressive en 3 niveaux pour les cartes de match.
 *
 * - Niveau 1 (toujours visible) : Sport, équipes, cotes simples
 * - Niveau 2 (expandable/tooltip) : Probabilités, stats clés
 * - Niveau 3 (dialogue complet) : Analyse profonde
 */
export function ProgressiveDisclosure({
  sport,
  homeTeam,
  awayTeam,
  oddHome,
  oddAway,
  probabilities,
  stats,
  onLevelChange,
}: ProgressiveDisclosureProps) {
  const [disclosureLevel, setDisclosureLevel] = useState<DisclosureLevel>("level1");
  const t = useTranslations("disclosure");

  // Change de niveau et appelle le callback
  const setLevel = (level: DisclosureLevel) => {
    setDisclosureLevel(level);
    onLevelChange?.(level);
  };

  // Niveau 1: Informations de base toujours visibles
  const level1 = (
    <div className="p-4 rounded-lg border border-border/60 bg-card/80">
      <div className="flex items-center gap-3">
        <span className="text-lg font-bold">
          {homeTeam} vs {awayTeam}
        </span>
      </div>
      {oddHome !== undefined && oddAway !== undefined && (
        <div className="mt-2 flex gap-2">
          <span className="text-sm font-medium text-emerald-600">
            {oddAway.toFixed(2)}
          </span>
          <span className="text-sm font-medium text-rose-600">
            {oddHome.toFixed(2)}
          </span>
        </div>
      )}
    </div>
  );

  // Niveau 2: Probabilités et stats clés (via tooltip ou click pour monter au niveau 3)
  const level2 = (
    <div className="p-4 rounded-lg border border-border/60 bg-card/80">
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="flex items-center gap-2 cursor-pointer hover:bg-card/50 transition-colors"
            onClick={() => setLevel("level3")}
            role="button"
            aria-label={t("expand_details_aria")}
          >
            <ChevronDown className="h-3.5 w-3.5 mr-2" />
            <span>{t("expand_details")}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="w-64 text-sm text-muted-foreground"
        >
          <p className="font-medium">{t("probabilities")}:</p>
          <div className="grid grid-cols-3 gap-2 mt-1">
            {probabilities?.homeWin !== undefined && (
              <div>
                <span className="text-emerald-600">
                  {t("home_win")}: {probabilities.homeWin}%
                </span>
              </div>
            )}
            {probabilities?.awayWin !== undefined && (
              <div>
                <span className="text-rose-600">
                  {t("away_win")}: {probabilities.awayWin}%
                </span>
              </div>
            )}
            {probabilities?.draw !== undefined && (
              <div>
                <span className="text-amber-600">
                  {t("draw")}: {probabilities.draw}%
                </span>
              </div>
            )}
          </div>
          <p className="mt-2 font-medium">{t("key_stats")}:</p>
          <div className="grid grid-cols-2 gap-2 mt-1">
            {stats?.homeShots !== undefined && (
              <div>
                <span>{t("home_shots")}: {stats.homeShots}</span>
              </div>
            )}
            {stats?.awayShots !== undefined && (
              <div>
                <span>{t("away_shots")}: {stats.awayShots}</span>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </div>
  );

  // Niveau 3: Dialogue complet
  const level3 = (
    <Dialog
      open={disclosureLevel === "level3"}
      onOpenChange={(open) => {
        if (!open) setLevel("level1");
      }}
    >
      <DialogContent className="p-6 sm:p-8 max-w-2xl">
        <DialogHeader className="border-b border-border/60 pb-4">
          <DialogTitle className="text-xl font-bold">
            {t("deep_dive_title", { homeTeam, awayTeam })}
          </DialogTitle>
          <DialogDescription>{t("deep_dive_description")}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <p className="font-medium text-sm text-muted-foreground">{t("home_win")}</p>
            <p className="text-2xl font-bold">
              {probabilities?.homeWin?.toFixed(1) ?? "-"}%
            </p>
          </div>
          <div>
            <p className="font-medium text-sm text-muted-foreground">{t("away_win")}</p>
            <p className="text-2xl font-bold">
              {probabilities?.awayWin?.toFixed(1) ?? "-"}%
            </p>
          </div>
          <div>
            <p className="font-medium text-sm text-muted-foreground">{t("draw")}</p>
            <p className="text-2xl font-bold">
              {probabilities?.draw?.toFixed(1) ?? "-"}%
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <p className="font-medium text-sm text-muted-foreground">{t("home_shots")}</p>
            <p className="text-xl font-bold">{stats?.homeShots ?? 0}</p>
          </div>
          <div>
            <p className="font-medium text-sm text-muted-foreground">{t("away_shots")}</p>
            <p className="text-xl font-bold">{stats?.awayShots ?? 0}</p>
          </div>
          <div>
            <p className="font-medium text-sm text-muted-foreground">{t("home_sot")}</p>
            <p className="text-xl font-bold">{stats?.homeSOT ?? 0}</p>
          </div>
          <div>
            <p className="font-medium text-sm text-muted-foreground">{t("away_sot")}</p>
            <p className="text-xl font-bold">{stats?.awaySOT ?? 0}</p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setLevel("level1")}
            className="w-full"
          >
            {t("close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="w-full space-y-2">
      {/* Niveau 1 - toujours visible */}
      <div>{level1}</div>

      {/* Niveau 2 - tooltip/expandable */}
      <div>{level2}</div>

      {/* Niveau 3 - dialogue (visible seulement si level2 ou level3) */}
      {disclosureLevel !== "level1" && level3}
    </div>
  );
}