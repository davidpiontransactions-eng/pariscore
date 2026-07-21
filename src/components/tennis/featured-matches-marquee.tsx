"use client";

import { useTranslations } from "next-intl";
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext } from "@/components/ui/carousel";
import { MatchCardBroadcast } from "./match-card-broadcast";
import type { TennisMatch } from "@/lib/tennis-data";
import type { LiveMatchState } from "@/hooks/use-live-matches";
import type { WeeklyMarqueeConfig } from "@/lib/weekly-marquee";
import { cn } from "@/lib/utils";

type Props = {
  /** Matchs phares de la semaine (déjà triés). */
  featured: TennisMatch[];
  /** Config marquee (pour le titre de section). */
  marquee: WeeklyMarqueeConfig;
  /** Live states (pour overlay live sur les cartes). */
  liveStates?: Record<string, LiveMatchState>;
  /** Si true, pas de section rendue. */
  hasFeatured: boolean;
  onOpenDetail?: (match: TennisMatch) => void;
  onBetClick?: (match: TennisMatch) => void;
  className?: string;
};

/**
 * Section "À la une" — carrousel horizontal des tournois phares de la
 * semaine (R8 curation). Réutilise `<MatchCardBroadcast>` tel quel avec
 * un `ring-amber-400/60` distinctif. Responsive :
 *   - Mobile 375px : 1 carte + peek 20%
 *   - Desktop : 2.5 cartes visibles
 *
 * Disparaît complètement si `hasFeatured = false` (semaine sans marquee).
 */
export function FeaturedMatchesMarquee({
  featured,
  marquee,
  liveStates,
  hasFeatured,
  onOpenDetail,
  onBetClick,
  className,
}: Props) {
  const t = useTranslations("tennis");

  if (!hasFeatured || featured.length === 0) return null;

  // Noms de tournois uniques pour le sous-titre (max 3, séparés par ·)
  const subtitleTournaments = marquee.tournamentNames
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 3)
    .join(" · ");

  return (
    <section
      className={cn(
        "mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6",
        className,
      )}
      aria-label={t("featuredTitle")}
    >
      {/* Titre de section */}
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.1em] text-amber-500 dark:text-amber-400">
            <span aria-hidden>⭐</span>
            {t("featuredTitle")}
          </h2>
          {subtitleTournaments && (
            <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">
              {subtitleTournaments}
            </p>
          )}
        </div>
        {marquee.weekNumber > 0 && (
          <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            {t("weekLabel", { n: marquee.weekNumber })}
          </span>
        )}
      </div>

      {/* Carrousel horizontal */}
      <Carousel
        opts={{
          align: "start",
          loop: false,
        }}
        className="w-full"
      >
        <CarouselContent className="-ml-3">
          {featured.map((match, idx) => (
            <CarouselItem
              key={match.id}
              className="basis-[85%] pl-3 sm:basis-1/2 lg:basis-1/3"
            >
              {/* Ring doré distinctif pour les matchs featured */}
              <div className="rounded-2xl ring-2 ring-amber-400/60 ring-offset-2 ring-offset-background">
                <MatchCardBroadcast
                  match={match}
                  liveState={liveStates?.[match.id]}
                  onOpenDetail={onOpenDetail ? () => onOpenDetail(match) : undefined}
                  onBetClick={onBetClick ? () => onBetClick(match) : undefined}
                  priority={idx < 2}
                />
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="hidden sm:flex" />
        <CarouselNext className="hidden sm:flex" />
      </Carousel>
    </section>
  );
}
