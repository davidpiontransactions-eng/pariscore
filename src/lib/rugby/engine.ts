/**
 * Moteur d'orchestration Rugby4Cast (PariScore).
 *
 * Pipeline : sync ESPN → calcul des ratings (Elo + facteurs) → génération des
 * prédictions → simulation Monte Carlo des chances de titre.
 *
 * Cache mémoire avec TTL (pas de dépendance DB) — pattern identique au moteur
 * baseball de PariScore. Un Promise par compétition déduplique les syncs
 * concurrents. En cas d'échec ESPN, l'état existant est conservé et le payload
 * est marqué `degraded: true` (jamais de donnée inventée).
 */

import { RUGBY_COMPETITIONS, COMPETITION_BY_SLUG } from "./competitions";
import { buildWindows, fetchScoreboard } from "./espn";
import {
  DEFAULT_CONFIG,
  computeFactors,
  computeVerdict,
  modelMatch,
  predictTryScorers,
  simulateSeason,
  updateElo,
  type EloTeam,
  type RawGame,
  type SimFixture,
} from "./models";
import { SEED_PLAYERS } from "./seed-players";
import type {
  CompetitionDef,
  MatchDetail,
  PredictedMatch,
  RugbyMatch,
  RugbyPrediction,
  StandingRow,
  TeamRating,
  TryScorerPrediction,
} from "./types";

/* ------------------------------------------------------------------ */
/* État en mémoire                                                      */
/* ------------------------------------------------------------------ */

interface CompetitionState {
  matches: RugbyMatch[];
  ratings: Map<string, TeamRating>;
  predictions: Map<string, RugbyPrediction>;
  standings: StandingRow[];
  simulatedRuns: number;
  lastSyncAt: number;
  degraded: boolean;
}

interface EngineState {
  competitions: Map<string, CompetitionState>;
  inflight: Map<string, Promise<void>>;
}

const globalForRugby = globalThis as unknown as { __rugbyEngine?: EngineState };

function getState(): EngineState {
  if (!globalForRugby.__rugbyEngine) {
    globalForRugby.__rugbyEngine = {
      competitions: new Map(),
      inflight: new Map(),
    };
  }
  return globalForRugby.__rugbyEngine;
}

/** TTL du cache : 6 heures (les fixtures/ratings bougent peu en cours de journée). */
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const HISTORY_MONTHS = 14;
const FUTURE_DAYS = 120;
const RATING_WINDOW_DAYS = 500;

function freshState(): CompetitionState {
  return {
    matches: [],
    ratings: new Map(),
    predictions: new Map(),
    standings: [],
    simulatedRuns: 0,
    lastSyncAt: 0,
    degraded: false,
  };
}

function getCompState(slug: string): CompetitionState {
  const state = getState();
  let cs = state.competitions.get(slug);
  if (!cs) {
    cs = freshState();
    state.competitions.set(slug, cs);
  }
  return cs;
}

