import type { BSDFootballMatch } from "@/lib/bsd-football-fetcher";
import { lookupClubLogo } from "@/lib/club-logos";
import { resolveLeagueLogo } from "@/lib/league-logos";
import { matchForm, scoreFormMatch, expectedMatchCorners } from "@/lib/football-form";
import { matchXg } from "@/lib/football-xg";
import { betminesCornerMarket } from "@/lib/betmines";
import { BSD_ID_TO_SLUG } from "@/lib/league-mapping";
import { dixonColesMarkets } from "@/lib/prediction/football/dixon-coles";

/**
 * Top 5 MATCHS à venir par stratégie de pari. Un match est scoré en croisant la
 * forme récente (5 derniers matchs terminés) de l'équipe à Domicile (contexte
 * home) avec celle de l'équipe à Extérieur (contexte away). Aucun market de
 * cotes requis : tout est dérivé des résultats + stats réelles BSD.
 *
 * Stratégies servies :
 *   - bestTeam     → PPG (pt/match) de la plus forte équipe du match   (plus haut = mieux)
 *   - bestAttack   → Expected Goals du match (λH + λA)                (plus haut = mieux)
 *   - bestDefense  → Équipe la plus étanche (λ encaissés le + bas)    (plus bas = mieux)
 *   - doubleChance → Taux de non-défaite (V+N) équipe la + sûre       (plus haut = mieux)
 *   - over15       → P(≥ 2 buts) via Poisson sur λ                    (plus haut = mieux)
 *   - under35      → P(≤ 3 buts) via Poisson sur λ                    (plus haut = mieux)
 *   - bttsYes      → P(les 2 marquent) via Poisson sur λH, λA         (plus haut = mieux)
 *   - over65Corners→ λ corners attendus du match                    (plus haut = mieux)
 */

export type StrategyTop5Key =
  | "bestTeam"
  | "bestTeam1x2"
  | "gagnant"
  | "bestAttack"
  | "bestDefense"
  | "doubleChance"
  | "over15"
  | "under35"
  | "bttsYes"
  | "over65Corners"
  | "edge1x2Home"
  | "drawValueLigue"
  | "edgeOU25";

export type Side = "home" | "away";

export type StrategySideTeam = {
  teamId: string;
  teamName: string;
  shortName: string;
  logo: string;
  rank?: number | null;
};

/** Stats d'affichage xG/buts (source Understat, contexte Home/Away). */
export type SideFormStats = {
  gp: number;
  xgFor: number;
  xgAgainst: number;
  goalsFor: number;
  goalsAgainst: number;
};

export type MatchDisplayStats = {
  home: { l5: SideFormStats | null; l10: SideFormStats | null };
  away: { l5: SideFormStats | null; l10: SideFormStats | null };
};

export type StrategyMatchEntry = {
  matchId: string;
  league: string;
  /** ID BSD de la ligue (ex: 6 = Ligue 1, 1 = Premier League). Null si inconnu. */
  leagueId?: number | null;
  /** Pays de la ligue (ex: "France", "England"). */
  leagueCountry?: string | null;
  /** URL du logo de la ligue (BSD CDN ou seed statique). */
  leagueLogo?: string | null;
  kickoff: string;
  home: StrategySideTeam;
  away: StrategySideTeam;
  /** Valeur de la stratégie pour ce match (format précis par stratégie côté UI). */
  value: number;
  /** Côté à jouer si la stratégie désigne une équipe (bestTeam/DoubleChance/bestDefense), sinon null. */
  pick: Side | null;
  /** Stats xG/buts L5/L10 Home/Away (null si ligue non couverte par Understat). */
  stats?: MatchDisplayStats | null;
  /** Résumé forme W/D/L des 5 derniers (home + away) pour le form heatmap. */
  formSummary?: { home: string; away: string } | null;
};

export type StrategyTop5 = {
  window: number;
  minPlayed: number;
  strategies: Record<StrategyTop5Key, StrategyMatchEntry[]>;
};

