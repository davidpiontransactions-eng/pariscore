"use client";

import { useMemo } from "react";
import { Sparkles } from "lucide-react";
import type { FootballMatch } from "@/lib/football-data";
import { parisKickoff, parisDayLabel, parisDayLong } from "@/lib/football-time";
import { FootballMatchCard } from "./football-match-card";
import { pickScore, STRONG_PICK_THRESHOLD } from "@/lib/football-pick-utils";
import { getFlagEmoji } from "@/lib/flag-utils";

/** Libellé « weekend » / « aujourd'hui » dérivé de la date du match. */
function dayLabel(iso: string): string {
  const short = parisDayLabel(iso);
  if (short === "Aujourd'hui" || short === "Demain") return short;
  return parisDayLong(iso);
}

/** Clé de regroupement : par ligue + journée (round) ou par jour si pas de round. */
function groupKey(m: FootballMatch): string {
  return `${m.league.id}::${m.round || m.scheduledAt.slice(0, 10)}`;
}

/** Vrai si le match porte au moins un pick fort (≥ seuil). */
function isStrong(m: FootballMatch): boolean {
  return pickScore(m) >= STRONG_PICK_THRESHOLD;
}

type RoundGroup = {
  key: string;
  leagueName: string;
  leagueLogo: string;
  countryCode: string;
  round: string;
  day: string;
  matches: FootballMatch[];
};

function groupByRound(matches: FootballMatch[]): RoundGroup[] {
  const groups = new Map<string, RoundGroup>();
  for (const m of matches) {
    const key = groupKey(m);
    let g = groups.get(key);
    if (!g) {
      g = {
        key,
        leagueName: m.league.name,
        leagueLogo: m.league.logo,
        countryCode: m.league.countryCode,
        round: m.round || "Matchs",
        day: dayLabel(m.scheduledAt),
        matches: [],
      };
      groups.set(key, g);
    }
    g.matches.push(m);
  }
  const list = Array.from(groups.values());
  for (const g of list) {
    g.matches.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  }
  list.sort((a, b) => new Date(a.matches[0].scheduledAt).getTime() - new Date(b.matches[0].scheduledAt).getTime());
  return list;
}

/**
 * « Journée X » — regroupe les matchs par ligue + journée avec un en-tête
 * de section (count, picks forts) et un « Match du jour » mis en avant par
 * groupe (anneau emerald). Le pick le plus fort du groupe (exclu du Banker
 * global) porte l'anneau.
 */
export function FootballRoundGroups({
  matches,
  onOpenDetail,
}: {
  matches: FootballMatch[];
  onOpenDetail?: (m: FootballMatch) => void;
}) {
  const groups = useMemo(() => groupByRound(matches), [matches]);

  return (
    <div className="space-y-8">
      {groups.map((g) => {
        const strongCount = g.matches.filter(isStrong).length;
        // Index du « Match du jour » : pick le plus fort du groupe.
        let featuredIdx = -1;
        let featuredScore = -1;
        g.matches.forEach((m, i) => {
          const s = pickScore(m);
          if (s > featuredScore) {
            featuredScore = s;
            featuredIdx = i;
          }
        });
        const showFeatured = featuredIdx >= 0 && featuredScore >= STRONG_PICK_THRESHOLD;

        return (
          <section key={g.key} aria-label={`${g.leagueName} — ${g.round}`}>
            {/* En-tête de journée */}
            <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="inline-flex h-5 w-7 items-center justify-center overflow-hidden rounded-sm" aria-hidden>
                {g.leagueLogo && g.leagueLogo.length <= 8 ? (
                  <span className="text-sm leading-none">{g.leagueLogo}</span>
                ) : (
                  <span className="text-sm leading-none">{getFlagEmoji(g.countryCode)}</span>
                )}
              </span>
              <span className="text-sm font-bold text-foreground">{g.leagueName}</span>
              <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {g.round}
              </span>
              <span className="text-[11px] capitalize text-muted-foreground">· {g.day}</span>
              <span className="ml-auto text-[11px] font-medium tabular-nums text-muted-foreground">
                {g.matches.length} match{g.matches.length > 1 ? "s" : ""}
                {strongCount > 0 && (
                  <span className="ml-1.5 inline-flex items-center gap-0.5 text-emerald-400">🔥 {strongCount}</span>
                )}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              {g.matches.map((m, idx) =>
                idx === featuredIdx && showFeatured ? (
                  <div key={m.id} className="relative rounded-2xl ring-2 ring-emerald-500/60 ring-offset-2 ring-offset-background">
                    <span className="absolute -top-3 left-3 z-10 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white shadow-sm dark:bg-emerald-500">
                      <Sparkles className="h-2.5 w-2.5" aria-hidden />
                      Match du jour
                    </span>
                    <FootballMatchCard match={m} priority={idx === 0} onOpenDetail={onOpenDetail} />
                  </div>
                ) : (
                  <FootballMatchCard key={m.id} match={m} priority={idx === 0} onOpenDetail={onOpenDetail} />
                ),
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}