function isStale(cs: CompetitionState): boolean {
  return cs.lastSyncAt === 0 || Date.now() - cs.lastSyncAt > CACHE_TTL_MS;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

/** Jours de repos d'une équipe avant un match (depuis son dernier match terminé). */
function restDaysBefore(
  teamId: string,
  beforeDate: string,
  matches: RugbyMatch[]
): number | null {
  let last: string | null = null;
  for (const m of matches) {
    if (m.status !== "finished") continue;
    if (m.home.id !== teamId && m.away.id !== teamId) continue;
    if (new Date(m.date).getTime() >= new Date(beforeDate).getTime()) continue;
    if (!last || new Date(m.date).getTime() > new Date(last).getTime()) last = m.date;
  }
  if (!last) return null;
  return daysBetween(last, beforeDate);
}

/** Confrontations directes terminées entre deux équipes (toute compétition). */
function headToHead(a: string, b: string, matches: RugbyMatch[]): RugbyMatch[] {
  return matches.filter(
    (m) =>
      m.status === "finished" &&
      ((m.home.id === a && m.away.id === b) || (m.home.id === b && m.away.id === a))
  );
}

function h2hCounts(h2h: RugbyMatch[], homeId: string): { home: number; away: number; draws: number } {
  let home = 0;
  let away = 0;
  let draws = 0;
  for (const m of h2h) {
    if (m.homeScore === null || m.awayScore === null) continue;
    const homeIsHome = m.home.id === homeId;
    const homeScore = homeIsHome ? m.homeScore : m.awayScore;
    const awayScore = homeIsHome ? m.awayScore : m.homeScore;
    if (homeScore > awayScore) home++;
    else if (awayScore > homeScore) away++;
    else draws++;
  }
  return { home, away, draws };
}

/* ------------------------------------------------------------------ */
/* Sync d'une compétition                                               */
/* ------------------------------------------------------------------ */

async function syncCompetition(slug: string): Promise<void> {
  const def = COMPETITION_BY_SLUG.get(slug);
  if (!def) return;
  const cs = getCompState(slug);

  const futureDays = def.lookaheadDays ?? FUTURE_DAYS;
  const windows = buildWindows(HISTORY_MONTHS, futureDays);
  const collected: RugbyMatch[] = [];
  let anySuccess = false;

  for (const w of windows) {
    try {
      const data = await fetchScoreboard(def.espnSport, def.espnLeagueId, w.start, w.end, slug);
      collected.push(...data);
      anySuccess = true;
    } catch (err) {
      console.warn(`[rugby] ${slug} fenêtre ${w.start.toISOString()} échouée:`, (err as Error).message);
    }
    await new Promise((r) => setTimeout(r, 300));
  }

  if (!anySuccess) {
    // Échec total : on garde l'état précédent (même vide) et on ne marque
    // PAS lastSyncAt — sinon un état vide/brisé serait servi comme « frais »
    // pendant toute la durée du TTL.
    cs.degraded = true;
    return;
  }

  // Déduplique par id et trie par date.
  const byId = new Map<string, RugbyMatch>();
  for (const m of collected) byId.set(m.id, m);
  cs.matches = [...byId.values()].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  cs.degraded = !anySuccess;

  computeRatings(cs);
  generatePredictions(cs, def);
  computeStandings(cs, def);
  cs.lastSyncAt = Date.now();
}

/** Synchronise une compétition, en dédupliquant les appels concurrents. */
export async function ensureSynced(slug: string, force = false): Promise<void> {
  const cs = getCompState(slug);
  if (!force && !isStale(cs)) return;

  const state = getState();
  const existing = state.inflight.get(slug);
  if (existing) return existing;

  const p = syncCompetition(slug)
    .catch((err) => {
      console.error(`[rugby] sync ${slug} échouée:`, err);
      cs.degraded = true;
    })
    .finally(() => {
      state.inflight.delete(slug);
    });
  state.inflight.set(slug, p);
  return p;
}

/** Synchronise toutes les compétitions (pour le endpoint /sync). */
export async function syncAll(): Promise<{ competitions: number; matches: number }> {
  let matches = 0;
  for (const def of RUGBY_COMPETITIONS) {
    await ensureSynced(def.slug, true);
    matches += getCompState(def.slug).matches.length;
  }
  return { competitions: RUGBY_COMPETITIONS.length, matches };
}

/* ------------------------------------------------------------------ */
/* Ratings (Elo + facteurs attaque/défense)                             */
/* ------------------------------------------------------------------ */

function computeRatings(cs: CompetitionState): void {
  const cutoff = Date.now() - RATING_WINDOW_DAYS * 86400000;
  const finished = cs.matches.filter(
    (m) => m.status === "finished" && new Date(m.date).getTime() >= cutoff
  );

  const teamMeta = new Map<string, { name: string; abbreviation: string; logo: string; color: string }>();
  const eloTeams = new Map<string, EloTeam>();
  for (const m of finished) {
    for (const t of [m.home, m.away]) {
      if (!teamMeta.has(t.id)) {
        teamMeta.set(t.id, { name: t.name, abbreviation: t.abbreviation, logo: t.logo, color: t.color });
      }
      if (!eloTeams.has(t.id)) eloTeams.set(t.id, { elo: 1500 });
    }
  }

  // Elo chronologique.
  const sorted = [...finished].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const rawGames: RawGame[] = [];
  const now = Date.now();
  for (const m of sorted) {
    if (m.homeScore === null || m.awayScore === null) continue;
    updateElo(eloTeams, m.home.id, m.away.id, m.homeScore, m.awayScore);
    rawGames.push({
      homeId: m.home.id,
      awayId: m.away.id,
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      ageDays: (now - new Date(m.date).getTime()) / 86400000,
    });
  }

  const factors = computeFactors(eloTeams, rawGames);

  // Bilan + forme.
  const ratings = new Map<string, TeamRating>();
  for (const [teamId, meta] of teamMeta) {
    ratings.set(teamId, {
      teamId,
      name: meta.name,
      abbreviation: meta.abbreviation,
      logo: meta.logo,
      color: meta.color,
      elo: eloTeams.get(teamId)?.elo ?? 1500,
      attack: 1,
      defence: 1,
      gamesPlayed: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      form: "",
      restDays: null,
    });
  }

  const formMap = new Map<string, string[]>();
  const recent = [...finished].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  for (const m of recent) {
    if (m.homeScore === null || m.awayScore === null) continue;
    const home = ratings.get(m.home.id);
    const away = ratings.get(m.away.id);
    if (!home || !away) continue;
    home.gamesPlayed++;
    away.gamesPlayed++;
    home.pointsFor += m.homeScore;
    home.pointsAgainst += m.awayScore;
    away.pointsFor += m.awayScore;
    away.pointsAgainst += m.homeScore;
    if (m.homeScore > m.awayScore) {
      home.wins++;
      away.losses++;
      pushForm(formMap, m.home.id, "W");
      pushForm(formMap, m.away.id, "L");
    } else if (m.homeScore < m.awayScore) {
      away.wins++;
      home.losses++;
      pushForm(formMap, m.home.id, "L");
      pushForm(formMap, m.away.id, "W");
    } else {
      home.draws++;
      away.draws++;
      pushForm(formMap, m.home.id, "D");
      pushForm(formMap, m.away.id, "D");
    }
  }
  for (const [teamId, arr] of formMap) {
    const r = ratings.get(teamId);
    if (r) r.form = arr.slice(0, 5).reverse().join("");
  }

  for (const [teamId, r] of ratings) {
    const f = factors.get(teamId);
    r.attack = f?.attack ?? 1;
    r.defence = f?.defence ?? 1;
  }

  cs.ratings = ratings;
}

function pushForm(map: Map<string, string[]>, teamId: string, ch: string): void {
  const arr = map.get(teamId) ?? [];
  arr.push(ch);
  map.set(teamId, arr);
}

/* ------------------------------------------------------------------ */
/* Moyennes de la compétition                                           */
/* ------------------------------------------------------------------ */

function leagueAverages(cs: CompetitionState): { home: number; away: number } {
  const cutoff = Date.now() - RATING_WINDOW_DAYS * 86400000;
  const finished = cs.matches.filter(
    (m) =>
      m.status === "finished" &&
      m.homeScore !== null &&
      m.awayScore !== null &&
      new Date(m.date).getTime() >= cutoff
  );
  if (!finished.length) return { home: 22, away: 22 };
  const sumH = finished.reduce((s, m) => s + (m.homeScore ?? 0), 0);
  const sumA = finished.reduce((s, m) => s + (m.awayScore ?? 0), 0);
  return { home: sumH / finished.length, away: sumA / finished.length };
}

/* ------------------------------------------------------------------ */
/* Prédictions                                                          */
/* ------------------------------------------------------------------ */

function generatePredictions(cs: CompetitionState, def: CompetitionDef): void {
  const avg = leagueAverages(cs);
  const nowCutoff = Date.now() - 2 * 3600000;
  const upcoming = cs.matches.filter(
    (m) => m.status === "scheduled" && new Date(m.date).getTime() >= nowCutoff
  );

  const predictions = new Map<string, RugbyPrediction>();
  for (const m of upcoming) {
    const home = cs.ratings.get(m.home.id);
    const away = cs.ratings.get(m.away.id);
    if (!home || !away) continue;

    const homeRest = restDaysBefore(m.home.id, m.date, cs.matches);
    const awayRest = restDaysBefore(m.away.id, m.date, cs.matches);
    const h2h = headToHead(m.home.id, m.away.id, cs.matches);
    const counts = h2hCounts(h2h, m.home.id);

    const result = modelMatch({
      homeAttack: home.attack,
      homeDefence: home.defence,
      homeElo: home.elo,
      awayAttack: away.attack,
      awayDefence: away.defence,
      awayElo: away.elo,
      leagueAvgHome: avg.home,
      leagueAvgAway: avg.away,
      neutral: m.neutral,
      homeAdvantage: DEFAULT_CONFIG.homeAdvantage,
      homeRestDays: homeRest,
      awayRestDays: awayRest,
      h2hHomeWins: counts.home,
      h2hAwayWins: counts.away,
      h2hDraws: counts.draws,
    });

    const verdict = computeVerdict(result.homeWinProb, result.awayWinProb, m.home.id, m.away.id);

    predictions.set(m.id, {
      matchId: m.id,
      homeWinProb: result.homeWinProb,
      drawProb: result.drawProb,
      awayWinProb: result.awayWinProb,
      expectedHomeScore: result.expectedHomeScore,
      expectedAwayScore: result.expectedAwayScore,
      expectedMargin: result.expectedMargin,
      mostLikelyScore: result.mostLikelyScore,
      topScores: result.topScores,
      overUnderLines: result.overUnder,
      handicap: result.handicap,
      marginBands: result.marginBands,
      lambdaHome: result.lambdaHome,
      lambdaAway: result.lambdaAway,
      homeElo: home.elo,
      awayElo: away.elo,
      verdict: verdict.label,
      verdictTeamId: verdict.teamId,
      confidence: verdict.confidence,
      adjustments: {
        homeRestDays: homeRest,
        awayRestDays: awayRest,
        restEdge: result.restEdge,
        h2hHomeWins: counts.home,
        h2hAwayWins: counts.away,
        h2hDraws: counts.draws,
        h2hEdge: result.h2hEdge,
      },
    });
  }
  cs.predictions = predictions;
}

/* ------------------------------------------------------------------ */
/* Classement + Monte Carlo                                             */
/* ------------------------------------------------------------------ */

function computeStandings(cs: CompetitionState, def: CompetitionDef): void {
  const ratings = [...cs.ratings.values()];
  if (!ratings.length) {
    cs.standings = [];
    cs.simulatedRuns = 0;
    return;
  }

  // Points actuels (4/2/0 union, 2/1/0 league) depuis les matchs terminés.
  // NB : les bonus union (4 essais+, défaite ≤ 7) nécessitent le détail des
  // essais — indisponible sur le scoreboard ESPN — ils sont ignorés ici et
  // inscrits au backlog (voir .context/rugby-innovation-roadmap.md).
  const isLeague = def.code === "LEAGUE";
  const ptsWin = isLeague ? 2 : 4;
  const ptsDraw = isLeague ? 1 : 2;
  const current = new Map<string, { points: number; pf: number; pa: number }>();
  const cutoff = Date.now() - RATING_WINDOW_DAYS * 86400000;
  for (const m of cs.matches) {
    if (m.status !== "finished" || new Date(m.date).getTime() < cutoff) continue;
    if (m.homeScore === null || m.awayScore === null) continue;
    const h = current.get(m.home.id) ?? { points: 0, pf: 0, pa: 0 };
    const a = current.get(m.away.id) ?? { points: 0, pf: 0, pa: 0 };
    h.pf += m.homeScore;
    h.pa += m.awayScore;
    a.pf += m.awayScore;
    a.pa += m.homeScore;
    if (m.homeScore > m.awayScore) h.points += ptsWin;
    else if (m.homeScore < m.awayScore) a.points += ptsWin;
    else {
      h.points += ptsDraw;
      a.points += ptsDraw;
    }
    current.set(m.home.id, h);
    current.set(m.away.id, a);
  }

  // Fixtures restantes → lambdas pour la simulation.
  const avg = leagueAverages(cs);
  const nowCutoff = Date.now() - 2 * 3600000;
  const fixtures: SimFixture[] = [];
  for (const m of cs.matches) {
    if (m.status !== "scheduled" || new Date(m.date).getTime() < nowCutoff) continue;
    const home = cs.ratings.get(m.home.id);
    const away = cs.ratings.get(m.away.id);
    if (!home || !away) continue;
    const res = modelMatch({
      homeAttack: home.attack,
      homeDefence: home.defence,
      homeElo: home.elo,
      awayAttack: away.attack,
      awayDefence: away.defence,
      awayElo: away.elo,
      leagueAvgHome: avg.home,
      leagueAvgAway: avg.away,
      neutral: m.neutral,
      homeAdvantage: DEFAULT_CONFIG.homeAdvantage,
      homeRestDays: null,
      awayRestDays: null,
      h2hHomeWins: 0,
      h2hAwayWins: 0,
      h2hDraws: 0,
    });
    fixtures.push({ homeId: m.home.id, awayId: m.away.id, lambdaHome: res.lambdaHome, lambdaAway: res.lambdaAway });
  }

  const allTeamIds = [...cs.ratings.keys()];
  let titleChance = new Map<string, number>();
  let runs = 0;
  if (fixtures.length && allTeamIds.length >= 2) {
    const sim = simulateSeason(fixtures, current, allTeamIds, 2000, {
      win: ptsWin,
      draw: ptsDraw,
    });
    for (const [teamId, s] of sim) titleChance.set(teamId, s.titleChance);
    runs = 2000;
  }

  const standings: StandingRow[] = ratings.map((r) => {
    const cur = current.get(r.teamId) ?? { points: 0, pf: 0, pa: 0 };
    return {
      teamId: r.teamId,
      name: r.name,
      abbreviation: r.abbreviation,
      logo: r.logo,
      color: r.color,
      elo: Math.round(r.elo),
      attack: r.attack,
      defence: r.defence,
      gamesPlayed: r.gamesPlayed,
      wins: r.wins,
      draws: r.draws,
      losses: r.losses,
      pointsFor: r.pointsFor,
      pointsAgainst: r.pointsAgainst,
      form: r.form,
      points: cur.points,
      titleChance: titleChance.get(r.teamId) ?? null,
    };
  });
  standings.sort(
    (a, b) => b.points - a.points || (b.pointsFor - b.pointsAgainst) - (a.pointsFor - a.pointsAgainst)
  );

  cs.standings = standings;
  cs.simulatedRuns = runs;
}

/* ------------------------------------------------------------------ */
/* Marqueurs d'essai                                                    */
/* ------------------------------------------------------------------ */

function buildTryScorers(
  cs: CompetitionState,
  def: CompetitionDef,
  match: RugbyMatch,
  prediction: RugbyPrediction
): TryScorerPrediction[] {
  const homeName = match.home.name;
  const awayName = match.away.name;

  const homePlayers = SEED_PLAYERS.filter(
    (p) => p.competitionSlug === def.slug && norm(p.teamName) === norm(homeName)
  ).map((p) => ({
    name: p.name,
    teamId: match.home.id,
    position: p.position,
    triesPerGame: p.tries / Math.max(1, p.games),
    games: p.games,
  }));
  const awayPlayers = SEED_PLAYERS.filter(
    (p) => p.competitionSlug === def.slug && norm(p.teamName) === norm(awayName)
  ).map((p) => ({
    name: p.name,
    teamId: match.away.id,
    position: p.position,
    triesPerGame: p.tries / Math.max(1, p.games),
    games: p.games,
  }));

  const homeDef = cs.ratings.get(match.home.id)?.defence ?? 1;
  const awayDef = cs.ratings.get(match.away.id)?.defence ?? 1;

  // Essais attendus ≈ score attendu / 5,2 points par essai (transformation incluse).
  const homeTries = Math.max(0.5, prediction.expectedHomeScore / 5.2);
  const awayTries = Math.max(0.5, prediction.expectedAwayScore / 5.2);

  const homeScorers = predictTryScorers(homeTries, homePlayers, awayDef);
  const awayScorers = predictTryScorers(awayTries, awayPlayers, homeDef);

  const out: TryScorerPrediction[] = [];
  for (const s of homeScorers) {
    out.push({
      playerName: s.name,
      teamId: s.teamId,
      teamName: homeName,
      position: s.position,
      expectedTries: Math.round(s.expectedTries * 100) / 100,
      anytimeProb: Math.round(s.anytimeProb * 1000) / 1000,
      firstTryProb: Math.round(s.firstTryProb * 1000) / 1000,
      rank: s.rank,
    });
  }
  for (const s of awayScorers) {
    out.push({
      playerName: s.name,
      teamId: s.teamId,
      teamName: awayName,
      position: s.position,
      expectedTries: Math.round(s.expectedTries * 100) / 100,
      anytimeProb: Math.round(s.anytimeProb * 1000) / 1000,
      firstTryProb: Math.round(s.firstTryProb * 1000) / 1000,
      rank: s.rank,
    });
  }
  return out.sort((a, b) => b.anytimeProb - a.anytimeProb);
}

/* ------------------------------------------------------------------ */
/* Lectures publiques (utilisées par le provider)                       */
/* ------------------------------------------------------------------ */

export function readCompState(slug: string): CompetitionState {
  return getCompState(slug);
}

export function readUpcoming(slug: string, limit = 40): PredictedMatch[] {
  const cs = getCompState(slug);
  const nowCutoff = Date.now() - 2 * 3600000;
  const upcoming = cs.matches
    .filter((m) => m.status === "scheduled" && new Date(m.date).getTime() >= nowCutoff)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, limit);
  return upcoming.map((m) => ({ match: m, prediction: cs.predictions.get(m.id) ?? null }));
}

