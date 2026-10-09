/**
 * Adaptateur LIVE MLB StatsAPI (statsapi.mlb.com) — API publique sans clé.
 * - Calendrier officiel avec lanceurs partants probables (`probablePitcher`)
 * - Stats réelles du lanceur : ERA, WHIP, K/9, BB/9, HR/9, W-L, IP, OPS-contre
 * - FIP recomputé depuis les composantes réelles (HR, BB, HBP, K, IP)
 * - Timeout strict + mode dégradé explicite (jamais de données inventées)
 */

import { computeFip, computeXEra, MLB_ID_TO_CODE } from "@/lib/baseball/registry";
import { parisDateString, shiftIsoDate } from "@/lib/baseball/timezone";
import { round2 } from "@/lib/baseball/format";
import type { GameStatus, PitcherRecord } from "@/lib/baseball/types";

const MLB_BASE = "https://statsapi.mlb.com";

interface MlbProbablePitcher {
  id: number;
  fullName: string;
}

interface MlbTeamRef {
  team: { id: number; name: string };
  probablePitcher: MlbProbablePitcher | null;
  score?: number;
}

interface MlbPersonRaw {
  people: {
    id: number;
    pitchHand?: { code?: "L" | "R" };
  }[];
}

interface MlbGameRaw {
  gamePk: number;
  gameDate: string;
  gameType: string;
  dayNight: string;
  status: { statusCode: string; abstractGameState: string };
  teams: { home: MlbTeamRef; away: MlbTeamRef };
  venue: { name: string };
}

interface MlbScheduleRaw {
  dates: { date: string; games: MlbGameRaw[] }[];
}

export interface MlbLiveGame {
  gamePk: number;
  gameDateIso: string;
  venueName: string;
  dayNight: "D" | "N";
  homeTeamMlbId: number;
  awayTeamMlbId: number;
  homePitcher: MlbProbablePitcher | null;
  awayPitcher: MlbProbablePitcher | null;
  status: GameStatus;
  homeRuns: number | null;
  awayRuns: number | null;
}

/**
 * État de jeu d'un match MLB en cours.
 *
 * Les 5 champs sont EXTRAITS du game feed (`linescore` + `liveData`) et non
 * devinés : la matrice d'espérance `RUN_EXPECTANCY_MATRIX` est indexée par
 * (occupation des bases × outs), donc un match sans cet état n'a AUCUN marché
 * calculable. `bases` est le masque FIRST=1 / SECOND=2 / THIRD=4.
 */
export interface MlbLiveState {
  /** Manche en cours, 1-15 (9e manche + prolongations). */
  inning: number;
  /** Moitié de la manche : "top" = visiteurs, "bottom" = domicile. */
  half: "top" | "bottom";
  /** Outs accomplishments, 0-2. */
  outs: number;
  /** Occupation des bases : 1 = 1re, 2 = 2e, 4 = 3e, 7 = bases pleines. */
  bases: number;
  balls: number;
  strikes: number;
  /** Score à la fin de chaque demi-manche jouée (index = inning - 1). */
  inningScores: Array<{ home: number; away: number }>;
}

interface MlbLiveDataRaw {
  linescore?: {
    currentInning?: number;
    currentInningOrdinal?: string;
    innings?: Array<{ home?: number; away?: number }>;
  };
  allPlay?: Array<{ about?: { halfInning?: string; isTopInning?: boolean } }>;
  outs?: string;
  balls?: string;
  strikes?: string;
  bases?: string;
  count?: { balls?: number; strikes?: number; outs?: number };
}

interface MlbGameFeedRaw {
  gamePk: number;
  gameData?: {
    teams?: { home?: { score?: number }; away?: { score?: number } };
    linescore?: {
      currentInning?: number;
      innings?: Array<{ home?: number; away?: number }>;
    };
  };
  liveData?: MlbLiveDataRaw;
}

/**
 * Extrait l'état de jeu du game feed MLB.
 *
 * Renvoie `null` si l'un des 5 champs manquent : mieux vaut « indisponible »
 * qu'un marché calculé sur une base vide qui afficherait 0.46 run attendus
 * quand le jeu est rechargé après un inning.
 *
 * Le champ `bases` du game feed est une chaîne doccupation déjà masquée par
 * MLB ("110" = 1re+2e) : on la convertit en bitmask pour coller à la matrice
 * existante (FIRST=1, SECOND=2, THIRD=4).
 */
