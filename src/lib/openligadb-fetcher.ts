// OpenLigaDB — source gratuite (sans clé) pour les ligues allemandes.
// https://www.openligadb.de / api.openligadb.de
//
// Couverture actuellement branchée : 2. Bundesliga (`bl2`) — absente de BSD
// (voir BSD_UNCOVERED_LEAGUES dans league-mapping.ts). Le slug `bl2` est
// réutilisé chaque saison ("2. Fussball-Bundesliga <YYYY>/<YYYY+1>").
//
// Endpoints utilisés :
//   GET /getavailableleagues            → résolution de la saison active
//   GET /getmatchdata/bl2/{season}      → matchs (results[] brut, pas de wrapper)
//   GET /getbltable/bl2/{season}        → classement (18 équipes, trié)
//
// Aucun token requis. Timeout 15s, cache saison 6h côté module.

import type { FootballMatch, League, Team } from "./football-data";

const OPENLIGADB_BASE = "https://api.openligadb.de";
const BL2_SHORTCUT = "bl2";
const SEASON_TTL_MS = 6 * 60 * 60 * 1000; // la saison change 1×/an

export const OPENLIGADB_LEAGUE: League = {
  id: "bundesliga2",
  name: "2. Bundesliga",
  country: "Germany",
  countryCode: "DE",
  logo: "",
  tier: "T2",
};

type OLDTeam = {
  teamId: number;
  teamName: string;
  shortName: string;
  teamIconUrl?: string;
};

type OLDResult = {
  resultID: number;
  resultName: string;
  pointsTeam1: number;
  pointsTeam2: number;
};

type OLDMatch = {
  matchID: number;
  matchDateTime: string;
  matchDay: number;
  group?: { groupName?: string; groupOrderID?: number } | null;
  team1: OLDTeam;
  team2: OLDTeam;
  matchResults?: OLDResult[];
  matchIsFinished: boolean;
};

type OLDLeague = {
  leagueId: number;
  leagueName: string;
  leagueShortcut?: string;
  leagueSaison?: string;
};

type OLDTableRow = {
  teamInfoId: number;
  teamName: string;
  shortName: string;
  teamIconUrl?: string;
  matches: number;
  won: number;
  draw: number;
  lost: number;
  goals: number;
  opponentGoals: number;
  goalDiff: number;
  points: number;
};

/** Résultats "final" acceptés (nom peut varier : "Finale", "Endergebnis", …). */
const FINAL_RESULT = /final|end/i;

// ── HTTP ────────────────────────────────────────────────────────────────

