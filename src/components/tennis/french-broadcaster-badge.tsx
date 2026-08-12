"use client";

import { Tv } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { getFrenchBroadcaster } from "@/lib/french-broadcasters";

type Props = {
  /** Nom du tournoi (ex. "National Bank Open") — résout la chaîne FR. */
  tournament: string;
  className?: string;
};

/**
 * Badge « Diffusé en France sur … » — remplace le bouton Watch live dans
 * l'encart d'analyse du match. Chaîne résolue statiquement par mapping
 * tournoi → diffuseur (Eurosport / France TV / …).
 */
export function FrenchBroadcasterBadge({ tournament, className }: Props) {
  const t = useTranslations("detail");
  const { channel } = getFrenchBroadcaster(tournament);

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900 px-3 py-1.5",
        className,
      )}
    >
      <Tv className="h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden />
      <span className="text-[10px] font-medium leading-tight text-slate-300">
        {t("streamOnFrance", { channel })}
      </span>
    </div>
  );
}