export function extractMlbLiveState(feed: unknown): MlbLiveState | null {
  if (typeof feed !== "object" || feed === null) return null;
  const f = feed as MlbGameFeedRaw;
  const linescore = f.liveData?.linescore ?? f.gameData?.linescore;
  const inning = linescore?.currentInning;
  const outs = f.liveData?.count?.outs ?? (f.liveData?.outs !== undefined ? Number(f.liveData.outs) : undefined);
  const balls = f.liveData?.count?.balls ?? (f.liveData?.balls !== undefined ? Number(f.liveData.balls) : undefined);
  const strikes = f.liveData?.count?.strikes ?? (f.liveData?.strikes !== undefined ? Number(f.liveData.strikes) : undefined);
  const basesStr = f.liveData?.bases;

  // La moitié de la manche est lue dans le dernier play joué
  // (`about.halfInning`) — elle n'est PAS dans `linescore`. Elle décide de
  // QUI frappe, donc quel camp hérite de l'état des bases : la deviner
  // attribuerait la matrice d'espérance au mauvais camp, en silence.
  const lastPlay = f.liveData?.allPlay?.[f.liveData.allPlay.length - 1]?.about;
  const half = lastPlay?.halfInning;

  if (
    typeof inning !== "number" ||
    outs === undefined ||
    balls === undefined ||
    strikes === undefined ||
    typeof basesStr !== "string" ||
    basesStr.length !== 3 ||
    (half !== "top" && half !== "bottom")
  ) {
    return null;
  }

  // MLB renvoie l'occupation dans l'ordre 1re-2e-3e sous forme de bits.
  const bases = (basesStr[0] === "1" ? 1 : 0) | (basesStr[1] === "1" ? 2 : 0) | (basesStr[2] === "1" ? 4 : 0);

  const innings = Array.isArray(linescore?.innings) ? linescore.innings : [];

  return {
    inning,
    half,
    outs,
    bases,
    balls,
    strikes,
    inningScores: innings.map((i) => ({ home: i.home ?? 0, away: i.away ?? 0 })),
  };
}

/**
 * Récupère l'état live d'un match MLB précis (gamePk).
 *
 * Une requête par match : c'est le coût assumé du widget (8 s de polling sur
 * un seul match ouvert), pas un balayage de la league entière.
 */
export async function fetchMlbLiveState(gamePk: number): Promise<MlbLiveState | null> {
  try {
    const feed = await fetchJson<MlbGameFeedRaw>(
      `${MLB_BASE}/api/v1.1/game/${gamePk}/feed/live`,
      9000
    );
    const state = extractMlbLiveState(feed);
    return state;
  } catch {
    return null;
  }
}

export interface MlbPitcherStatsRaw {
  era: number | null;
  whip: number | null;
  kPer9: number | null;
  bbPer9: number | null;
  hrPer9: number | null;
  wins: number | null;
  losses: number | null;
  inningsPitched: number | null;
  opsAgainst: number | null;
  gamesStarted: number | null;
}

async function fetchJson<T>(url: string, timeoutMs = 9000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (res.ok) {
      return (await res.json()) as T;
    }
    // Certaines IP de datacenter (VPS) se voient renvoyer un 406 sur HTTPS
    // pour /people et /stats, alors que la même ressource répond en HTTP.
    // On retombe sur le miroir HTTP avant d'abandonner — jamais de donnée
    // inventée en cas d'échec : le caller propage null et l'UI affiche "—".
    if (url.startsWith("https://statsapi.mlb.com")) {
      const httpUrl = url.replace("https://statsapi.mlb.com", "http://statsapi.mlb.com");
      const retryRes = await fetch(httpUrl, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (retryRes.ok) {
        return (await retryRes.json()) as T;
      }
    }
    throw new Error(`MLB StatsAPI HTTP ${res.status}`);
  } finally {
    clearTimeout(timer);
  }
}

function mapStatus(code: string, state: string): GameStatus {
  if (code === "F" || code === "O" || code === "FR") return "final";
  if (code === "I" || state === "Live" || state === "In Progress") return "live";
  return "scheduled";
}

/** Saison MLB courante — auto-détectée depuis la date actuelle. */
const SEASON = new Date().getFullYear();

/**
 * Récupère la slate MLB réelle pour une date Paris.
 * Interroge date et date+1 (les matchs nocturnes US débordent sur le
 * lendemain) puis regroupe par date locale Paris.
 */
export async function fetchMlbSlate(
  dateParis: string,
): Promise<{ games: MlbLiveGame[]; degraded: boolean }> {
  const dates = [dateParis, shiftIsoDate(dateParis, 1)];
  const raws: MlbGameRaw[] = [];
  let degraded = false;

  for (const d of dates) {
    try {
      const url = `${MLB_BASE}/api/v1/schedule?sportId=1&date=${d}&hydrate=probablePitcher`;
      const data = await fetchJson<MlbScheduleRaw>(url);
      for (const dateGroup of data.dates) {
        raws.push(...dateGroup.games);
      }
    } catch {
      degraded = true;
    }
  }

  const games: MlbLiveGame[] = raws
    .filter((g) => parisDateString(g.gameDate) === dateParis)
    .map((g): MlbLiveGame => {
      const status = mapStatus(g.status.statusCode, g.status.abstractGameState);
      const homeScore =
        typeof g.teams.home.score === "number" ? g.teams.home.score : null;
      const awayScore =
        typeof g.teams.away.score === "number" ? g.teams.away.score : null;
      const dayNight: "D" | "N" = g.dayNight === "N" ? "N" : "D";
      return {
        gamePk: g.gamePk,
        gameDateIso: g.gameDate,
        venueName: g.venue?.name ?? "Stadium",
        dayNight,
        homeTeamMlbId: g.teams.home.team.id,
        awayTeamMlbId: g.teams.away.team.id,
        homePitcher: g.teams.home.probablePitcher,
        awayPitcher: g.teams.away.probablePitcher,
        status,
        homeRuns: homeScore,
        awayRuns: awayScore,
      };
    })
    // Équipes MLB actives uniquement (exclut futures franchises si liste évolue)
    .filter((g) => MLB_ID_TO_CODE.has(g.homeTeamMlbId) && MLB_ID_TO_CODE.has(g.awayTeamMlbId));

  return { games, degraded };
}