export function readFinished(slug: string, limit = 20): RugbyMatch[] {
  const cs = getCompState(slug);
  return cs.matches
    .filter((m) => m.status === "finished")
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, limit);
}

export function readMatchDetail(slug: string, matchId: string): MatchDetail | null {
  const cs = getCompState(slug);
  const def = COMPETITION_BY_SLUG.get(slug) ?? null;
  const match = cs.matches.find((m) => m.id === matchId);
  if (!match) return null;

  const prediction = cs.predictions.get(matchId) ?? null;
  const h2h = headToHead(match.home.id, match.away.id, cs.matches)
    .filter((m) => m.id !== matchId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 8);

  const tryScorers = prediction && def ? buildTryScorers(cs, def, match, prediction) : [];

  // Le repos calculé pour ce match vit dans prediction.adjustments : on l'injecte
  // dans des clones des ratings (jamais dans les objets partagés du cache —
  // deux requêtes concurrentes pour le même club ne doivent pas se marcher dessus).
  const homeRating = cs.ratings.get(match.home.id)
    ? { ...cs.ratings.get(match.home.id)! }
    : null;
  const awayRating = cs.ratings.get(match.away.id)
    ? { ...cs.ratings.get(match.away.id)! }
    : null;
  if (homeRating && prediction?.adjustments?.homeRestDays != null) {
    homeRating.restDays = prediction.adjustments.homeRestDays;
  }
  if (awayRating && prediction?.adjustments?.awayRestDays != null) {
    awayRating.restDays = prediction.adjustments.awayRestDays;
  }

  return {
    match,
    competition: def,
    prediction,
    homeRating,
    awayRating,
    h2h,
    tryScorers,
  };
}

export function lastSyncAt(slug: string): number {
  return getCompState(slug).lastSyncAt;
}

/** Vrai si la compétition n'a pas été synchronisée depuis CACHE_TTL_MS. */
export function isCompStale(slug: string): boolean {
  return isStale(getCompState(slug));
}

export function isDegraded(slug: string): boolean {
  return getCompState(slug).degraded;
}