const FORM_WINDOW = 5;
const MIN_PLAYED = 2;

const HIGHER_BETTER: Record<StrategyTop5Key, boolean> = {
  bestTeam: true,
  bestTeam1x2: true,
  gagnant: true,
  bestAttack: true,
  bestDefense: false,
  doubleChance: true,
  over15: true,
  under35: true,
  bttsYes: true,
  over65Corners: true,
  edge1x2Home: true,
  drawValueLigue: true,
  edgeOU25: true,
};

/** Garde en mémoire la liste des stratégies (ordre stable de rendu). */
export const STRATEGY_TOP5_KEYS = Object.keys(HIGHER_BETTER) as StrategyTop5Key[];

type TeamForm = {
  gf: number;
  ga: number;
  corners: number;
};

type TeamFormAgg = {
  n: number;
  wins: number;
  draws: number;
  losses: number;
  gf: number;
  ga: number;
  corners: number;
};

type SideKey = "home" | "away";

function num(v: number | null | undefined): number {
  return v != null && Number.isFinite(v) ? v : 0;
}

function normaliseTeamName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function teamKey(objId: number | undefined, name: string): string {
  return objId != null ? `id:${objId}` : normaliseTeamName(name);
}

function aggForm(form: TeamForm[]): TeamFormAgg {
  let gf = 0,
    ga = 0,
    corners = 0,
    wins = 0,
    draws = 0,
    losses = 0;
  for (const f of form) {
    gf += f.gf;
    ga += f.ga;
    corners += f.corners;
    if (f.gf > f.ga) wins++;
    else if (f.gf === f.ga) draws++;
    else losses++;
  }
  return { n: form.length, wins, draws, losses, gf, ga, corners };
}

/** Convertit un tableau de TeamForm (chronologique) en string W/D/L pour le form heatmap. */
function formToWDL(form: TeamForm[] | null): string {
  if (!form || form.length === 0) return "";
  return form.map((f) => (f.gf > f.ga ? "W" : f.gf === f.ga ? "D" : "L")).join("");
}

function ppg(a: TeamFormAgg): number {
  return a.n > 0 ? (a.wins * 3 + a.draws) / a.n : 0;
}

function nonDefeatRate(a: TeamFormAgg): number {
  return a.n > 0 ? ((a.wins + a.draws) / a.n) * 100 : 0;
}

/** P(X = k) pour une loi de Poisson (λ). */
function poissonPmf(lambda: number, k: number): number {
  let p = Math.exp(-lambda);
  for (let i = 1; i <= k; i++) p *= lambda / i;
  return p;
}

/** P(X ≥ k). */
function poissonTailAt(lambda: number, k: number): number {
  let cdf = 0;
  for (let i = 0; i < k; i++) cdf += poissonPmf(lambda, i);
  return Math.min(1, Math.max(0, 1 - cdf));
}

/** P(X ≥ 1) = 1 − P(X = 0). */
function poissonAtLeastOne(lambda: number): number {
  return 1 - Math.exp(-lambda);
}

type TeamFormRec = { home: TeamForm[]; away: TeamForm[]; all: TeamForm[] };

type FormStore = Map<string, TeamFormRec>;

function buildFormStore(matches: BSDFootballMatch[]): FormStore {
  const store: FormStore = new Map();

  const push = (teamId: string, side: SideKey, form: TeamForm) => {
    let rec = store.get(teamId);
    if (!rec) {
      rec = { home: [], away: [], all: [] };
      store.set(teamId, rec);
    }
    rec[side].push(form);
    rec.all.push(form);
  };

  for (const m of matches) {
    if (m.home_score === null || m.away_score === null) continue;
    const corners = num(m.live_stats?.home?.corner_kicks) + num(m.live_stats?.away?.corner_kicks);
    const homeId = teamKey(m.home_team_obj?.id, m.home_team);
    const awayId = teamKey(m.away_team_obj?.id, m.away_team);
    push(homeId, "home", { gf: m.home_score, ga: m.away_score, corners });
    push(awayId, "away", { gf: m.away_score, ga: m.home_score, corners });
  }

  return store;
}

