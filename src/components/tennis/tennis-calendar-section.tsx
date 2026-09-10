"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { MatchDetailDialog } from "@/components/tennis/match-detail-dialog";
import {
  FotmobCalendarTable,
  type FotmobCalMatch,
  type TopStratTag,
} from "@/components/football/fotmob-calendar-table";
import { FotmobFilterBar } from "@/components/football/fotmob-filter-bar";
import { countryFlag } from "@/lib/bsd-football-fetcher";
import {
  parisTodayKey,
  shiftDateKey,
  filterByKickoffWindow,
} from "@/lib/fotmob-filter";
import { useLiveMatches } from "@/hooks/use-live-matches";
import { resolvePlayerPhoto } from "@/lib/player-photos";
import type { TennisMatch } from "@/lib/tennis-data";
import {
  TENNIS_STRATEGY_DEFS,
  type TennisCalendarMatch,
  type TennisStrategyEntry,
  type TennisStrategyKey,
} from "@/lib/tennis-strategy-top10";

/* Teintes FotMob clair — identiques au calendrier foot */
const C = {
  card: "#ffffff",
  cardBorder: "#f0f0f0",
  headerText: "#000000",
  time: "#717171",
  accent: "#00985f",
} as const;

/* Libellés courts des pills Top (pastilles sous les noms, comme le foot) */
const STRAT_SHORT: Record<TennisStrategyKey, string> = {
  surfaceEloGap: "Élo surface",
  momentum: "Momentum",
  serveHold: "Service",
  returnEfficacy: "Retour",
  fatigue: "Fatigue",
  underdogValue: "Value",
  over215: "Over 21,5",
  under215: "Under 21,5",
  favorite20: "Favori 2-0",
};

/** Normalise un id BSD (`bsd-12` ↔ `12`) pour les jointures. */
const normId = (id: string) => id.replace(/^bsd-/, "");

/** Couleur déterministe (même pattern que les cartes live synthétiques). */
function hashColor(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return `hsl(${Math.abs(h) % 360}, 60%, 40%)`;
}

/** Mappe un match prematch vers le format calendrier (drapeau pays). */
function toCalMatch(m: TennisCalendarMatch): FotmobCalMatch {
  return {
    id: m.matchId,
    scheduledAt: m.scheduledAt,
    home: {
      name: m.playerA.shortName || m.playerA.name,
      logo: m.playerA.country ? countryFlag(m.playerA.country) : null,
    },
    away: {
      name: m.playerB.shortName || m.playerB.name,
      logo: m.playerB.country ? countryFlag(m.playerB.country) : null,
    },
    league: { name: m.tournament || "Tournoi", country: null, logo: null },
    round: m.round || null,
    live: null,
    power: { home: m.powerA, away: m.powerB },
  };
}

/** Clé jour Paris (YYYY-MM-DD) d'un ISO — "" si invalide. */
function parisDateKey(iso: string): string {
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? parisTodayKey(d) : "";
}

/** Match synthétique minimal pour la popup détail (live ou repli prematch). */
function syntheticMatch(
  id: string,
  nameA: string,
  nameB: string,
  tournament: string,
  round: string,
): TennisMatch {
  const shortA = nameA.split(" ").slice(-1)[0].toUpperCase();
  const shortB = nameB.split(" ").slice(-1)[0].toUpperCase();
  const now = new Date().toISOString();
  const player = (name: string, short: string, form: ("W" | "L")[]) => ({
    id: name.toLowerCase().replace(/\s+/g, "_"),
    name,
    shortName: short,
    rank: 0,
    elo: 1500,
    photoUrl: resolvePlayerPhoto(name),
    color: hashColor(name),
    form,
  });
  return {
    id,
    tournament,
    round,
    scheduledAt: now,
    playerA: player(nameA, shortA, ["W", "L", "W", "L", "W", "L"]),
    playerB: player(nameB, shortB, ["L", "W", "L", "W", "L", "W"]),
    probA: 50,
    probB: 50,
    stats: { form: "LIVE", eloGap: 0, surface: "Dur", h2h: "—", ic: [0, 100], confidence: 0 },
    model: "Live",
    modelUpdatedAt: now,
    synthetic: true,
  } as TennisMatch;
}

type Props = {
  /** Clic pill Top (si absent : la pill ouvre le détail comme la ligne, cf. foot). */
  onTopPillSelect?: (m: FotmobCalMatch, tag: TopStratTag) => void;
};

