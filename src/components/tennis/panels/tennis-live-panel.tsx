"use client";

import { Radio, Trophy } from "lucide-react";
import { MatchCardBroadcast } from "@/components/tennis/match-card-broadcast";
import { FeaturedMatchesMarquee } from "@/components/tennis/featured-matches-marquee";
import { Skeleton } from "@/components/ui/skeleton";
import type { TennisMatch } from "@/lib/tennis-data";
import type { LiveMatchState } from "@/hooks/use-live-matches";
import type { LiveResolvedOdds } from "@/hooks/use-onex-live-odds";
import type { WeeklyMarqueeConfig } from "@/lib/weekly-marquee";

type Props = {
  /** Matchs live dédupliqués (grille principale). */
  matches: TennisMatch[];
  /** Matchs « à la une » également live (carrousel horizontal). */
  featured: TennisMatch[];
  marquee: WeeklyMarqueeConfig;
  liveStates: Record<string, LiveMatchState>;
  liveOdds: Record<string, LiveResolvedOdds>;
  /** true = flux live coupé (badge sur les cartes). */
  disconnected: boolean;
  isLoading: boolean;
  onOpenDetail: (match: TennisMatch) => void;
  onBetClick: (match: TennisMatch) => void;
};

/** Wrapper stabilisé : évite de re-rendre chaque carte à chaque push SSE. */
function LiveCard({
  match,
  liveState,
  liveOdds,
  disconnected,
  onOpenDetail,
  onBetClick,
  priority,
}: {
  match: TennisMatch;
  liveState?: LiveMatchState;
  liveOdds: LiveResolvedOdds | null;
  disconnected: boolean;
  onOpenDetail: (m: TennisMatch) => void;
  onBetClick: (m: TennisMatch) => void;
  priority: boolean;
}) {
  return (
    <MatchCardBroadcast
      match={match}
      liveState={liveState}
      liveOdds={liveOdds}
      disconnected={disconnected}
      onOpenDetail={() => onOpenDetail(match)}
      onBetClick={() => onBetClick(match)}
      priority={priority}
    />
  );
}

/**
 * Panneau « Live » — cartes live des matchs en cours.
 *
 * Isolé du `TennisTabContent` : la grille, le carrousel « à la une » et le
 * badge de flux coupé n'existent que dans ce panneau. Receit ses données
 * déjà filtrées (le parent garde les filtres sidebar + fenêtre horaire, seule
 * règle qui s'applique à tous les sous-onglets).
 */
export function TennisLivePanel({
  matches,
  featured,
  marquee,
  liveStates,
  liveOdds,
  disconnected,
  isLoading,
  onOpenDetail,
  onBetClick,
}: Props) {
  if (isLoading) {
    return (
      <div
        className="grid grid-cols-1 gap-5 lg:grid-cols-2"
        role="status"
        aria-live="polite"
      >
        <span className="sr-only">Chargement des matchs live…</span>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-80 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (matches.length === 0 && featured.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Radio className="h-5 w-5 text-muted-foreground" aria-hidden />
        </div>
        <p className="text-sm font-medium">Aucun match en direct</p>
        <p className="max-w-md text-xs text-muted-foreground">
          Aucun match n&apos;est actuellement en cours sur les tournois sélectionnés.
          La liste se remplit automatiquement dès le prochain point.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <FeaturedMatchesMarquee
        featured={featured}
        marquee={marquee}
        liveStates={liveStates}
        hasFeatured={featured.length > 0}
        onOpenDetail={onOpenDetail}
        onBetClick={onBetClick}
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {matches.map((match, idx) => (
          <LiveCard
            key={match.id}
            match={match}
            liveState={liveStates[match.id]}
            liveOdds={liveOdds[match.id] ?? null}
            disconnected={disconnected}
            onOpenDetail={onOpenDetail}
            onBetClick={onBetClick}
            priority={idx < 2}
          />
        ))}
      </div>

      {matches.length === 0 && featured.length > 0 && (
        <p className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
          <Trophy className="h-3.5 w-3.5" aria-hidden />
          Tous les matchs en direct sont dans le carrousel ci-dessus.
        </p>
      )}
    </div>
  );
}