function recentForm(full: TeamForm[]): TeamForm[] {
  return full.slice(0, FORM_WINDOW);
}

/**
 * Forme d'une équipe pour un contexte donné, avec repli graduel :
 * contexte exact (home/away) → sinon forme globale (tout contexte). Une équipe
 * est considérée comme « disponible » à partir de MIN_PLAYED matchs.
 */
function sideForm(rec: TeamFormRec | undefined, side: SideKey): TeamFormAgg | null {
  if (!rec) return null;
  const exact = rec[side];
  if (exact.length >= MIN_PLAYED) return aggForm(recentForm(exact));
  if (rec.all.length >= MIN_PLAYED) return aggForm(recentForm(rec.all));
  return null;
}

function formFor(store: FormStore, match: BSDFootballMatch): { home: TeamFormAgg; away: TeamFormAgg } | null {
  const home = sideForm(store.get(teamKey(match.home_team_obj?.id, match.home_team)), "home");
  const away = sideForm(store.get(teamKey(match.away_team_obj?.id, match.away_team)), "away");
  if (!home || !away) return null;
  return { home, away };
}

/** Retourne la forme brute (5 derniers matchs) pour le heatmap chronologique. */
function rawFormFor(store: FormStore, match: BSDFootballMatch): { home: TeamForm[]; away: TeamForm[] } | null {
  const homeRec = store.get(teamKey(match.home_team_obj?.id, match.home_team));
  const awayRec = store.get(teamKey(match.away_team_obj?.id, match.away_team));
  if (!homeRec || !awayRec) return null;
  const homeExact = homeRec.home;
  const homeAll = homeRec.all;
  const awayExact = awayRec.home;
  const awayAll = awayRec.away;
  const homeRaw = homeExact.length >= MIN_PLAYED ? recentForm(homeExact) : homeAll.length >= MIN_PLAYED ? recentForm(homeAll) : null;
  const awayRaw = awayExact.length >= MIN_PLAYED ? recentForm(awayExact) : awayAll.length >= MIN_PLAYED ? recentForm(awayAll) : null;
  if (!homeRaw || !awayRaw) return null;
  return { home: homeRaw, away: awayRaw };
}

function teamRow(match: BSDFootballMatch, side: Side): StrategySideTeam {
  const obj = side === "home" ? match.home_team_obj : match.away_team_obj;
  const name = side === "home" ? match.home_team : match.away_team;
  return {
    teamId: teamKey(obj?.id, name),
    teamName: name,
    shortName: obj?.short_name || name,
    logo: lookupClubLogo(name) ?? "",
  };
}

type ScoredMatch = {
  fixture: BSDFootballMatch;
  form: { home: TeamFormAgg; away: TeamFormAgg } | null;
  /** Forme brute (5 derniers matchs) pour le form heatmap chronologique. */
  rawForm?: { home: TeamForm[]; away: TeamForm[] } | null;
  value: number;
  pick: Side | null;
};

/**
 * Probabilités justes (de-vig) dérivées des cotes du book, si présentes.
 * Retourne null si le fixture ne porte pas les cotes requises.
 */
function fairProbs(m: BSDFootballMatch): { home: number; draw: number; away: number } | null {
  const h = m.odds_home;
  const d = m.odds_draw;
  const a = m.odds_away;
  if (h == null || d == null || a == null || h <= 1 || d <= 1 || a <= 1) return null;
  const ih = 1 / h;
  const id = 1 / d;
  const ia = 1 / a;
  const vig = ih + id + ia;
  if (vig <= 0) return null;
  return { home: ih / vig, draw: id / vig, away: ia / vig };
}

