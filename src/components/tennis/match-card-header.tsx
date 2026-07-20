"use client";

import { Calendar, Clock, Star, Trophy } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { formatRelativeTime, type TennisMatch } from "@/lib/tennis-data";
import type { LiveMatchState } from "@/hooks/use-live-matches";
import { getDateLocaleTag } from "@/lib/i18n-locales";
import { cn } from "@/lib/utils";
import { SetScoreline } from "./set-scoreline";
import { CurrentGameScore } from "./current-game-score";
import { ServerIndicator } from "./server-indicator";

type Props = {
  match: TennisMatch;
  isLive: boolean;
  liveState?: LiveMatchState;
  isFav: boolean;
  onToggleFavorite: () => void;
};

/**
 * En-tête de la MatchCard.
 *
 * Affiche : tournoi · round · date/heure précise · badge LIVE ·
 * temps relatif · bouton favori (étoile).
 */
export function MatchCardHeader({
  match,
  isLive,
  liveState,
  isFav,
  onToggleFavorite,
}: Props) {
  const t = useTranslations("match");
  const tTime = useTranslations("time");
  const locale = useLocale();

  return (
    <header
      className={cn(
        "flex items-center justify-between",
        "border-b border-border/60 bg-muted/30 px-4 py-2 sm:px-6",
      )}
    >
      {/* Colonne gauche : tournoi + ronde + date */}
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          <Trophy className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{match.tournament}</span>
          <span className="text-border">·</span>
          <span className="shrink-0">{match.round}</span>
        </div>

        {/* Date/heure précise du match */}
        <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground/70">
          <Calendar className="h-3 w-3" />
          <span>
            {new Intl.DateTimeFormat(getDateLocaleTag(locale), {
              weekday: "short",
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            }).format(new Date(match.scheduledAt))}
          </span>
        </div>
      </div>

      {/* Colonne droite : LIVE + timer + favori */}
      <div className="flex shrink-0 items-center gap-2">
        {isLive && (
          <span
            className={cn(
              "flex items-center gap-1 rounded-full bg-rose-600/10 px-2 py-0.5",
              "text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400",
            )}
            aria-label={t("liveAria")}
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-rose-600" />
            </span>
            {t("live")}
          </span>
        )}

        {isLive && liveState ? (
          <LiveHeaderScore match={match} liveState={liveState} />
        ) : (
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>{formatRelativeTime(match.scheduledAt, tTime)}</span>
          </div>
        )}

        <button
          type="button"
          onClick={onToggleFavorite}
          aria-label={isFav ? t("removeFavorite") : t("addFavorite")}
          aria-pressed={isFav}
          className={cn(
            "rounded-md p-1 transition-colors hover:bg-muted",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          <Star
            className={cn(
              "h-3.5 w-3.5 transition-colors",
              isFav
                ? "fill-amber-400 text-amber-400"
                : "text-muted-foreground hover:text-foreground",
            )}
          />
        </button>
      </div>
    </header>
  );
}

/**
 * Live score cluster rendered inside the header when the match is live.
 *
 * Stacks the three new score components — {@link SetScoreline},
 * {@link CurrentGameScore}, {@link ServerIndicator} — replacing the old
 * "Set N" placeholder so the header carries the actual match state
 * (`6-4 6-3 3-2 · 30-15 · Sinner serving`) instead of just the set index.
 *
 * Kept in this file (not exported) because the layout is specific to the
 * header's right column; the three child components stay reusable elsewhere.
 */
function LiveHeaderScore({
  match,
  liveState,
}: {
  match: TennisMatch;
  liveState: LiveMatchState;
}) {
  const serverName =
    liveState.server === "A" ? match.playerA.name : match.playerB.name;

  return (
    <div className="flex flex-col items-end gap-0.5">
      <div className="flex items-center gap-1.5">
        <SetScoreline
          scoreA={liveState.scoreA}
          scoreB={liveState.scoreB}
        />
        <span className="text-border" aria-hidden>·</span>
        <CurrentGameScore
          pointsA={liveState.scoreA.points}
          pointsB={liveState.scoreB.points}
        />
      </div>
      <ServerIndicator server={liveState.server} serverName={serverName} />
    </div>
  );
}
