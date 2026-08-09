"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { FootballMatch, League } from "@/lib/football-data";
import { getFlagUrl, getFlagEmoji } from "@/lib/flag-utils";

export function FootballLeagueBar({
  matches,
  selectedLeague,
  onSelectLeague,
}: {
  matches: FootballMatch[];
  selectedLeague: string | null;
  onSelectLeague: (id: string | null) => void;
}) {
  const leagues = useMemo(() => {
    const map = new Map<string, League & { count: number }>();
    for (const m of matches) {
      const existing = map.get(m.league.id);
      if (existing) {
        existing.count++;
      } else {
        map.set(m.league.id, { ...m.league, count: 1 });
      }
    }
    return Array.from(map.values());
  }, [matches]);

  if (leagues.length === 0) return null;

  return (
    <div className="flex flex-nowrap gap-1.5 overflow-x-auto scrollbar-none pb-1">
      <button
        onClick={() => onSelectLeague(null)}
        className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
          selectedLeague === null
            ? "border-foreground bg-foreground text-background"
            : "border-border bg-background text-muted-foreground hover:text-foreground"
        }`}
      >
        <span className="text-sm" aria-hidden="true">🌍</span>
        Tous ({matches.length})
      </button>
      {leagues.map((l) => (
        <span key={l.id} className="inline-flex shrink-0 items-center gap-0.5">
          <button
            onClick={() => onSelectLeague(l.id)}
            className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
              selectedLeague === l.id
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-background text-muted-foreground hover:text-foreground"
            }`}
          >
            <img
              src={getFlagUrl(l.countryCode, 24, 18)}
              alt={l.country}
              className="h-[13px] w-[18px] shrink-0 rounded-sm object-cover"
              loading="lazy"
              onError={(e) => {
                // Fallback emoji natif si CDN down
                e.currentTarget.replaceWith(
                  Object.assign(document.createElement("span"), {
                    textContent: getFlagEmoji(l.countryCode),
                    className: "text-sm leading-none",
                    ariaHidden: "true",
                  }),
                );
              }}
            />
            <span className="max-w-[10rem] truncate" title={l.name}>
              {l.name}
            </span>
            <span className="text-muted-foreground/80">({l.count})</span>
          </button>
          <Link
            href={`/league/${l.id}/stats`}
            className="rounded-full border border-border bg-background px-1.5 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
            title="Statistiques du championnat"
          >
            📊
          </Link>
        </span>
      ))}
    </div>
  );
}