/** Probabilité juste d'un marché Over/BTTS depuis une cote décimale (1/odds normé vs la cote inverse). */
function impliedProb(over: number | null | undefined, under: number | null | undefined): number | null {
  if (over == null || under == null || over <= 1 || under <= 1) return null;
  const io = 1 / over;
  const iu = 1 / under;
  const vig = io + iu;
  if (vig <= 0) return null;
  return (io / vig) * 100;
}

/** Scor un match à partir des seules cotes (repli quand la forme L5 est indisponible). */
function scoreMatchByOdds(key: StrategyTop5Key, m: BSDFootballMatch): { value: number; pick: Side | null } | null {
  const p = fairProbs(m);
  switch (key) {
    case "bestTeam":
    case "bestTeam1x2": {
      if (!p) return null;
      const isHome = (p.home as number) >= (p.away as number);
      return { value: Math.max(p.home, p.away) * 100, pick: isHome ? "home" : "away" };
    }
    case "bestAttack":
    case "bestDefense": {
      // Non distinguables par les cotes seules : on cède à la forme sinon null.
      return null;
    }
    case "doubleChance": {
      if (!p) return null;
      const homeDC = (p.home + p.draw) * 100;
      const awayDC = (p.away + p.draw) * 100;
      return { value: Math.max(homeDC, awayDC), pick: homeDC >= awayDC ? "home" : "away" };
    }
    case "over15": {
      const prob = impliedProb(m.odds_over_15, m.odds_under_15);
      return prob != null ? { value: prob, pick: null } : null;
    }
    case "under35": {
      // 1er arg = côté dont on veut la proba (ici under) — devig symétrique.
      const prob = impliedProb(m.odds_under_35, m.odds_over_35);
      return prob != null ? { value: prob, pick: null } : null;
    }
    case "bttsYes": {
      const prob = impliedProb(m.odds_btts_yes, m.odds_btts_no);
      return prob != null ? { value: prob, pick: null } : null;
    }
    case "over65Corners":
      // Pas de cotes corners exposées sur les fixtures → indisponible.
      return null;
    case "edge1x2Home": {
      if (!p) return null;
      const edge = p.home - (p.away + p.draw) / 2;
      return edge > 0 ? { value: edge * 100, pick: "home" } : null;
    }
    case "drawValueLigue": {
      if (!p) return null;
      // Sans pool on ne peut pas comparer → retourne null (repli forme).
      return null;
    }
    case "edgeOU25": {
      if (m.odds_over_25 == null || m.odds_over_25 > 2.5) return null;
      const oddsO = m.odds_over_25;
      const oddsU = m.odds_under_25;
      if (oddsO <= 1 || oddsU == null || oddsU <= 1) return null;
      const io = 1 / oddsO;
      const iu = 1 / oddsU;
      const vig = io + iu;
      if (vig <= 0) return null;
      const fairOver = io / vig;
      // Pas de Poisson sans forme : edge = 50% - fairOver (proxy grossier).
      const edge = 0.5 - fairOver;
      return edge > 0 ? { value: edge * 100, pick: "home" } : null;
    }
    default:
      return null;
  }
}

