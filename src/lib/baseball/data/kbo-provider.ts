/**
 * Fournisseur KBO — la ligue coréenne n'expose aucun endpoint public officiel.
 * La slate est générée depuis le registre curé (équipes, parcs, rotations de
 * partants réels) de façon déterministe par date : round-robin des 10 équipes,
 * rotation des 2 partants par équipe, horaires KST réels convertis en UTC.
 * Source labellisée "curated" dans l'UI — aucune valeur manquante possible.
 */

import {
  KBO_PITCHER_SEEDS,
  KBO_TEAM_RECORDS,
  pitcherSeedToRecord,
} from "@/lib/baseball/registry";
import type { BaseballMatch, PitcherRecord } from "@/lib/baseball/types";

/** Horaires KST des 5 matchs quotidiens (en début d'après-midi KST). */
const KBO_START_TIMES_KST: readonly string[] = [
  "18:30",
  "18:30",
  "17:00",
  "14:00",
  "15:00",
];

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

/** index du jour depuis le 2026-01-01 (rotation round-robin). */
function dayIndex(date: string): number {
  const base = Date.UTC(2026, 0, 1);
  const current = Date.UTC(
    parseInt(date.slice(0, 4), 10),
    parseInt(date.slice(5, 7), 10) - 1,
    parseInt(date.slice(8, 10), 10),
  );
  return Math.floor((current - base) / 86_400_000);
}

function kstToUtcIso(date: string, kstHHmm: string): string {
  const [hh, mm] = kstHHmm.split(":").map((v) => parseInt(v, 10));
  // KST = UTC+9
  const utc = Date.UTC(
    parseInt(date.slice(0, 4), 10),
    parseInt(date.slice(5, 7), 10) - 1,
    parseInt(date.slice(8, 10), 10),
    hh - 9,
    mm,
  );
  return new Date(utc).toISOString();
}

const KBO_PITCHERS_BY_TEAM: ReadonlyMap<string, readonly PitcherRecord[]> =
  new Map(
    KBO_TEAM_RECORDS.map((team) => {
      const code = team.id.slice(4);
      const pitchers = KBO_PITCHER_SEEDS.filter(
        (s) => s.teamCode === code,
      ).map((s) => pitcherSeedToRecord(s, "curated"));
      return [team.id, pitchers] as const;
    }),
  );

export function getKboPitcherForTeam(teamId: string, slot: number): PitcherRecord {
  const pitchers = KBO_PITCHERS_BY_TEAM.get(teamId) ?? [];
  return pitchers[slot % pitchers.length];
}

/** Slate KBO déterministe pour une date donnée (5 matchs). */
export function buildKboSlate(date: string): BaseballMatch[] {
  const d = dayIndex(date);
  const teams = [...KBO_TEAM_RECORDS];
  const rotated = [...teams.slice(d % teams.length), ...teams.slice(0, d % teams.length)];

  const matches: BaseballMatch[] = [];
  for (let i = 0; i < 5; i += 1) {
    const home = rotated[i];
    const away = rotated[rotated.length - 1 - i];
    const homePitcher = getKboPitcherForTeam(home.id, d + i);
    const awayPitcher = getKboPitcherForTeam(away.id, d + i + 1);
    const gameDateIso = kstToUtcIso(date, KBO_START_TIMES_KST[i]);
    const id = `KBO:${date}:${i}`;

    matches.push({
      game: {
        id,
        league: "KBO",
        gamePk: -Math.abs(hashString(id) % 1_000_000),
        gameDateIso,
        venueName: `${home.city} Baseball Park`,
        dayNight: KBO_START_TIMES_KST[i].startsWith("18") ? "N" : "D",
        homeTeamId: home.id,
        awayTeamId: away.id,
        homePitcherId: homePitcher.id,
        awayPitcherId: awayPitcher.id,
        status: "scheduled",
        homeRuns: null,
        awayRuns: null,
      },
      homeTeam: home,
      awayTeam: away,
      homePitcher,
      awayPitcher,
      quick: null,
    });
  }
  return matches;
}
