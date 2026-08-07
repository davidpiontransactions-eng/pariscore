"use client";

import { Clapperboard, ExternalLink, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type PreviousRoundPlayerProps = {
  playerName: string;
  label: "tour-precedent" | "dernier-match";
  context: {
    round: string | null;
    tournament: string | null;
    surface: string | null;
    opponent: string | null;
    won: boolean | null;
    score: string | null;
  };
  video: { videoId: string; title: string; url: string } | null;
};

type Props = {
  players: PreviousRoundPlayerProps[];
  tourPreviousLabel: string;
  lastMatchLabel: string;
  opponentTemplate: string; // "vs {opp}"
  loadingLabel: string;
  openYoutubeLabel?: string;
  isLoading?: boolean;
  className?: string;
};

/**
 * PreviousRoundHighlightsWidget — deux sous-cartes vidéo YouTube (16/9) pour
 * le tour précédent de chaque joueur d'un duel tennis. Se monte uniquement
 * si au moins une vidéo est disponible ; jamais d'erreur UI.
 *
 * Sécurité : iframe youtube-nocookie, allow restreint aux capacités lecture.
 */
export function PreviousRoundHighlightsWidget({
  players,
  tourPreviousLabel,
  lastMatchLabel,
  opponentTemplate,
  loadingLabel,
  openYoutubeLabel = "Ouvrir sur YouTube",
  isLoading = false,
  className,
}: Props) {
  if (isLoading) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-4 py-3 text-xs text-muted-foreground",
          className,
        )}
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        {loadingLabel}
      </div>
    );
  }

  const withVideo = players.filter((p) => p.video);
  if (withVideo.length === 0) return null;

  return (
    <div className={cn("space-y-2", className)}>
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Clapperboard className="h-3.5 w-3.5" aria-hidden />
        {tourPreviousLabel} · {lastMatchLabel}
      </p>
      <div
        className={cn(
          "grid gap-2",
          withVideo.length > 1 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1",
        )}
      >
        {withVideo.map((p) => (
          <figure
            key={p.video!.videoId}
            className="group overflow-hidden rounded-lg border border-border/60 bg-black"
          >
            <div className="aspect-video">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${p.video!.videoId}`}
                title={`${p.playerName} : ${p.video!.title}`}
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                className="h-full w-full"
              />
            </div>
            <figcaption className="flex items-center justify-between gap-2 px-2.5 py-1.5">
              <span className="truncate text-[10px] font-medium text-foreground/80">
                {p.label === "tour-precedent" ? tourPreviousLabel : lastMatchLabel}
                {p.context.opponent
                  ? ` (${opponentTemplate.replace("{opp}", p.context.opponent)})`
                  : ""}
                {p.context.score ? ` — ${p.context.score}` : ""}
              </span>
              <a
                href={p.video!.url}
                target="_blank"
                rel="noopener noreferrer"
                title={openYoutubeLabel}
                className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
              >
                <ExternalLink className="h-3 w-3" aria-hidden />
              </a>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}