/** Scor un match pour une stratégie (croise forme home du recevant + away du visiteur). */
function scoreMatch(key: StrategyTop5Key, m: { home: TeamFormAgg; away: TeamFormAgg }): { value: number; pick: Side | null } {
  const h = m.home;
  const a = m.away;
  const nH = Math.max(h.n, 1);
  const nA = Math.max(a.n, 1);
  const lambdaHome = (h.gf / nH + a.ga / nA) / 2;
  const lambdaAway = (a.gf / nA + h.ga / nH) / 2;
  const lambdaTotal = lambdaHome + lambdaAway;
  const lambdaCorners = (h.corners / nH + a.corners / nA) / 2;

  switch (key) {
    case "bestTeam":
    case "bestTeam1x2": {
      const hp = ppg(h);
      const ap = ppg(a);
      return { value: Math.max(hp, ap), pick: hp >= ap ? "home" : "away" };
    }
    case "gagnant": {
      // Repli exhaustif TS : le scoring réel est intercepté plus tôt par la
      // branche dédiée de computeStrategyTop5Matches (exclusion nul modal).
      const mkG = dixonColesMarkets(lambdaHome, lambdaAway);
      const maxWinG = Math.max(mkG.homeWin, mkG.awayWin);
      if (mkG.draw >= maxWinG) return { value: -Infinity, pick: null };
      // Markets en pourcentages (Σ1X2 = 100) — pas de ×100.
      return { value: maxWinG, pick: mkG.homeWin >= mkG.awayWin ? "home" : "away" };
    }
    case "bestAttack":
      return { value: lambdaTotal, pick: null };
    case "bestDefense": {
      // On garde l'équipe qui encaisse le moins (λ encaissés relatif le plus bas).
      const hAgainst = h.ga / nH;
      const aAgainst = a.ga / nA;
      return { value: Math.min(hAgainst, aAgainst), pick: hAgainst <= aAgainst ? "home" : "away" };
    }
    case "doubleChance": {
      const hRate = nonDefeatRate(h);
      const aRate = nonDefeatRate(a);
      return { value: Math.max(hRate, aRate), pick: hRate >= aRate ? "home" : "away" };
    }
    case "over15":
      return { value: poissonTailAt(lambdaTotal, 2) * 100, pick: null };
    case "under35":
      return { value: (1 - poissonTailAt(lambdaTotal, 4)) * 100, pick: null };
    case "bttsYes":
      return { value: poissonAtLeastOne(lambdaHome) * poissonAtLeastOne(lambdaAway) * 100, pick: null };
    case "over65Corners":
      return { value: poissonTailAt(lambdaCorners, 7) * 100, pick: null };
    case "edge1x2Home": {
      // Poisson home advantage : lambdaHome vs lambdaAway — home side si favorable.
      const homeAdv = lambdaHome - lambdaAway;
      return { value: Math.abs(homeAdv), pick: homeAdv >= 0 ? "home" : "away" };
    }
    case "drawValueLigue": {
      // Sans odds on ne peut pas comparer au marché → retourne 0 (sera filtré par odds fallback).
      return { value: 0, pick: null };
    }
    case "edgeOU25": {
      const pOver = 1 - poissonTailAt(lambdaTotal, 3);
      return { value: pOver * 100, pick: null };
    }
  }
}

type LeaguePoolStats = {
  n: number;
  draws: number;
  drawRate: number;
  totalGoals: number;
  goalsPerMatch: number;
};

function computeLeaguePoolStats(pool: BSDFootballMatch[]): Map<string, LeaguePoolStats> {
  const map = new Map<string, LeaguePoolStats>();
  for (const m of pool) {
    if (m.home_score == null || m.away_score == null) continue;
    const league = m.league?.name ?? "unknown";
    let s = map.get(league);
    if (!s) {
      s = { n: 0, draws: 0, drawRate: 0, totalGoals: 0, goalsPerMatch: 0 };
      map.set(league, s);
    }
    s.n++;
    if (m.home_score === m.away_score) s.draws++;
    s.totalGoals += m.home_score + m.away_score;
  }
  for (const s of map.values()) {
    s.drawRate = s.n > 0 ? s.draws / s.n : 0;
    s.goalsPerMatch = s.n > 0 ? s.totalGoals / s.n : 0;
  }
  return map;
}

/**
 * Calcule le Top 5 matchs à venir par stratégie.
 *
  * @param finished matchs terminés (source de la forme L5 Home/Away)
 * @param fixtures matchs planifiés (notstarted) à classer
 * @param opts options de calcul (limit = top N par stratégie ; league = filtre un championnat)
 */
