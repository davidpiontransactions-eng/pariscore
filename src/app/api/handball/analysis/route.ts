// GET /api/handball/analysis?home=…&away=…&league=…&date=…
//
// Analyse prématch handball « au clic » d'une ligne du calendrier :
//   1. échelle Over complète 59.5 → 52.5 (P(total > ligne), seuil 55 %) ;
//   2. 1X2 du modèle (Skellam) ;
//   3. profils équipes documentés : winrate global/Home/Away, buts marqués et
//      encaissés L5/L10 en situation Home ET Away, différence de buts,
//      forme PPG L5/L10 Home/Away, séquence des 5 derniers ;
//   4. 2 meilleurs buteurs par équipe avec P(au moins 2/3/4/5 buts).
//
// Sources : table `handball_match_history` (pariscore.db, cron hebdo) pour
// les stats d'équipe + snapshots hbl_players/lnh_players pour les buteurs.
// Aucune donnée inventée : équipe inconnue → stats null (l'UI affiche « — »).

import { NextResponse } from "next/server";
import {
  DEFAULT_OVER_LINES,
  PROB_FLOOR,
  computeTeamStats,
  fitNu,
  matchModel,
  meanTotal,
  overLadder,
  pickPlayableLine,
  scorerProbs,
  teamKey,
  resolveTeamKey,
  type OverLine,
  type ScorerThreshold,
  type TeamHistoryStats,
} from "@/lib/handball-history-stats";
import { historyMeta, listTeamKeys, loadRecentTotals, loadTeamRows } from "@/lib/handball-history-db";
import { loadHandballPlayers, playersForLeague, topPlayersForTeam } from "@/lib/handball-players";
import { skellamMatchProbs } from "@/lib/handball-skellam";
import {
  findLnhRow,
  loadLnhStanding,
  loadLnhTeamStats,
  type LnhMetricDef,
} from "@/lib/lnh-stats";
import { handballPlayerPhoto } from "@/lib/handball-photos";

/** Base points documentée (demande utilisateur). */
const BASE_TOTAL = 60;
/** Fenêtre de calibration de la moyenne observée (jours). */
const CALIBRATION_DAYS = 30;

// Lecture VIVANTE obligatoire : sans ça, Next peut prérendre le GET au build
// (table absente à cet instant → meta/teams figés à null dans le bundle,
// symptomatique observé en prod le 2026-09-25). Le cron hebdo modifie la DB
// après coup : la réponse doit être calculée à chaque requête.
export const dynamic = "force-dynamic";

type ScorerView = {
  name: string;
  team: string;
  goals: number;
  games: number;
  avgGoals: number;
  /** λ ajusté au rythme du match (buts attendus du joueur). */
  lambda: number;
  probs: ScorerThreshold[];
  /** Photo joueur (snapshot Wikipedia) — null → initiales côté UI. */
  photoUrl: string | null;
};

/** Vue StarLigue d'une équipe : classement + 5 métriques (snapshot LNH). */
export type StarLigueSide = {
  team: string;
  /** Matchs joués (snapshot stats). */
  played: number | null;
  standing: {
    rank: number;
    points: number;
    played: number;
    wins: number;
    draws: number;
    losses: number;
    goalsFor: number;
    goalsAgainst: number;
    goalDiff: number;
  } | null;
  metrics: { key: string; label: string; total: number | null; avg: number | null }[];
};

export type HandballAnalysisPayload = {
  ok: boolean;
  match: { home: string; away: string; date: string | null; league: string | null };
  meta: ReturnType<typeof historyMeta>;
  model: {
    base: number;
    /** Moyenne observée sur la fenêtre de calibration. */
    observedMean: number | null;
    /** Facteur de calibration appliqué. */
    scale: number;
    lambdaH: number;
    lambdaA: number;
    nu: number;
    expectedTotal: number;
  };
  over: {
    floor: number;
    lines: OverLine[];
    pick: OverLine | null;
  };
  match1x2: { home: number; draw: number; away: number };
  teams: { home: TeamHistoryStats | null; away: TeamHistoryStats | null };
  /** Stats StarLigue (snapshots LNH) — null si les 2 équipes sont hors ligue. */
  starligue: {
    season: string | null;
    scrapedAt: string | null;
    metrics: LnhMetricDef[];
    home: StarLigueSide | null;
    away: StarLigueSide | null;
  } | null;
  scorers: { home: ScorerView[]; away: ScorerView[] };
  method: string[];
};

