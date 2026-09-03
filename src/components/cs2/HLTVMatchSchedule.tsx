"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { Clock, Map as MapIcon, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { hltvStars, type Cs2Match } from "@/lib/cs2/types";
import { displayTeamName } from "@/lib/cs2/format";
import { TeamLogoImage } from "./TeamLogoImage";

type Props = {
  matches: Cs2Match[];
  onSelectMatch: (match: Cs2Match) => void;
};

const DAY_FMT = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const TIME_FMT = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
});

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function dateHeaderLabel(iso: string): string {
  return capitalize(DAY_FMT.format(new Date(iso)));
}

/** Importance du match (1-5) = prestige max des deux structures. */
function matchStars(match: Cs2Match): number {
  return Math.max(hltvStars(match.team1.hltv_rank), hltvStars(match.team2.hltv_rank));
}

function StarRating({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="inline-flex items-center gap-0.5" title={`Importance ${count}/5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cn(
            "h-3 w-3",
            i <= count ? "fill-amber-400 text-amber-400" : "text-zinc-700",
          )}
        />
      ))}
    </span>
  );
}

function MatchRow({ match, index, onSelect }: { match: Cs2Match; index: number; onSelect: () => void }) {
  const isLive = match.is_live || match.status === "live";
  const stars = matchStars(match);
  const t1Name = displayTeamName(match.team1.name);
  const t2Name = displayTeamName(match.team2.name);

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="group flex w-full items-center gap-3 rounded-xl border border-white/10 bg-[#1A1A2E]/60 px-4 py-3 text-left transition-all hover:border-[#00E676]/30 hover:bg-[#1A1A2E]"
    >
      {/* Événement / tournoi */}
      <div className="hidden w-40 shrink-0 items-center gap-2 sm:flex">
        {match.tournament_logo ? (
          <img src={match.tournament_logo} alt="" className="h-5 w-5 object-contain" loading="lazy" />
        ) : null}
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-zinc-300">{match.tournament ?? "CS2"}</p>
          {match.is_lan && <p className="text-[11px] uppercase tracking-wide text-zinc-600">LAN</p>}
        </div>
      </div>

      {/* Importance (star rating) */}
      <div className="hidden w-24 shrink-0 justify-start md:flex">
        <StarRating count={stars} />
      </div>

      {/* Horaire + format (pastille 24h à gauche du badge BO, visible mobile) */}
      <div className="w-24 shrink-0">
        {isLive ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#00E676]/10 px-2 py-0.5 text-[11px] font-bold text-[#00E676]">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full scale-150 animate-pulse-soft rounded-full bg-[#00E676] opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#00E676]" />
            </span>
            LIVE
          </span>
        ) : (
          <div className="flex flex-col items-start gap-0.5">
            <span className="flex items-center gap-1 text-xs font-medium tabular-nums text-zinc-300">
              <Clock className="h-3 w-3 text-zinc-400" />
              {match.scheduled ? TIME_FMT.format(new Date(match.scheduled)) : "—"}
            </span>
            {match.best_of ? (
              <span className="inline-flex rounded bg-white/5 px-1.5 py-0.5 text-[11px] font-semibold text-zinc-400">
                BO{match.best_of}
              </span>
            ) : null}
          </div>
        )}
      </div>

      {/* Équipe 1 */}
      <div className="flex flex-1 items-center justify-end gap-2">
        <div className="min-w-0 text-right">
          <p className="truncate text-sm font-semibold text-white">{t1Name}</p>
          {match.team1.hltv_rank ? (
            <p className="text-[11px] text-zinc-600">#{match.team1.hltv_rank}</p>
          ) : null}
        </div>
        <TeamLogoImage
          name={match.team1.name}
          logo={match.team1.logo}
          logo_local={match.team1.logo_local}
          country={match.team1.country}
        />
      </div>

      {/* Score / VS */}
      <div className="w-16 shrink-0 text-center">
        {isLive &&
        match.maps_score &&
        (match.maps_score.team1 != null || match.maps_score.team2 != null) ? (
          <>
            <span className="sr-only" role="status" aria-atomic="true">
              Score live — {t1Name} {match.maps_score.team1 ?? "?"} à{" "}
              {match.maps_score.team2 ?? "?"} {t2Name}
            </span>
            <span
              aria-hidden="true"
              className="font-mono text-base font-bold tabular-nums text-[#00E676]"
            >
              {match.maps_score.team1 ?? "–"}–{match.maps_score.team2 ?? "–"}
            </span>
          </>
        ) : (
          <span className="text-xs font-bold text-zinc-600">VS</span>
        )}
      </div>

      {/* Équipe 2 */}
      <div className="flex flex-1 items-center gap-2">
        <TeamLogoImage
          name={match.team2.name}
          logo={match.team2.logo}
          logo_local={match.team2.logo_local}
          country={match.team2.country}
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{t2Name}</p>
          {match.team2.hltv_rank ? (
            <p className="text-[11px] text-zinc-600">#{match.team2.hltv_rank}</p>
          ) : null}
        </div>
      </div>

      {/* Carte courante (live) */}
      {isLive && match.current_map && (
        <span className="hidden items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-zinc-400 lg:inline-flex">
          <MapIcon className="h-2.5 w-2.5" />
          {match.current_map}
        </span>
      )}
    </motion.button>
  );
}

export function HLTVMatchSchedule({ matches, onSelectMatch }: Props) {
  const groups = useMemo(() => {
    const byDate = new Map<string, Cs2Match[]>();
    for (const m of matches) {
      const key = m.scheduled ? new Date(m.scheduled).toDateString() : "date-inconnue";
      const arr = byDate.get(key) ?? [];
      arr.push(m);
      byDate.set(key, arr);
    }
    return [...byDate.entries()].sort(([a], [b]) => {
      const ta = a === "date-inconnue" ? Infinity : new Date(a).getTime();
      const tb = b === "date-inconnue" ? Infinity : new Date(b).getTime();
      return ta - tb;
    });
  }, [matches]);

  if (matches.length === 0) return null;

  return (
    <div className="space-y-6">
      {groups.map(([dateKey, list]) => (
        <section key={dateKey}>
          <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-zinc-400">
            {dateKey === "date-inconnue" ? "Matchs du Jour" : dateHeaderLabel(dateKey)}
          </h2>
          <div className="space-y-1.5">
            {list.map((m, i) => (
              <MatchRow key={m.id} match={m} index={i} onSelect={() => onSelectMatch(m)} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