export interface ComputeTop5Options {
  /** Nombre d'entrées par stratégie (5 = top5 historique/backtest, 10 = top10 widget central). */
  limit?: number;
  /** Si fourni, ne classe que les matchs du championnat (nom de ligue BSD). */
  league?: string;
}

export function computeStrategyTop5Matches(
  finished: BSDFootballMatch[],
  fixtures: BSDFootballMatch[],
  opts: ComputeTop5Options = {},
): StrategyTop5 {
  const store = buildFormStore(finished);
  const leaguePoolStats = computeLeaguePoolStats(finished);

  const scores = {} as Record<StrategyTop5Key, ScoredMatch[]>;
  for (const key of STRATEGY_TOP5_KEYS) scores[key] = [];

    for (const fixture of fixtures) {
    if (fixture.status !== "notstarted") continue;
    // Top 10 par championnat (widget central) : filtrer avant le scoring.
    if (opts.league && fixture.league?.name !== opts.league) continue;
    const form = formFor(store, fixture);
    const leagueSlug = BSD_ID_TO_SLUG[fixture.league?.id ?? -1];
    const soccerForm = leagueSlug ? matchForm(leagueSlug, fixture) : null;

    for (const key of STRATEGY_TOP5_KEYS) {
      // bestAttack / bestDefense : priorité à la forme soccerstats réelle,
      // sinon forme dérivée BSD, sinon cotes.
      if (soccerForm && (key === "bestAttack" || key === "bestDefense")) {
        const s = scoreFormMatch(soccerForm);
        if (key === "bestAttack") {
          scores[key].push({ fixture, form, value: s.bestAttack, pick: null });
        } else {
          scores[key].push({ fixture, form, value: s.bestDefense, pick: s.defensePick });
        }
        continue;
      }

      // over65Corners : modèle corners dérivé de la forme soccerstats (λCorners),
      // sinon par Poisson sur la forme BSD, sinon cotes (indisponibles → skip).
      if (key === "over65Corners") {
        // Priorité 1 : marché CORNERS réel BetMines (cotes O/U dé-vigées → λ).
        const bmLeagueSlug = leagueSlug;
        const bm = betminesCornerMarket(bmLeagueSlug, fixture);
        if (bm) {
          scores[key].push({ fixture, form, value: bm.lambdaCorners, pick: null });
          continue;
        }
        // Priorité 2 : modèle corners dérivé de la forme soccerstats.
        if (soccerForm) {
          scores[key].push({ fixture, form, value: expectedMatchCorners(soccerForm), pick: null });
          continue;
        }
        // Priorité 3 : corners réels des matchs finis BSD.
        if (form) {
          const nH = Math.max(form.home.n, 1);
          const nA = Math.max(form.away.n, 1);
          const lambdaCorners = (form.home.corners / nH + form.away.corners / nA) / 2;
          scores[key].push({ fixture, form, value: lambdaCorners, pick: null });
          continue;
        }
        continue;
      }

      // bestTeam1x2 : stratégie « meilleure équipe sur le 1X2 » — probabilité
      // de victoire du favori dérivée des cotes 1X2 (de-vig). Toujours cotes.
      if (key === "bestTeam1x2") {
        const scored = scoreMatchByOdds("bestTeam", fixture);
        if (!scored) continue;
        scores[key].push({ fixture, form, value: scored.value, pick: scored.pick });
        continue;
      }

      // gagnant : Dixon-Coles 1997 sur λ forme L5 — vainqueur prédit = max
      // P(dom)/P(ext) ; match écarté si le nul est l'issue modale (pas de
      // gagnant fiable). Zéro dépendance cotes (classement confiance modèle).
      if (key === "gagnant") {
        if (!form) continue;
        const nHg = Math.max(form.home.n, 1);
        const nAg = Math.max(form.away.n, 1);
        const lambdaHg = (form.home.gf / nHg + form.away.ga / nAg) / 2;
        const lambdaAg = (form.away.gf / nAg + form.home.ga / nHg) / 2;
        const mk = dixonColesMarkets(lambdaHg, lambdaAg);
        const maxWin = Math.max(mk.homeWin, mk.awayWin);
        if (mk.draw >= maxWin) continue;
        scores[key].push({
          fixture,
          form,
          value: maxWin, // Markets DC déjà en %
          pick: mk.homeWin >= mk.awayWin ? "home" : "away",
        });
        continue;
      }

      // edge1x2Home : avantage domicile Poisson — compare proba home dé-viggée
      // au taux moyen de victoire à domicile du pool (walk-forward, pas d'enrichissement ligue).
      if (key === "edge1x2Home") {
        const oddsH = fixture.odds_home;
        const oddsD = fixture.odds_draw;
        const oddsA = fixture.odds_away;
        if (oddsH == null || oddsD == null || oddsA == null || oddsH <= 1 || oddsD <= 1 || oddsA <= 1) continue;
        const rawH = 1 / oddsH;
        const rawD = 1 / oddsD;
        const rawA = 1 / oddsA;
        const vig = rawH + rawD + rawA;
        if (vig <= 0) continue;
        const fairHome = rawH / vig;
        // Taux home moyen du pool (tous matchs finis, walk-forward safe).
        let poolHomeWins = 0;
        let poolTotal = 0;
        for (const pm of finished) {
          if (pm.home_score == null || pm.away_score == null) continue;
          poolTotal++;
          if (pm.home_score > pm.away_score) poolHomeWins++;
        }
        if (poolTotal === 0) continue;
        const poolHomeRate = poolHomeWins / poolTotal;
        const edge = fairHome - poolHomeRate;
        if (edge > 0) {
          scores[key].push({ fixture, form, value: edge * 100, pick: "home" });
        }
        continue;
      }

      // drawValueLigue : taux de nul de la ligue dans le pool vs marché dé-viggé.
      // Pick draw si le taux ligue > marché de plus de 5%.
      if (key === "drawValueLigue") {
        const oddsH = fixture.odds_home;
        const oddsD = fixture.odds_draw;
        const oddsA = fixture.odds_away;
        if (oddsH == null || oddsD == null || oddsA == null || oddsH <= 1 || oddsD <= 1 || oddsA <= 1) continue;
        const rawH = 1 / oddsH;
        const rawD = 1 / oddsD;
        const rawA = 1 / oddsA;
        const vig = rawH + rawD + rawA;
        if (vig <= 0) continue;
        const fairDraw = rawD / vig;
        const league = fixture.league?.name ?? "unknown";
        const lps = leaguePoolStats.get(league);
        if (!lps || lps.n < 10) continue;
        const diff = lps.drawRate - fairDraw;
        if (diff > 0.05) {
          scores[key].push({ fixture, form, value: diff * 100, pick: null });
        }
        continue;
      }

      // edgeOU25 : Poisson λ total vs marché O/U 2.5. Skip si odds_over_25 null ou > 2.5.
      if (key === "edgeOU25") {
        if (fixture.odds_over_25 == null || fixture.odds_over_25 > 2.5) continue;
        const oddsO = fixture.odds_over_25;
        const oddsU = fixture.odds_under_25;
        if (oddsO <= 1 || oddsU == null || oddsU <= 1) continue;
        const rawO = 1 / oddsO;
        const rawU = 1 / oddsU;
        const vig = rawO + rawU;
        if (vig <= 0) continue;
        const fairOver = rawO / vig;
        // Poisson λ total depuis la forme BSD (pool-only).
        if (form) {
          const nH = Math.max(form.home.n, 1);
          const nA = Math.max(form.away.n, 1);
          const lambdaHome = (form.home.gf / nH + form.away.ga / nA) / 2;
          const lambdaAway = (form.away.gf / nA + form.home.ga / nH) / 2;
          const lambdaTotal = lambdaHome + lambdaAway;
          const pOver = 1 - poissonTailAt(lambdaTotal, 3);
          const edge = pOver - fairOver;
          if (edge > 0) {
            scores[key].push({ fixture, form, value: edge * 100, pick: "home" });
          }
        } else {
          // Repli cotes : edge basé sur la cote seule (pas de Poisson sans forme).
          const edge = 0.5 - fairOver;
          if (edge > 0) {
            scores[key].push({ fixture, form: null, value: edge * 100, pick: "home" });
          }
        }
        continue;
      }

      if (form) {
        const { value, pick } = scoreMatch(key, form);
        scores[key].push({ fixture, form, value, pick });
      } else {
        // Pas de forme L5 exploitable : repli sur les cotes embarquées du fixture.
        const scored = scoreMatchByOdds(key, fixture);
        if (!scored) continue;
        scores[key].push({ fixture, form: null, value: scored.value, pick: scored.pick });
      }
    }
  }

  // Plancher de cotes : au-delà de ~87% de proba implicite, la cote équitable
  // passe sous 1.15 — aucun intérêt à parier, on exclut le match de la liste.
  // (bestAttack/bestDefense/over65Corners = λ moyens, pas des probabilités
  // marché → hors périmètre. over65Corners est classé par λ corners : le
  // filtrer comme une proba saturée (~90% sur O6.5) inverserait le signal.)
  const MAX_PROB_PCT = (1 / 1.15) * 100;
  const PROBABILISTIC_KEYS: ReadonlySet<StrategyTop5Key> = new Set([
    "bestTeam",
    "bestTeam1x2",
    "gagnant",
    "doubleChance",
    "over15",
    "under35",
    "bttsYes",
    "edge1x2Home",
    "drawValueLigue",
    "edgeOU25",
  ]);
  for (const key of STRATEGY_TOP5_KEYS) {
    if (!PROBABILISTIC_KEYS.has(key)) continue;
    scores[key] = scores[key].filter((s) => s.value < MAX_PROB_PCT);
  }

  // Stats d'affichage xG/buts L5/L10 (Understat) — calculées une fois par fixture.
  const xgByFixture = new Map<string, MatchDisplayStats | null>();
  for (const key of STRATEGY_TOP5_KEYS) {
    for (const s of scores[key]) {
      const id = String(s.fixture.id);
      if (!xgByFixture.has(id)) {
        const leagueSlug = BSD_ID_TO_SLUG[s.fixture.league?.id ?? -1];
        xgByFixture.set(id, matchXg(leagueSlug, s.fixture));
      }
    }
  }

  const strategies = {} as Record<StrategyTop5Key, StrategyMatchEntry[]>;
  for (const key of STRATEGY_TOP5_KEYS) {
    const higher = HIGHER_BETTER[key];
    const list = scores[key];
    list.sort((a, b) => (higher ? b.value - a.value : a.value - b.value));
    strategies[key] = list.slice(0, opts.limit ?? 5).map((s) => {
      const league = s.fixture.league ?? {};
      const leagueId = league.id ?? null;
      const leagueCountry = league.country ?? null;
      const leagueLogo = resolveLeagueLogo(league.name ?? "", leagueId);
      return ({
        matchId: String(s.fixture.id),
        league: s.fixture.league?.name ?? "",
        leagueId,
        leagueCountry,
        leagueLogo,
        kickoff: s.fixture.event_date,
        home: teamRow(s.fixture, "home"),
        away: teamRow(s.fixture, "away"),
        value: Math.round(s.value * 100) / 100,
        pick: s.pick,
        stats: xgByFixture.get(String(s.fixture.id)) ?? null,
        formSummary: (() => {
          const rf = rawFormFor(store, s.fixture);
          return rf ? { home: formToWDL(rf.home), away: formToWDL(rf.away) } : null;
        })(),
      });
    });
  }

  return { window: FORM_WINDOW, minPlayed: MIN_PLAYED, strategies };
}
