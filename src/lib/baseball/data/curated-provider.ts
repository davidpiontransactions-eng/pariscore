/**
 * Fournisseur générique pour ligues curées (sans endpoint public officiel).
 * Slate déterministe par date : round-robin des équipes, rotation des 2
 * partants (SP1/SP2) générés par `CURATED_PITCHERS_BY_TEAM_BY_LEAGUE`,
 * horaires locaux convertis en UTC pour chaque ligue. Source labellisée
 * "curated" dans l'UI — aucune donnée factice cachée.
 *
 * Distance de génération : chaque ligue a sa propre offset horaire UTC et
 * son rythme quotidien (ex. MLB 9-10 matchs, LMB 4-5, LIDOM 2-3, etc.).
 */

import {
  CURATED_PITCHERS_BY_TEAM_BY_LEAGUE,
  CURATED_TEAMS_BY_LEAGUE,
} from "@/lib/baseball/registry";
import type {
  BaseballMatch,
  League,
  PitcherRecord,
  TeamRecord,
} from "@/lib/baseball/types";

interface LeagueTiming {
  /** Décalage UTC moyen de la ligue (heures négatives si ouest, positives si est). */
  utcOffsetHours: number;
  /** Heures de début de match locales (24h) — 5-6 horaires typiques par jour. */
  startTimesLocal: readonly string[];
  /** Nombre maximum de matchs calendrier généré par jour. */
  dailyGameCount: number;
  /** Préfixe d'identifiant de match (ex. "KBO:2026-08-13:0"). */
  idPrefix: string;
}

const LEAGUE_TIMINGS: Record<Exclude<League, "MLB">, LeagueTiming> = {
  KBO: {
    utcOffsetHours: 9,
    startTimesLocal: ["18:30", "18:30", "17:00", "14:00", "15:00"],
    dailyGameCount: 5,
    idPrefix: "KBO",
  },
  NPB: {
    utcOffsetHours: 9,
    startTimesLocal: ["18:00", "14:00", "13:30", "17:00", "18:00"],
    dailyGameCount: 6,
    idPrefix: "NPB",
  },
  CPBL: {
    utcOffsetHours: 8,
    startTimesLocal: ["18:35", "18:35", "17:05", "14:00", "18:35"],
    dailyGameCount: 3,
    idPrefix: "CPBL",
  },
  LMB: {
    utcOffsetHours: -6,
    startTimesLocal: ["18:00", "19:00", "17:30", "20:00", "16:00", "19:30"],
    dailyGameCount: 5,
    idPrefix: "LMB",
  },
  LIDOM: {
    utcOffsetHours: -4,
    startTimesLocal: ["19:15", "19:15", "17:30", "18:30"],
    dailyGameCount: 3,
    idPrefix: "LIDOM",
  },
  LVBP: {
    utcOffsetHours: -4,
    startTimesLocal: ["18:30", "19:00", "17:30", "20:00", "18:30"],
    dailyGameCount: 4,
    idPrefix: "LVBP",
  },
};

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

/** Index du jour depuis le 2026-01-01 (rotation round-robin déterministe). */
function dayIndex(date: string): number {
  const base = Date.UTC(2026, 0, 1);
  const current = Date.UTC(
    parseInt(date.slice(0, 4), 10),
    parseInt(date.slice(5, 7), 10) - 1,
    parseInt(date.slice(8, 10), 10),
  );
  return Math.floor((current - base) / 86_400_000);
}

function localToUtcIso(
  date: string,
  localHHmm: string,
  utcOffset: number,
): string {
  const [hh, mm] = localHHmm.split(":").map((v) => parseInt(v, 10));
  // Compense le décalage horaire local -> UTC (limite : DST négligé, tolerate +/- 1h).
  const utcHour = hh - utcOffset;
  const utc = Date.UTC(
    parseInt(date.slice(0, 4), 10),
    parseInt(date.slice(5, 7), 10) - 1,
    parseInt(date.slice(8, 10), 10),
    utcHour,
    mm,
  );
  return new Date(utc).toISOString();
}

/** Vérifie qu'une ligue doit être traitée localement (curé, hors MLB live). */
export function isCuratedLeague(league: League): boolean {
  return league !== "MLB";
}

/** Slate déterministe par ligue et date. */
export function buildCuratedSlate(league: League, date: string): BaseballMatch[] {
  if (league === "MLB") return [];
  const timing = LEAGUE_TIMINGS[league];
  const teams = [...(CURATED_TEAMS_BY_LEAGUE[league] ?? [])];
  if (teams.length < 2) return [];

  const d = dayIndex(date);
  const rotated = [
    ...teams.slice(d % teams.length),
    ...teams.slice(0, d % teams.length),
  ];

  const matches: BaseballMatch[] = [];
  const gameCount = Math.min(timing.dailyGameCount, Math.floor(teams.length / 2));
  for (let i = 0; i < gameCount; i += 1) {
    const home = rotated[i];
    const away = rotated[rotated.length - 1 - i];
    if (home.id === away.id) continue;

    const homePitchers =
      CURATED_PITCHERS_BY_TEAM_BY_LEAGUE[league].get(home.id) ?? [];
    const awayPitchers =
      CURATED_PITCHERS_BY_TEAM_BY_LEAGUE[league].get(away.id) ?? [];
    const homePitcher =
      homePitchers.length > 0
        ? homePitchers[(d + i) % Math.max(1, homePitchers.length)]
        : undefined;
    const awayPitcher =
      awayPitchers.length > 0
        ? awayPitchers[(d + i + 1) % Math.max(1, awayPitchers.length)]
        : undefined;

    const startTimeLocal =
      timing.startTimesLocal[i % timing.startTimesLocal.length];
    const gameDateIso = localToUtcIso(date, startTimeLocal, timing.utcOffsetHours);
    const id = `${timing.idPrefix}:${date}:${i}`;
    matches.push({
      game: {
        id,
        league,
        gamePk: -Math.abs((hashString(id) % 1_000_000) + 1),
        gameDateIso,
        venueName: `${home.city} Park`,
        dayNight: startTimeLocal.startsWith("1") ? "D" : "N",
        homeTeamId: home.id,
        awayTeamId: away.id,
        homePitcherId: homePitcher?.id ?? null,
        awayPitcherId: awayPitcher?.id ?? null,
        status: "scheduled",
        homeRuns: null,
        awayRuns: null,
      },
      homeTeam: home,
      awayTeam: away,
      homePitcher: homePitcher ?? null,
      awayPitcher: awayPitcher ?? null,
      quick: null,
    });
  }
  return matches;
}

export type { TeamRecord, PitcherRecord };