/**
 * Section calendrier FotMob des matchs tennis (prematch + live, date,
 * heures, recherche, Top, pills, PowerScore). Réutilisée sur la home
 * (onglet tennis) et dans la vue Stratégies.
 */
export function TennisCalendarSection({ onTopPillSelect }: Props = {}) {
  const todayKey = useMemo(() => parisTodayKey(), []);
  const [calDate, setCalDate] = useState(todayKey);
  const [calHours, setCalHours] = useState<number | null>(null);
  const [calLiveOnly, setCalLiveOnly] = useState(false);
  const [calTopOnly, setCalTopOnly] = useState(false);
  const [calQuery, setCalQuery] = useState("");
  const [matches, setMatches] = useState<TennisCalendarMatch[]>([]);
  const [fullMatches, setFullMatches] = useState<TennisMatch[]>([]);
  const [allStrats, setAllStrats] = useState<
    Partial<Record<TennisStrategyKey, TennisStrategyEntry[]>>
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [detailMatch, setDetailMatch] = useState<TennisMatch | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Pills Top des 9 stratégies (pastilles sous les noms, comme le foot).
  const pillTags = useMemo(() => {
    const map = new Map<string, TopStratTag[]>();
    for (const [key, entries] of Object.entries(allStrats)) {
      if (!Array.isArray(entries)) continue;
      const skey = key as TennisStrategyKey;
      const def = TENNIS_STRATEGY_DEFS.find((d) => d.key === skey);
      for (const e of entries as TennisStrategyEntry[]) {
        const tag: TopStratTag = {
          key,
          label: STRAT_SHORT[skey] ?? key,
          emoji: def?.emoji ?? "★",
          value: def?.format(e.value) ?? String(e.value),
        };
        const prev = map.get(e.matchId);
        if (prev) prev.push(tag);
        else map.set(e.matchId, [tag]);
      }
    }
    return map;
  }, [allStrats]);
  const topTagsFor = useCallback(
    (id: string) => pillTags.get(id) ?? pillTags.get(normId(id)) ?? [],
    [pillTags],
  );

  // Live tennis (SSE/8s via hook partagé — même source que l'onglet Live).
  const { liveMatchList, liveStates } = useLiveMatches();
  const liveCal: FotmobCalMatch[] = useMemo(
    () =>
      liveMatchList
        .filter((m) => m.isLive)
        .map((m) => {
          const st = liveStates[m.id];
          const setsA = st?.scoreA.sets ?? [];
          const setsB = st?.scoreB.sets ?? [];
          let wA = 0;
          let wB = 0;
          for (let i = 0; i < Math.max(setsA.length, setsB.length); i++) {
            if ((setsA[i] ?? 0) > (setsB[i] ?? 0)) wA++;
            else if ((setsB[i] ?? 0) > (setsA[i] ?? 0)) wB++;
          }
          return {
            id: m.id,
            scheduledAt: new Date().toISOString(),
            home: { name: m.playerA.name, logo: null },
            away: { name: m.playerB.name, logo: null },
            league: { name: m.tournamentName ?? "En direct", country: null, logo: null },
            round: m.roundName ?? null,
            live: { status: "LIVE", homeScore: wA, awayScore: wB },
          };
        }),
    [liveMatchList, liveStates],
  );

  // Base calendrier : tous les matchs (win=all) + 9 stratégies (pills) +
  // objets complets pour la popup détail. Le datepicker filtre côté client.
  useEffect(() => {
    const ac = new AbortController();
    setIsLoading(true);
    setLoadError(null);
    Promise.all([
      fetch("/api/tennis/strategy-top10?strat=all&win=all", { signal: ac.signal }).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      }),
      fetch("/api/tennis/prematch", { signal: ac.signal }).then((r) =>
        r.ok ? r.json() : { matches: [] },
      ),
    ])
      .then(([top, pre]) => {
        setMatches(Array.isArray(top.matches) ? top.matches : []);
        setAllStrats(top.strategies && typeof top.strategies === "object" ? top.strategies : {});
        setFullMatches(Array.isArray(pre.matches) ? pre.matches : []);
      })
      .catch((err) => {
        if ((err as Error).name !== "AbortError") setLoadError((err as Error).message);
      })
      .finally(() => setIsLoading(false));
    return () => ac.abort();
  }, []);

  const fullById = useMemo(() => {
    const map = new Map<string, TennisMatch>();
    for (const m of fullMatches) map.set(normId(m.id), m);
    return map;
  }, [fullMatches]);

  // Fusion live d'abord (dédupliquée : le live gagne sur le prematch).
  const calMatches = useMemo(() => {
    const seen = new Set<string>();
    const out: FotmobCalMatch[] = [];
    for (const m of liveCal) {
      const k = normId(m.id);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(m);
    }
    for (const m of matches.map(toCalMatch)) {
      const k = normId(m.id);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(m);
    }
    return out;
  }, [liveCal, matches]);

  const isLiveRow = (m: FotmobCalMatch) =>
    m.live?.status === "LIVE" || m.live?.status === "HT";

  const filtered = useMemo(() => {
    const q = calQuery.trim().toLowerCase();
    // Live toujours gardé (comme le foot) ; prematch filtré par date Paris.
    let list = calMatches.filter((m) => isLiveRow(m) || parisDateKey(m.scheduledAt) === calDate);
    if (calLiveOnly) list = list.filter(isLiveRow);
    list = filterByKickoffWindow(list, calHours);
    if (calTopOnly) list = list.filter((m) => topTagsFor(m.id).length > 0);
    if (q) {
      list = list.filter(
        (m) =>
          m.home.name.toLowerCase().includes(q) ||
          m.away.name.toLowerCase().includes(q) ||
          (m.league?.name ?? "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [calMatches, calDate, calLiveOnly, calHours, calTopOnly, topTagsFor, calQuery]);

  const topCount = useMemo(
    () => filtered.filter((m) => topTagsFor(m.id).length > 0).length,
    [filtered, topTagsFor],
  );

  // Clic ligne → popup détail (live ou prematch, comme le foot).
  const handleSelectMatch = useCallback(
    (m: FotmobCalMatch) => {
      const live = isLiveRow(m);
      const full = fullById.get(normId(m.id));
      if (full && !live) {
        setDetailMatch(full);
      } else {
        const lm = liveMatchList.find((x) => normId(x.id) === normId(m.id));
        setDetailMatch(
          syntheticMatch(
            m.id,
            lm?.playerA.name ?? m.home.name,
            lm?.playerB.name ?? m.away.name,
            m.league?.name ?? "Tournoi",
            m.round ?? (live ? "En direct" : ""),
          ),
        );
      }
      setDetailOpen(true);
    },
    [fullById, liveMatchList],
  );

  return (
    <>
      <section
        className="rounded-2xl"
        style={{ background: C.card, border: `1px solid ${C.cardBorder}` }}
        aria-label="Calendrier des matchs tennis"
      >
        <div className="flex items-center gap-2 px-4 py-3">
          <h2 className="text-[15px] font-semibold" style={{ color: C.headerText }}>
            Calendrier des matchs
          </h2>
          {!isLoading && !loadError && (
            <span className="font-mono text-[11px]" style={{ color: C.time }}>
              {filtered.length} match{filtered.length > 1 ? "s" : ""}
            </span>
          )}
        </div>

        <div className="px-4 pb-3">
          <FotmobFilterBar
            dateKey={calDate}
            todayKey={todayKey}
            onPrevDay={() => setCalDate((k) => shiftDateKey(k, -1))}
            onNextDay={() => setCalDate((k) => shiftDateKey(k, 1))}
            onPickDate={setCalDate}
            liveOnly={calLiveOnly}
            onToggleLive={() => setCalLiveOnly((v) => !v)}
            hours={calHours}
            onHours={setCalHours}
            query={calQuery}
            onQuery={setCalQuery}
            count={filtered.length}
            topOnly={calTopOnly}
            onToggleTop={() => setCalTopOnly((v) => !v)}
            topCount={topCount}
          />
        </div>

        <div className="border-t px-4 py-3" style={{ borderColor: C.cardBorder }}>
          {isLoading ? (
            <div
              role="status"
              aria-live="polite"
              className="flex items-center gap-2 py-3 text-xs"
              style={{ color: C.accent }}
            >
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              Chargement du calendrier…
            </div>
          ) : loadError ? (
            <div className="flex items-center gap-2 py-3 text-xs text-[#EF4444]">
              <AlertCircle className="h-3.5 w-3.5" aria-hidden />
              Calendrier indisponible ({loadError})
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-3 text-xs" style={{ color: C.time }}>
              Aucun match ce jour-là. Changez de date ou réinitialisez les filtres.
            </p>
          ) : (
            <FotmobCalendarTable
              matches={filtered}
              onSelectMatch={handleSelectMatch}
              topTagsFor={topTagsFor}
              onTopPillSelect={onTopPillSelect}
            />
          )}
        </div>
      </section>

      <MatchDetailDialog match={detailMatch} open={detailOpen} onOpenChange={setDetailOpen} />
    </>
  );
}
