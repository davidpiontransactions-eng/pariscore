"use client";

import { Clapperboard, ExternalLink, Loader2 } from "lucide-react";
import type { TennisHighlight } from "@/lib/scraping/tennistv-highlights-service";
import { cn } from "@/lib/utils";

type PlayerVideo = {
  playerName: string;
  highlight: TennisHighlight | null;
};

type Props = {
  /** Vidéo H2H directe (optionnelle — prioritaire si présente). */
  h2h?: TennisHighlight | null;
  /** Une vidéo par joueur du duel. */
  players: [PlayerVideo, PlayerVideo] | PlayerVideo[];
  /** Nom du tournoi (fallback générique) — optionnel. */
  tournamentHighlight?: TennisHighlight | null;
  isLoading?: boolean;
  className?: string;
};

/**
 * LastMatchHighlightsWidget — deux mini-lecteurs YouTube embarqués pour le
 * dernier match joué (H2H direct prioritaire, sinon une vidéo par joueur,
 * sinon vidéo générique du tournoi).
 *
 * Sécurité : iframe en mode youtube-nocookie, sandbox minimale, pas de
 * scripts arbitraires — `allow` restreint aux capacités lecture vidéo.
 */
export function LastMatchHighlightsWidget({
  h2h,
  players,
  tournamentHighlight,
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
        Recherche des highlights du dernier match…
      </div>
    );
  }

  // Sélection des vidéos à afficher : H2H direct > 2 vidéos joueurs > tournoi.
  const videos: { playerName: string; highlight: TennisHighlight }[] = [];
  if (h2h) {
    videos.push({ playerName: "Face-à-face", highlight: h2h });
  } else {
    for (const p of players) {
      if (p.highlight) videos.push({ playerName: p.playerName, highlight: p.highlight });
    }
  }
  if (videos.length === 0 && tournamentHighlight) {
    videos.push({ playerName: "Tournoi", highlight: tournamentHighlight });
  }

  if (videos.length === 0) return null;

  return (
    <div className={cn("space-y-2", className)}>
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Clapperboard className="h-3.5 w-3.5" aria-hidden />
        Highlights du dernier match
      </p>
      <div
        className={cn(
          "grid gap-2",
          videos.length > 1 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1",
        )}
      >
        {videos.map((v, i) => (
          <figure
            key={v.highlight.videoId}
            className="group overflow-hidden rounded-lg border border-border/60 bg-black"
          >
            <div className="aspect-video">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${v.highlight.videoId}`}
                title={`Highlights ${v.playerName} : ${v.highlight.title}`}
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                className="h-full w-full"
              />
            </div>
            <figcaption className="flex items-center justify-between gap-2 px-2.5 py-1.5">
              <span className="truncate text-[11px] font-medium text-foreground/80">
                {v.playerName === "Face-à-face" || v.playerName === "Tournoi"
                  ? v.highlight.title
                  : `${v.playerName} — ${v.highlight.title}`}
              </span>
              <a
                href={v.highlight.url}
                target="_blank"
                rel="noopener noreferrer"
                title="Ouvrir sur YouTube"
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