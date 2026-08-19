"use client";

import { Play } from "lucide-react";
import type { TennisHighlight } from "@/lib/scraping/tennistv-highlights-service";
import { cn } from "@/lib/utils";

type Props = {
  /** Highlight du dernier match du joueur (null → rendu masqué). */
  highlight: TennisHighlight | null;
  /** Nom du joueur (pour le libellé accessible). */
  playerName: string;
  /** Masquer pendant le chargement pour éviter les sauts de layout. */
  isLoading?: boolean;
  className?: string;
};

/**
 * Chip « Dernier match » — lien YouTube vers le dernier highlight TennisTV
 * du joueur. Affiché sous les stats / forme récente dans le PlayerBlock.
 * Masqué tant qu'aucun highlight n'est résolu.
 */
export function LastMatchHighlight({
  highlight,
  playerName,
  isLoading = false,
  className,
}: Props) {
  if (isLoading || !highlight) return null;

  return (
    <a
      href={highlight.url}
      target="_blank"
      rel="noopener noreferrer"
      title={`Dernier match de ${playerName} : ${highlight.title}`}
      className={cn(
        "mt-2 inline-flex max-w-full items-center gap-1.5",
        "rounded-full border border-border/60 bg-muted/40 px-2.5 py-1",
        "text-[11px] font-medium text-muted-foreground",
        "transition-colors hover:border-emerald-500/40 hover:text-emerald-600 dark:hover:text-emerald-400",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
    >
      <Play className="h-2.5 w-2.5 shrink-0 fill-current" aria-hidden />
      <span className="truncate">{highlight.title}</span>
      {highlight.lengthText && (
        <span className="shrink-0 font-mono text-[11px] text-muted-foreground/70">
          {highlight.lengthText}
        </span>
      )}
    </a>
  );
}
