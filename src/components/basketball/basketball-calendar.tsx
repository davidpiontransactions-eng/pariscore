"use client";

/**
 * BasketballCalendar — vue « Calendrier » de l'onglet Basket (mix Flashscore/FotMob).
 * CalendarDateNav (light) en haut + FotmobFilterBar (sans datepicker dupliqué,
 * sans toggle Top) + FotmobCalendarTable (lignes groupées par ligue, ★, PowerScore).
 * Données : /api/basketball/calendar (NBA + WNBA + EuroLeague + EuroCup + FIBA).
 */

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import { CalendarDateNav, parisDateKey } from "@/components/football/calendar-date-nav";
import { FotmobFilterBar } from "@/components/football/fotmob-filter-bar";
import { FotmobCalendarTable, type FotmobCalMatch } from "@/components/football/fotmob-calendar-table";
import { filterByKickoffWindow } from "@/lib/fotmob-filter";
import { isCalLiveStatus } from "@/lib/basketball-calendar";
import { useBasketballCalendar } from "@/hooks/use-basketball-calendar";
import type { BasketballMatch } from "@/hooks/use-basketball-matches";

const BasketballMatchDetailDialog = dynamic(
  () => import("./basketball-match-detail-dialog").then((m) => m.BasketballMatchDetailDialog),
  { ssr: false },
);

/** Popup pré-match (cache BSD) — chargé à la demande, jamais au premier render. */
const BasketballPreMatchPopup = dynamic(
  () => import("./basketball-prematch-popup").then((m) => m.BasketballPreMatchPopup),
  { ssr: false },
);

/**
 * FotmobCalMatch → BasketballMatch partiel pour le dialog détail.
 * Même élargissement que le handler open-match-detail (cast matchs euro) :
 * le dialog gère les champs absents (guards existants).
 */
function toDetailMatch(m: FotmobCalMatch): BasketballMatch {
  const status = m.live ? (isCalLiveStatus(m.live.status) ? "in-progress" : m.live.status === "FT" ? "post" : "pre") : "pre";
  return {
    id: m.id,
    sport: "basketball",
    league: (m.league?.name ?? "NBA") as BasketballMatch["league"],
    scheduledAt: m.scheduledAt,
    status,
    home: { id: "", abbr: m.home.name.slice(0, 3).toUpperCase(), name: m.home.name, score: m.live?.homeScore ?? null, record: null },
    away: { id: "", abbr: m.away.name.slice(0, 3).toUpperCase(), name: m.away.name, score: m.live?.awayScore ?? null, record: null },
    pHome: null,
    pAway: null,
    edgeElo: null,
  } as unknown as BasketballMatch;
}

function CalendarSkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-busy="true">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-32 animate-pulse rounded-2xl bg-white/[0.04]" />
      ))}
    </div>
  );
}

export function BasketballCalendar({ className }: { className?: string }) {
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const dateKey = parisDateKey(selectedDate);
  const todayKey = parisDateKey(new Date());
  const { matches, isLoading } = useBasketballCalendar(dateKey);

  // Filtres barre FotMob (mêmes sémantiques que le calendrier foot)
  const [liveOnly, setLiveOnly] = useState(false);
  const [hours, setHours] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState<FotmobCalMatch | null>(null);
  /**
   * Équipe dont on a cliqué le nom → popup pré-match.
   * `onTeamClick` ne remonte QUE l'équipe et son lieu, jamais la rencontre :
   * la fixture est résolue depuis le cache par `findBsdFixtureByTeam`
   * (ambiguïté = refus, donc popup qui ne s'ouvre pas plutôt que le mauvais).
   */
  const [prematchTeam, setPrematchTeam] = useState<string | null>(null);

  const shiftDay = (delta: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + delta);
    setSelectedDate(d);
  };

  const filtered = useMemo(() => {
    let out = matches;
    if (liveOnly) out = out.filter((m) => isCalLiveStatus(m.live?.status));
    out = filterByKickoffWindow(out, hours);
    const q = query.trim().toLowerCase();
    if (q) {
      out = out.filter((m) => m.home.name.toLowerCase().includes(q) || m.away.name.toLowerCase().includes(q));
    }
    return out;
  }, [matches, liveOnly, hours, query]);

  const liveCount = filtered.filter((m) => isCalLiveStatus(m.live?.status)).length;
  const inWindowCount = hours != null ? filtered.length : undefined;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <CalendarDateNav selectedDate={selectedDate} onSelect={setSelectedDate} variant="light" />

      <FotmobFilterBar
        dateKey={dateKey}
        todayKey={todayKey}
        onPrevDay={() => shiftDay(-1)}
        onNextDay={() => shiftDay(1)}
        onPickDate={(k) => setSelectedDate(new Date(`${k}T12:00:00`))}
        hideDatePicker
        liveOnly={liveOnly}
        onToggleLive={() => setLiveOnly((v) => !v)}
        hours={hours}
        onHours={setHours}
        count={inWindowCount ?? liveCount}
        query={query}
        onQuery={setQuery}
        topOnly={false}
        onToggleTop={() => {}}
        hideTop
      />

      {isLoading && matches.length === 0 ? (
        <CalendarSkeleton />
      ) : (
        <FotmobCalendarTable
          matches={filtered}
          onSelectMatch={setDetail}
          onTeamClick={(team) => setPrematchTeam(team.name)}
        />
      )}

      {/* Pré-match 1xBet : cotes (haut) + forme/classement (bas), depuis le
          cache local — donc aucun spinner. Les ligues non couvertes par le cron
          affichent l'absence, jamais une valeur par défaut. */}
      <BasketballPreMatchPopup
        open={prematchTeam !== null}
        onOpenChange={(open) => {
          if (!open) setPrematchTeam(null);
        }}
        leagueBsdId={null}
        homeName={null}
        awayName={null}
        teamName={prematchTeam}
        title={prematchTeam ? `${prematchTeam} — pré-match` : undefined}
      />

      {detail && (
        <BasketballMatchDetailDialog
          match={toDetailMatch(detail)}
          open
          onOpenChange={(open) => {
            if (!open) setDetail(null);
          }}
        />
      )}
    </div>
  );
}
