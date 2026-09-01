"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Heart, Users, Trophy, Zap } from "lucide-react";
import { useFollowStore, type FollowEntry } from "@/stores/use-follow-store";
import { usePrematchMatches } from "@/hooks/use-prematch-matches";
import { cn } from "@/lib/utils";

/**
 * Feed personnalisé "Pour toi" — affiche les matchs des équipes/joueurs suivis.
 *
 * Pattern FanDuel "For You" :
 * - Section "Mes joueurs" → matchs contenant un joueur suivi
 * - Section "Mes équipes" → matchs contenant une équipe suivie
 * - Section "Mes ligues" → matchs d'une ligue suivie
 * - Fallback: matchs vedettes du jour si aucun follow
 *
 * La liste est filtrée et priorisée par rapport aux follows de l'utilisateur.
 */

type FeedSection = {
  title: string;
  icon: React.ReactNode;
  items: FeedMatch[];
};

type FeedMatch = {
  id: string;
  label: string;
  time: string;
  sport: string;
  league?: string;
  players?: string[];
  teams?: string[];
  followedBy?: string; // quel follow a matché
};

type Props = {
  className?: string;
  maxItems?: number;
};

export function PersonalizedFeed({ className, maxItems = 20 }: Props) {
  const t = useTranslations("feed");
  const { follows, getByCategory } = useFollowStore();
  const { data } = usePrematchMatches();

  const sections = useMemo<FeedSection[]>(() => {
    const allMatches = data?.matches ?? [];
    const playerFollows = getByCategory("player");
    const teamFollows = getByCategory("team");
    const leagueFollows = getByCategory("league");

    const sections: FeedSection[] = [];

    // Section "Mes joueurs"
    if (playerFollows.length > 0) {
      const playerMatches: FeedMatch[] = [];
      for (const match of allMatches) {
        for (const follow of playerFollows) {
          const playerName = follow.name.toLowerCase();
          const matchPlayers = [
            match.playerA?.name?.toLowerCase(),
            match.playerB?.name?.toLowerCase(),
          ];
          if (matchPlayers.includes(playerName)) {
            playerMatches.push({
              id: match.id,
              label: `${match.playerA?.shortName ?? "?"} vs ${match.playerB?.shortName ?? "?"}`,
              time: match.scheduledAt,
              sport: "tennis",
              league: match.tournament,
              players: [match.playerA?.name, match.playerB?.name].filter(Boolean) as string[],
              followedBy: follow.name,
            });
            break;
          }
        }
      }
      if (playerMatches.length > 0) {
        sections.push({
          title: "Mes joueurs",
          icon: <Users className="h-3.5 w-3.5" />,
          items: playerMatches.slice(0, maxItems),
        });
      }
    }

    // Section "Mes équipes"
    if (teamFollows.length > 0) {
      const teamMatches: FeedMatch[] = [];
      for (const match of allMatches) {
        for (const follow of teamFollows) {
          const teamName = follow.name.toLowerCase();
          const matchTeams = [
            match.playerA?.name?.toLowerCase(),
            match.playerB?.name?.toLowerCase(),
          ];
          if (matchTeams.includes(teamName)) {
            teamMatches.push({
              id: match.id,
              label: `${match.playerA?.shortName ?? "?"} vs ${match.playerB?.shortName ?? "?"}`,
              time: match.scheduledAt,
              sport: "tennis",
              league: match.tournament,
              teams: [match.playerA?.name, match.playerB?.name].filter(Boolean) as string[],
              followedBy: follow.name,
            });
            break;
          }
        }
      }
      if (teamMatches.length > 0) {
        sections.push({
          title: "Mes équipes",
          icon: <Trophy className="h-3.5 w-3.5" />,
          items: teamMatches.slice(0, maxItems),
        });
      }
    }

    // Section "Mes ligues"
    if (leagueFollows.length > 0) {
      const leagueMatches: FeedMatch[] = [];
      for (const match of allMatches) {
        for (const follow of leagueFollows) {
          const leagueSlug = follow.id.replace("league:", "");
          if (match.tournament?.toLowerCase().includes(leagueSlug.replace(/-/g, " "))) {
            leagueMatches.push({
              id: match.id,
              label: `${match.playerA?.shortName ?? "?"} vs ${match.playerB?.shortName ?? "?"}`,
              time: match.scheduledAt,
              sport: "tennis",
              league: match.tournament,
              followedBy: follow.name,
            });
            break;
          }
        }
      }
      if (leagueMatches.length > 0) {
        sections.push({
          title: "Mes ligues",
          icon: <Zap className="h-3.5 w-3.5" />,
          items: leagueMatches.slice(0, maxItems),
        });
      }
    }

    return sections;
  }, [follows, data, getByCategory, maxItems]);

  const totalItems = sections.reduce((acc, s) => acc + s.items.length, 0);
  const hasFollows = Object.keys(follows).length > 0;

  if (!hasFollows) {
    return (
      <div className={cn("rounded-lg border border-dashed border-border/50 p-6 text-center", className)}>
        <Heart className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">
          Suivez vos joueurs, équipes et ligues préférés pour personnaliser votre fil.
        </p>
        <p className="mt-1 text-xs text-muted-foreground/60">
          Cliquez sur le coeur n&apos;importe où pour commencer.
        </p>
      </div>
    );
  }

  if (totalItems === 0) {
    return (
      <div className={cn("rounded-lg border border-border/50 p-4 text-center", className)}>
        <p className="text-sm text-muted-foreground">
          Aucun match trouvé pour vos follows aujourd&apos;hui.
        </p>
        <p className="mt-1 text-xs text-muted-foreground/60">
          Revenez demain — vos équipes jouent peut-être !
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {sections.map((section) => (
        <section key={section.title}>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {section.icon}
            <span>{section.title}</span>
            <span className="ml-auto font-mono text-[10px] text-muted-foreground/60">
              {section.items.length}
            </span>
          </div>

          <div className="space-y-1">
            {section.items.map((match) => (
              <div
                key={match.id}
                className="flex items-center justify-between rounded-md border border-border/30 bg-card/50 px-3 py-2 text-sm transition-colors hover:bg-card hover:border-border/60"
              >
                <div className="flex items-center gap-3">
                  <div className="font-mono text-[10px] tabular-nums text-muted-foreground">
                    {formatTime(match.time)}
                  </div>
                  <div className="font-medium">{match.label}</div>
                </div>

                <div className="flex items-center gap-2">
                  {match.league && (
                    <span className="rounded bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {match.league}
                    </span>
                  )}
                  <span className="text-[10px] text-emerald-500">
                    ★ {match.followedBy}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function formatTime(iso: string): string {
  try {
    const date = new Date(iso);
    return new Intl.DateTimeFormat("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return "?";
  }
}