function pct(v: number): number {
  return Math.round(v * 1000) / 10;
}

/** Top-N buteurs de champ d'une équipe (repli « dernier mot du nom »). */
function topScorers(name: string, league: string, n: number): {
  name: string;
  team: string;
  goals: number;
  games: number;
  avgGoals: number;
}[] {
  const snap = playersForLeague(loadHandballPlayers(), league);
  let field = topPlayersForTeam(snap, name, 5).field;
  if (!field.length) {
    const lastWord = name.trim().split(/\s+/).pop() ?? "";
    if (lastWord.length >= 4 && lastWord !== name) {
      field = topPlayersForTeam(snap, lastWord, 5).field;
    }
  }
  return field.slice(0, n).map((p) => ({
    name: p.name,
    team: p.team,
    goals: p.goals,
    games: p.games,
    avgGoals: p.avgGoals ?? (p.games > 0 ? p.goals / p.games : 0),
  }));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const home = searchParams.get("home") ?? "";
  const away = searchParams.get("away") ?? "";
  const league = searchParams.get("league") ?? "";
  const date = searchParams.get("date");

  if (!home || !away) {
    return NextResponse.json({ ok: false, error: "home/away requis" }, { status: 400 });
  }

  // 1. Résolution des clés d'équipe (exacte puis approximative) -------------
  const keys = listTeamKeys();
  const homeKey = resolveTeamKey(keys, home) ?? teamKey(home);
  const awayKey = resolveTeamKey(keys, away) ?? teamKey(away);

  // 2. Historique des équipes + calibration ---------------------------------
  const rows = loadTeamRows(homeKey, awayKey);
  const recent = loadRecentTotals(CALIBRATION_DAYS);
  const observedMean = meanTotal(recent);
  const scale = observedMean && observedMean > 0 ? BASE_TOTAL / observedMean : 1;
  // ν : fité sur les matchs des DEUX équipes (même championnat → échantillon
  // homogène). Les totaux mondiaux des 30 j agrègent des ligues hétérogènes
  // (var/mean 1.24 par mixture) et poussent ν dans le plancher.
  const nu = fitNu(rows.length >= 30 ? rows : recent).nu;

  const homeStats = computeTeamStats(rows, homeKey, home);
  const awayStats = computeTeamStats(rows, awayKey, away);

  // 3. Modèle du match + échelle Over + 1X2 ---------------------------------
  // Calibration : base 60 / moyenne observée (fenêtre 30 j) ; moyenne
  // équipe mondiale = moitié du total observé (≈ 29.6 buts/équipe).
  const model = matchModel(homeStats, awayStats, scale, observedMean ? observedMean / 2 : undefined);
  const lines = overLadder(model.lambdaH, nu, model.lambdaA, nu, DEFAULT_OVER_LINES);
  const pick = pickPlayableLine(lines);
  const p1x2 = skellamMatchProbs(model.lambdaH, model.lambdaA);

  // 4. Buteurs (2 par équipe) -----------------------------------------------
  const scorers = (side: "home" | "away"): ScorerView[] => {
    const name = side === "home" ? home : away;
    const lambda = side === "home" ? model.lambdaH : model.lambdaA;
    return topScorers(name, league, 2).map((p) => {
      const { lambda: playerLambda, probs } = scorerProbs(p.avgGoals, lambda);
      return { ...p, lambda: playerLambda, probs, photoUrl: handballPlayerPhoto(p.name) };
    });
  };

  // 5. StarLigue : classement + 5 métriques par équipe (snapshots LNH) ----
  const lnhTeamStats = loadLnhTeamStats();
  const lnhStanding = loadLnhStanding();
  const lnhSide = (name: string): StarLigueSide | null => {
    const stats = findLnhRow(lnhTeamStats?.teams, name);
    const standing = findLnhRow(lnhStanding?.standing, name);
    if (!stats && !standing) return null;
    return {
      team: stats?.team ?? standing?.team ?? name,
      played: stats?.played ?? standing?.played ?? null,
      standing: standing
        ? {
            rank: standing.rank,
            points: standing.points,
            played: standing.played,
            wins: standing.wins,
            draws: standing.draws,
            losses: standing.losses,
            goalsFor: standing.goals_for,
            goalsAgainst: standing.goals_against,
            goalDiff: standing.goal_diff,
          }
        : null,
      metrics: (lnhTeamStats?.metrics ?? []).map((def) => ({
        key: def.key,
        label: def.label,
        total: stats?.metrics[def.key]?.total ?? null,
        avg: stats?.metrics[def.key]?.avg ?? null,
      })),
    };
  };
  const homeLnh = lnhSide(home);
  const awayLnh = lnhSide(away);
  const starligue =
    homeLnh || awayLnh
      ? {
          season: lnhTeamStats?.season ?? lnhStanding?.season ?? null,
          scrapedAt: lnhTeamStats?.scraped_at ?? lnhStanding?.scraped_at ?? null,
          metrics: lnhTeamStats?.metrics ?? [],
          home: homeLnh,
          away: awayLnh,
        }
      : null;

  const payload: HandballAnalysisPayload = {
    ok: true,
    match: { home, away, date: date ?? null, league: league || null },
    meta: historyMeta(),
    model: {
      base: BASE_TOTAL,
      observedMean,
      scale: Math.round(scale * 1000) / 1000,
      lambdaH: model.lambdaH,
      lambdaA: model.lambdaA,
      nu: Math.round(nu * 1000) / 1000,
      expectedTotal: model.expectedTotal,
    },
    over: { floor: PROB_FLOOR, lines, pick },
    match1x2: { home: pct(p1x2.home), draw: pct(p1x2.draw), away: pct(p1x2.away) },
    teams: { home: homeStats, away: awayStats },
    starligue,
    scorers: { home: scorers("home"), away: scorers("away") },
    method: [
      `Historique : table handball_match_history (Base ${observedMean ?? "—"} pts observés sur ${CALIBRATION_DAYS} j, calibration ×${Math.round(scale * 1000) / 1000} → base ${BASE_TOTAL} pts).`,
      `λ équipe : CMP sur 10 derniers matchs (Felice & Ley) + avantage domicile 1.8 but ; 1X2 = Skellam.`,
      `Échelle Over : P(total > ligne) de ${DEFAULT_OVER_LINES[0]} à ${DEFAULT_OVER_LINES[DEFAULT_OVER_LINES.length - 1]} (pas de 1 but, couvre les écarts 2/3 buts) — jouable si ≥ ${Math.round(PROB_FLOOR * 100)} %.`,
      `Splits documentés : buts marqués/encaissés et PPG sur L5 et L10, en situation Home (l'équipe reçoit) et Away (l'équipe est reçue) ; différence = marqués − encaissés.`,
      `Buteurs : queue de Poisson sur la moyenne du joueur (snapshot HBL + StarLigue), λ ajusté au rythme attendu de l'équipe (×0.75 à ×1.35).`,
      starligue
        ? `StarLigue (lnh.fr, saison ${starligue.season ?? "?"}) : classement + 5 métriques/équipe (buts marqués, encaissés, arrêts, passes, pertes de balles) — snapshot ${starligue.scrapedAt ?? "?"}.`
        : "StarLigue : équipes hors snapshots LNH (les stats proviennent de l'historique DB et des buteurs).",
      `Mise à jour : cron hebdomadaire (lundi) — scripts/scrape-handball-history.mjs.`,
    ],
  };

  return NextResponse.json(payload, {
    headers: { "Cache-Control": "public, max-age=600" },
  });
}