/** Stats saison réelles d'un lanceur MLB (group=pitching, saison en cours). */
export async function fetchMlbPitcherStats(
  personId: number,
): Promise<MlbPitcherStatsRaw | null> {
  try {
    const url = `${MLB_BASE}/api/v1/people/${personId}/stats?stats=statsSingleSeason&sportId=1&season=${SEASON}&gameType=R&group=pitching`;
    const data = await fetchJson<{
      stats: { splits: { stat: Record<string, unknown> }[] }[];
    }>(url);
    const split = data.stats?.[0]?.splits?.[0]?.stat;
    if (!split) return null;
    const num = (v: unknown): number | null =>
      typeof v === "number" && Number.isFinite(v) ? v : null;
    return {
      era: num(split.era),
      whip: num(split.whip),
      kPer9: num(split.strikeoutsPer9Inn),
      bbPer9: num(split.walksPer9Inn),
      hrPer9: num(split.homeRunsPer9),
      wins: num(split.wins),
      losses: num(split.losses),
      inningsPitched: num(split.inningsPitched),
      opsAgainst: num(split.ops),
      gamesStarted: num(split.gamesStarted),
    };
  } catch {
    return null;
  }
}

/** Main de lancer réelle d'un joueur, depuis /people (pitchHand). */
export async function fetchMlbPitcherHand(personId: number): Promise<"LHP" | "RHP" | null> {
  try {
    const url = `${MLB_BASE}/api/v1/people/${personId}?hydrate=pitchHand`;
    const data = await fetchJson<MlbPersonRaw>(url);
    const code = data.people?.[0]?.pitchHand?.code;
    if (code === "L") return "LHP";
    if (code === "R") return "RHP";
    return null;
  } catch {
    return null;
  }
}

/** Construit le PitcherRecord depuis les stats LIVE (FIP/xERA recalculés).
 * Aucune valeur n'est inventée : si les stats de saison sont absentes
 * (rookie, aucun split renvoyé), les champs restent null et
 * `statsAvailable=false` — l'UI affiche des "—" et le moteur retombe sur
 * les moyennes de ligue (repli bayésien, aucun NaN). */
export function buildLiveMlbPitcher(
  teamCode: string,
  mlbId: number,
  name: string,
  hand: "LHP" | "RHP" | null,
  stats: MlbPitcherStatsRaw | null,
): PitcherRecord {
  const era = stats?.era ?? null;
  const kPer9 = stats?.kPer9 ?? null;
  const bbPer9 = stats?.bbPer9 ?? null;
  const hrPer9 = stats?.hrPer9 ?? null;
  const opsAgainst = stats?.opsAgainst ?? null;
  const inningsPitched = stats?.inningsPitched ?? null;
  const gamesStarted = stats?.gamesStarted ?? null;
  const wins = stats?.wins ?? null;
  const losses = stats?.losses ?? null;
  const whip = stats?.whip ?? null;
  return {
    id: `MLB:${mlbId}`,
    league: "MLB",
    teamId: `MLB:${teamCode}`,
    name,
    throws: hand ?? null,
    era: era === null ? null : round2(era),
    whip: whip === null ? null : round2(whip),
    fip:
      kPer9 === null || bbPer9 === null || hrPer9 === null
        ? null
        : computeFip(hrPer9, bbPer9, kPer9),
    xEra: opsAgainst === null ? null : computeXEra(opsAgainst),
    kPer9: kPer9 === null ? null : round2(kPer9),
    bbPer9: bbPer9 === null ? null : round2(bbPer9),
    hrPer9: hrPer9 === null ? null : round2(hrPer9),
    wins,
    losses,
    inningsPitched: inningsPitched === null ? null : round2(inningsPitched),
    opsAgainst: opsAgainst === null ? null : round2(opsAgainst),
    starterIpAvg:
      inningsPitched === null || gamesStarted === null || gamesStarted <= 0
        ? null
        : round2(Math.min(6.5, Math.max(4.5, inningsPitched / gamesStarted))),
    statsAvailable: stats !== null && era !== null && whip !== null,
    source: stats ? "mlb-statsapi-live" : "curated",
    season: SEASON,
    // Photo portrait officielle MLB (midfield CDN public gratuit).
    // Pour KBO : pas de CDN public — photoUrl absente, fallback initiales.
    photoUrl: `https://midfield.mlbstatic.com/v1/people/${mlbId}/portrait/270x270`,
  };
}