async function olbFetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${OPENLIGADB_BASE}${path}`, {
    headers: { Accept: "application/json", "User-Agent": "PariScore/1.0" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`OpenLigaDB HTTP ${res.status}`);
  return (await res.json()) as T;
}

// ── Saison active ───────────────────────────────────────────────────────

let seasonCache: { at: number; season: string | null } | null = null;

/**
 * Résout la saison active de `bl2` (ex. "2026" pour 2026/2027) en
 * interrogeant getavailableleagues ; fallback année courante si échec.
 */
export async function resolveOpenLigaDBBL2Season(): Promise<string> {
  if (seasonCache && Date.now() - seasonCache.at < SEASON_TTL_MS && seasonCache.season) {
    return seasonCache.season;
  }

  let best = "";
  try {
    const leagues = await olbFetchJson<OLDLeague[]>("/getavailableleagues");
    const nowYear = new Date().getUTCFullYear();
    for (const l of leagues) {
      if (l.leagueShortcut !== BL2_SHORTCUT || !l.leagueSaison) continue;
      if (!/2\.\s*(fu|f)ssball-bundesliga/i.test(l.leagueName)) continue;
      const y = Number.parseInt(l.leagueSaison.split("/")[0], 10);
      if (Number.isFinite(y) && y >= nowYear - 2 && y <= nowYear + 1 && String(y) > best) {
        best = String(y);
      }
    }
  } catch {
    // résolution impossible → probe année courante ci-dessous
  }
  if (!best) best = String(new Date().getUTCFullYear());

  seasonCache = { at: Date.now(), season: best };
  return best;
}

// ── Mapping → FootballMatch ─────────────────────────────────────────────

const TEAM_COLORS = ["#004170", "#EF0107", "#FEBE10", "#DC052D", "#010E80", "#2FAEE0", "#E63E32", "#1D2C6B", "#6CABDD", "#034694", "#00E676", "#FF6D00", "#AA00FF", "#00BCD4"];

function teamColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return TEAM_COLORS[Math.abs(hash) % TEAM_COLORS.length];
}

function mapTeam(t: OLDTeam): Team {
  return {
    id: `olb-team-${t.teamId}`,
    name: t.teamName,
    shortName: t.shortName || t.teamName.toUpperCase(),
    logo: t.teamIconUrl ?? "",
    color: teamColor(t.teamName),
    form: [],
    rank: 0,
  };
}

function finalScore(m: OLDMatch): { home: number; away: number } | null {
  for (const r of m.matchResults ?? []) {
    if (FINAL_RESULT.test(r.resultName)) {
      return { home: r.pointsTeam1 ?? 0, away: r.pointsTeam2 ?? 0 };
    }
  }
  return null;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Fetch 2. Bundesliga : matchs à venir + en cours (jamais de matchs terminés).
 * Aucun odds/xG chez OpenLigaDB → prédiction neutre (33/34/33), pas d'odds.
 */
export async function fetchOpenLigaDB2Bundesliga(): Promise<FootballMatch[]> {
  const season = await resolveOpenLigaDBBL2Season();
  const matches = await olbFetchJson<OLDMatch[]>(`/getmatchdata/${BL2_SHORTCUT}/${season}`);

  const now = Date.now();
  const LIVE_SLACK_MS = 3 * 60 * 60 * 1000; // match démarré depuis < 3h = en cours
  const PREMATCH_HORIZON_MS = 7 * 24 * 60 * 60 * 1000; // fenêtre UI : 7 prochains jours
  const MAX_MATCHES = 40;
  const out: FootballMatch[] = [];

  for (const m of matches) {
    const start = new Date(m.matchDateTime).getTime();
    if (Number.isNaN(start) || start <= now - LIVE_SLACK_MS) continue;
    if (m.matchIsFinished) continue;
    if (start > now + PREMATCH_HORIZON_MS) continue; // trop loin : pas encore affiché

    const started = start <= now && now - start < LIVE_SLACK_MS;
    const fc = finalScore(m);
    const minute = started ? clamp(Math.round((now - start) / 60_000), 1, 90) : 0;

    out.push({
      id: `olb-${m.matchID}`,
      league: OPENLIGADB_LEAGUE,
      round: m.group?.groupName ?? `Journée ${m.matchDay}`,
      scheduledAt: m.matchDateTime,
      home: mapTeam(m.team1),
      away: mapTeam(m.team2),
      prediction: {
        homeProb: 33,
        drawProb: 34,
        awayProb: 33,
        bttsProb: 50,
        over25Prob: 50,
        model: "OpenLigaDB",
      },
      live: started
        ? {
            homeScore: fc?.home ?? 0,
            awayScore: fc?.away ?? 0,
            minute,
            status: "LIVE",
            homePossession: 50,
            homeShots: 0,
            awayShots: 0,
            homeShotsOnTarget: 0,
            awayShotsOnTarget: 0,
            homeCorners: 0,
            awayCorners: 0,
          }
        : null,
    });
  }

  out.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  return out.slice(0, MAX_MATCHES);
}

// ── Classement (pour la route stats, ligues non couvertes BSD) ──────────

export type OpenLigaDBStandingRow = {
  rank: number;
  teamId: string;
  name: string;
  shortName: string;
  logo: string;
  color: string;
  stats: {
    played: number;
    points: number;
    pointsPerGame: number;
    wins: number;
    draws: number;
    losses: number;
    goalsFor: number;
    goalsAgainst: number;
    goalDiff: number;
  };
};

/**
 * Classement général 2. Bundesliga (rangées déjà triées par OpenLigaDB).
 * Pas de split domicile/extérieur dans cette source → même tableau pour
 * les filtres all/home/away (la route stats l'assume).
 */
export async function fetchOpenLigaDBStandings(): Promise<OpenLigaDBStandingRow[]> {
  const season = await resolveOpenLigaDBBL2Season();
  const rows = await olbFetchJson<OLDTableRow[]>(`/getbltable/${BL2_SHORTCUT}/${season}`);
  return rows.map((r, i) => ({
    rank: i + 1,
    teamId: String(r.teamInfoId),
    name: r.teamName,
    shortName: r.shortName || r.teamName.toUpperCase(),
    logo: r.teamIconUrl ?? "",
    color: teamColor(r.teamName),
    stats: {
      played: r.matches ?? 0,
      points: r.points ?? 0,
      pointsPerGame: r.matches ? Number((r.points / r.matches).toFixed(2)) : 0,
      wins: r.won ?? 0,
      draws: r.draw ?? 0,
      losses: r.lost ?? 0,
      goalsFor: r.goals ?? 0,
      goalsAgainst: r.opponentGoals ?? 0,
      goalDiff: r.goalDiff ?? 0,
    },
  }));
}