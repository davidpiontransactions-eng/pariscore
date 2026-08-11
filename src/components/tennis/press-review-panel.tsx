"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { usePressReview, type PressSource, type PressConsensus } from "@/hooks/use-press-review";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Newspaper, TrendingUp, ExternalLink } from "lucide-react";

type PressReviewPanelProps = {
  matchId: string;
  playerA: string;
  playerB: string;
  tournament?: string;
  surface?: string;
  className?: string;
};

/**
 * Panneau "Revue de Presse" — affiche 3+ prédictions de la presse tennis
 * spécialisée avec une jauge de consensus en haut.
 *
 * - Barre de consensus colorée (vert = avantage joueur A, violet = joueur B)
 * - 3-5 cartes de sources avec icône, résumé expert et pronostic
 * - Liens vers les articles originaux
 * - Chargement skeleton + état vide masqué (pas de panneau = pas de données)
 */
export function PressReviewPanel({
  matchId,
  playerA,
  playerB,
  tournament,
  surface,
  className,
}: PressReviewPanelProps) {
  const t = useTranslations("editorial");
  const { review, isLoading } = usePressReview(matchId, playerA, playerB, tournament, surface);

  if (isLoading) return <PressReviewSkeleton className={className} />;
  if (!review || review.sources.length < 3) return null;

  const { consensus, sources } = review;

  return (
    <div className={cn("space-y-4 rounded-xl border border-border/60 bg-card/60 p-4", className)}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <Newspaper className="h-4 w-4 text-amber-500" />
        <h3 className="text-sm font-bold text-card-foreground">
          {t("pressReviewTitle") ?? "Revue de Presse"}
        </h3>
        <Badge variant="outline" className="ml-auto text-[10px]">
          {consensus.totalSources} sources
        </Badge>
      </div>

      {/* Consensus Bar */}
      <ConsensusBar consensus={consensus} playerA={playerA} playerB={playerB} />

      {/* Source Cards */}
      <div className="grid gap-3">
        {sources.map((source, i) => (
          <SourceCard
            key={`${source.name}-${i}`}
            source={source}
            playerA={playerA}
            playerB={playerB}
          />
        ))}
      </div>
    </div>
  );
}

/** Jauge de consensus : barre horizontale colorée avec pourcentages. */
function ConsensusBar({
  consensus,
  playerA,
  playerB,
}: {
  consensus: PressConsensus;
  playerA: string;
  playerB: string;
}) {
  const t = useTranslations("editorial");
  const aPct = consensus.playerAPct;
  const bPct = consensus.playerBPct;
  const shortA = extractShortName(playerA);
  const shortB = extractShortName(playerB);

  const label = consensus.favoredPlayer
    ? (t("pressConsensusFavored", { player: extractShortName(consensus.favoredPlayer), pct: String(Math.max(aPct, bPct)) })
       ?? `${Math.max(aPct, bPct)}% des experts prédisent une victoire de ${extractShortName(consensus.favoredPlayer)}`)
    : "Pas de consensus clair";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span className="truncate max-w-[45%]" title={playerA}>{shortA}</span>
        <span className="flex items-center gap-1 font-mono tabular-nums">
          <TrendingUp className="h-3 w-3" />{label}
        </span>
        <span className="truncate max-w-[45%] text-right" title={playerB}>{shortB}</span>
      </div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted/50">
        <div className="h-full bg-gradient-to-r from-sky-500 to-sky-400 transition-all duration-700"
          style={{ width: `${aPct}%` }} />
        {aPct < 100 && bPct < 100 && aPct > 0 && bPct > 0 && (
          <div className="h-full w-px bg-background/50" />
        )}
        <div className="h-full bg-gradient-to-r from-violet-500 to-violet-400 transition-all duration-700"
          style={{ width: `${bPct}%` }} />
      </div>
      <div className="flex justify-between text-[10px] font-mono tabular-nums text-muted-foreground">
        <span>{aPct}%</span><span>{bPct}%</span>
      </div>
    </div>
  );
}

/** Carte d'une source de presse individuelle. */
function SourceCard({
  source,
  playerA,
  playerB,
}: {
  source: PressSource;
  playerA: string;
  playerB: string;
}) {
  const isFavoredA = source.prediction.favoredPlayer === playerA;
  const isFavoredB = source.prediction.favoredPlayer === playerB;
  const hasFavor = isFavoredA || isFavoredB;

  return (
    <div className="rounded-lg border border-border/40 bg-muted/20 p-3 transition-colors hover:bg-muted/30">
      {/* Source header */}
      <div className="mb-2 flex items-center gap-2">
        <span className="text-base leading-none" aria-hidden>{source.icon}</span>
        <span className="text-xs font-semibold text-card-foreground">{source.name}</span>
        {source.prediction.confidence > 0 && (
          <Badge variant="secondary" className={cn(
            "ml-auto text-[10px]",
            source.prediction.confidence >= 70
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : source.prediction.confidence >= 55
                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                : "bg-muted text-muted-foreground",
          )}>
            {source.prediction.confidence}% confiance
          </Badge>
        )}
      </div>

      {/* Expert summary */}
      <p className="mb-2 text-[12px] leading-relaxed text-card-foreground/80">
        {source.expertSummary}
      </p>

      {/* Prediction chip */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-medium text-muted-foreground">Pronostic :</span>
        <span className={cn(
          "rounded-full px-2 py-0.5 text-[11px] font-semibold",
          hasFavor && isFavoredA && "bg-sky-500/10 text-sky-600 dark:text-sky-400",
          hasFavor && isFavoredB && "bg-violet-500/10 text-violet-600 dark:text-violet-400",
          !hasFavor && "bg-muted text-muted-foreground",
        )}>
          {source.prediction.text}
        </span>
        {source.url && (
          <a href={source.url} target="_blank" rel="noopener noreferrer"
            className="ml-auto text-[10px] text-muted-foreground underline decoration-dotted underline-offset-2 hover:text-primary"
            title="Lire l'article complet">
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </div>
  );
}

/** Skeleton de chargement. */
function PressReviewSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-4 rounded-xl border border-border/60 bg-card/60 p-4", className)}>
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-4 rounded" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="ml-auto h-4 w-14" />
      </div>
      <Skeleton className="h-2.5 w-full rounded-full" />
      {[1, 2, 3].map(i => (
        <div key={i} className="rounded-lg border border-border/40 bg-muted/20 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="ml-auto h-4 w-16" />
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-5 w-40 rounded-full" />
        </div>
      ))}
    </div>
  );
}

function extractShortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : fullName;
}