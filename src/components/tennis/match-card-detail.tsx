"use client";

import {
  TrendingUp,
  Target,
  Scale,
  Calendar,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type { TennisMatch } from "@/lib/tennis-data";

// Types internes — extraits de ce que MatchCard passait déjà au JSX.
type PlayerInfo = {
  name: string;
  shortName: string;
  elo: number;
  form: ("W" | "L")[];
};

type MatchStats = {
  surface: string;
  ic: [number, number];
  eloGap: number;
  h2h: string;
  form: string;
};

type Props = {
  match: TennisMatch;
  stats: MatchStats;
  playerA: PlayerInfo;
  playerB: PlayerInfo;
};

/**
 * Panneau détail de la MatchCard (accordéon).
 *
 * Affiche 4 cartes d'information : décomposition du modèle,
 * intervalle de confiance, écart Elo, forme récente des joueurs.
 */
export function MatchCardDetail({ match, stats, playerA, playerB }: Props) {
  const t = useTranslations("match");

  return (
    <div
      id={`match-${match.id}-details`}
      className="border-t border-border/60 bg-muted/10 px-4 py-4 sm:px-6"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DetailItem
          icon={<TrendingUp className="h-4 w-4" />}
          label={t("decompLabel")}
          value={t("decompValue", {
            model: match.model,
            eloA: playerA.elo,
            eloB: playerB.elo,
          })}
          hint={t("decompHint")}
        />
        <DetailItem
          icon={<Target className="h-4 w-4" />}
          label={t("icLabel")}
          value={t("icValue", { lo: stats.ic[0], hi: stats.ic[1] })}
          hint={t("icHint", {
            prob: match.probA,
            amp: stats.ic[1] - stats.ic[0],
          })}
        />
        <DetailItem
          icon={<Scale className="h-4 w-4" />}
          label={t("eloGapLabel")}
          value={t("eloGapValue", { n: stats.eloGap })}
          hint={t("eloGapHint", {
            surface: stats.surface,
            h2h: stats.h2h,
            player: playerA.shortName,
          })}
        />
        <DetailItem
          icon={<Calendar className="h-4 w-4" />}
          label={t("formLabel")}
          value={stats.form}
          hint={t("formHint", {
            pa: playerA.shortName,
            fa: playerA.form.join("-"),
            pb: playerB.shortName,
            fb: playerB.form.join("-"),
          })}
        />
      </div>

      <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-300">
        <span className="font-semibold">{t("warning")} :</span>{" "}
        {t("warningText")}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sous-composant utilitaire — une carte de détail individuelle
// ---------------------------------------------------------------------------

function DetailItem({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-border/60 bg-background/60 p-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em]">
          {label}
        </span>
      </div>
      <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
        {value}
      </span>
      {hint && (
        <span className="text-[11px] text-muted-foreground">{hint}</span>
      )}
    </div>
  );
}
