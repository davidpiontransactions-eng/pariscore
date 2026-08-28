// BSD Sports API fetcher — tennis matches from sports.bzzoiro.com
// Priority source: BSD > The Odds API > Mock
//
// V2 (2026-07-26) : le fetch brut est délégué à bsd-tennis-service.ts.
// Ce fichier ne garde que la couche de transformation BSDMatch → TennisMatch
// (avec enrichissement Elo, prédictions, stats).

import type { TennisMatch, BookmakerOdd, Player, Surface, MatchStats } from "@/lib/tennis-data";
import type { BSDMatch, BSDLiveMatch } from "@/lib/bsd-tennis-service";
import { fetchMatches, fetchLiveMatches, getPlayerPhotoUrl } from "@/lib/bsd-tennis-service";
import { predict, formScore, type PlayerInputs, type MatchOutcome } from "@/lib/prediction/engine";
import { predictTotalGames, type PredictionSurface } from "@/lib/prediction/total-games";
import { predictMostAces, type AcesStats } from "@/lib/prediction/most-aces";
import { findPlayerElo } from "@/lib/player-matcher";
import { lookupAbstractElo } from "@/lib/tennis-elo/lookup";
import { lookupServeStats } from "@/lib/tennis-dr/lookup";
import { resolvePlayerPhoto } from "@/lib/player-photos";
import { resolvePlayerCountry } from "@/lib/tennis-player-country";
import { resolveTournamentCategory, resolveTournamentPriority } from "@/lib/tournament-priority";
import { getPlayerStatsBatch } from "@/lib/tennis-stats/db";
import { computeMomentumScore } from "@/lib/momentum-score";

/** Mappe la surface UI (français) → surface du modèle total-games (anglais DB). */
function toModelSurface(s: Surface): PredictionSurface {
  if (s === "Gazon") return "Grass";
  if (s === "Terre battue") return "Clay";
  return "Hard";
}

/** Tournois à exclure (UTR Pro, exhibitions) */
const EXCLUDED_TOURNAMENTS = [/utr/i, /exhibition/i, /expo/i, /hopman/i, /laver\s*cup/i];

function isExcludedTournament(name?: string): boolean {
  if (!name) return false;
  return EXCLUDED_TOURNAMENTS.some((re) => re.test(name));
}

function normalizeSurface(s?: string): Surface {
  if (!s) return "Dur";
  const lower = s.toLowerCase();
  if (lower.includes("grass") || lower.includes("gazon")) return "Gazon";
  if (lower.includes("clay") || lower.includes("terre")) return "Terre battue";
  return "Dur";
}

function computeImpliedProbs(decimalA: number, decimalB: number): { a: number; b: number; margin: number } {
  const invA = 1 / decimalA;
  const invB = 1 / decimalB;
  const vig = invA + invB;
  return {
    a: Math.round((invA / vig) * 100),
    b: Math.round((invB / vig) * 100),
    margin: Math.round((vig - 1) * 1000) / 1000,
  };
}

function generateColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = ["#1B4332", "#5C2D91", "#B91C1C", "#0E7490", "#EA580C", "#1D4ED8", "#7C3AED", "#DB2777"];
  return colors[Math.abs(hash) % colors.length];
}

/**
 * Transforme un BSDMatch (service V2) en TennisMatch (frontend).
 * Enrichit avec Elo, forme, prédictions, stats serve, photos.
 */
function buildMatch(b: BSDMatch, index: number): TennisMatch | null {
  const nameA = b.player1?.name;
  const nameB = b.player2?.name;
  if (!nameA || !nameB) return null;

  const surface = normalizeSurface(b.tournament?.surface);

  // ─── Résolution Elo (4 sources, par priorité) ──────────────────────
  const abstractA = lookupAbstractElo(nameA, surface);
  const abstractB = lookupAbstractElo(nameB, surface);

  const dbStats = getPlayerStatsBatch([nameA, nameB], surface);
  const dbA = dbStats[Object.keys(dbStats).find((k) => k.includes(nameA.toLowerCase().split(" ").pop() ?? "")) ?? ""];
  const dbB = dbStats[Object.keys(dbStats).find((k) => k.includes(nameB.toLowerCase().split(" ").pop() ?? "")) ?? ""];

  const eloMatchA = findPlayerElo(nameA);
  const eloMatchB = findPlayerElo(nameB);

  // ─── Gating « Données insuffisantes » ───────────────────────────────
  // un joueur est « connu » si au moins UNE source réelle fournit son Elo.
  // Si l'un des deux est inconnu, aucune prédiction du modèle n'est fiable :
  // on ne fabrique plus de faux 50/50 / Elo 1500 / forme & H2H aléatoires.
  const eloKnownA = Boolean(abstractA?.elo ?? dbA?.elo ?? eloMatchA?.elo);
  const eloKnownB = Boolean(abstractB?.elo ?? dbB?.elo ?? eloMatchB?.elo);
  const insufficientData = !eloKnownA || !eloKnownB;

  const eloA = eloKnownA
    ? (abstractA?.elo ?? dbA?.elo ?? eloMatchA?.elo ?? 1500)
    : 1500; // sentinelle — l'UI masque via eloKnown=false / insufficientData
  const surfaceEloA = eloKnownA
    ? (abstractA?.surfaceElo ?? dbA?.eloSurface ?? eloMatchA?.surfaceElo ?? eloA)
    : eloA;
  const formA: MatchOutcome[] = eloKnownA && eloMatchA?.history
    ? extractForm(eloMatchA.history)
    : [];

  const eloB = eloKnownB
    ? (abstractB?.elo ?? dbB?.elo ?? eloMatchB?.elo ?? 1500)
    : 1500;
  const surfaceEloB = eloKnownB
    ? (abstractB?.surfaceElo ?? dbB?.eloSurface ?? eloMatchB?.surfaceElo ?? eloB)
    : eloB;
  const formB: MatchOutcome[] = eloKnownB && eloMatchB?.history
    ? extractForm(eloMatchB.history)
    : [];

  // ─── Rang réel BSD (quand BSD le fournit) ───────────────────────────
  // Après le guard, player1/player2 sont non-null (TypeScript ne narrow pas via nameA/nameB)
  const rankA = b.player1!.current_ranking?.position ?? 0; // 0 = inconnu
  const rankB = b.player2!.current_ranking?.position ?? 0;
  // Fallback : rang officiel ATP/WTA depuis pariscore.db (scraper hebdo
  // tour-leaderboards) quand BSD ne l'expose pas encore.
  const dbRankA = rankA > 0
    ? rankA
    : (dbA?.atpRank ?? dbA?.wtaRank ?? 0);
  const dbRankB = rankB > 0
    ? rankB
    : (dbB?.atpRank ?? dbB?.wtaRank ?? 0);

  const playerAInputs: PlayerInputs = {
    id: String(b.player1!.id ?? index),
    name: nameA,
    elo: eloA,
    surfaceElo: surfaceEloA,
    form: formA,
    h2h: { won: eloKnownA ? Math.min(3, formA.filter((f) => f === "W").length) : 0, lost: 0 },
  };
  const playerBInputs: PlayerInputs = {
    id: String(b.player2!.id ?? index),
    name: nameB,
    elo: eloB,
    surfaceElo: surfaceEloB,
    form: formB,
    h2h: { won: 0, lost: eloKnownB ? Math.min(3, formB.filter((f) => f === "L").length) : 0 },
  };

  // Prédiction du modèle uniquement si les DEUX joueurs sont connus.
  // Sinon probA/probB proviennent du marché (cotes dé-margées) quand elles
  // existent, et l'UI affiche « Données insuffisantes » sinon.
  const pred = insufficientData
    ? null
    : predict(playerAInputs, playerBInputs);

  const tournamentName = b.tournament?.name || "Tennis";

  const modelSurface = toModelSurface(surface);
  const serveA = lookupServeStats(nameA, modelSurface);
  const serveB = lookupServeStats(nameB, modelSurface);
  const bestOf: 3 | 5 = 3;
  const tgPred = predictTotalGames(serveA, serveB, modelSurface, bestOf, eloA, eloB);

  const acesA: AcesStats = {
    acesPct: serveA.acesPct,
    servePtsWonPct: serveA.servePtsWonPct,
    returnPtsWonPct: serveA.returnPtsWonPct,
  };
  const acesB: AcesStats = {
    acesPct: serveB.acesPct,
    servePtsWonPct: serveB.servePtsWonPct,
    returnPtsWonPct: serveB.returnPtsWonPct,
  };
  const maPred = predictMostAces(acesA, acesB, modelSurface, bestOf);

  const colorA = generateColor(nameA);
  const colorB = generateColor(nameB);

  // Build odds from BSD match-level odds
  let allOdds: BookmakerOdd[] = [];
  if (b.odds_player1 != null && b.odds_player2 != null) {
    const probs = computeImpliedProbs(b.odds_player1, b.odds_player2);
    allOdds = [{
      bookmaker: "Consensus",
      decimalA: b.odds_player1,
      decimalB: b.odds_player2,
      impliedProbA: probs.a,
      impliedProbB: probs.b,
      margin: probs.margin,
    }];
  }

  const playerA: Player = {
    id: playerAInputs.id,
    name: nameA,
    shortName: nameA.split(" ").slice(-1)[0].toUpperCase(),
    rank: dbRankA,
    elo: playerAInputs.elo,
    eloKnown: eloKnownA,
    surfaceElo: playerAInputs.surfaceElo,
    photoUrl: b.player1!.id
      ? getPlayerPhotoUrl(b.player1!.id)
      : resolvePlayerPhoto(nameA),
    color: colorA,
    form: playerAInputs.form,
    country: resolvePlayerCountry(nameA),
  };

  const playerB: Player = {
    ...playerA,
    id: playerBInputs.id,
    name: nameB,
    shortName: nameB.split(" ").slice(-1)[0].toUpperCase(),
    rank: dbRankB,
    elo: playerBInputs.elo,
    eloKnown: eloKnownB,
    surfaceElo: playerBInputs.surfaceElo,
    photoUrl: b.player2!.id
      ? getPlayerPhotoUrl(b.player2!.id)
      : resolvePlayerPhoto(nameB),
    color: colorB,
    form: playerBInputs.form,
    country: resolvePlayerCountry(nameB),
  };

  // Momentum Score (EWM 5 signaux)
  const momentum = computeMomentumScore(
    nameA, nameB, surface,
    formScore(playerAInputs.form), formScore(playerBInputs.form),
  );
  const playerAFinal: Player = { ...playerA, momentumScore: momentum.scoreA };
  const playerBFinal: Player = { ...playerB, momentumScore: momentum.scoreB };

  // Probabilités : modèle si données suffisantes, sinon marché dé-margé
  // (cotes consensus) quand dispo, sinon 50/50 (masqué par l'UI).
  const marketProbs = allOdds[0]
    ? { a: allOdds[0].impliedProbA, b: allOdds[0].impliedProbB }
    : null;
  const probA = pred ? pred.probA : (marketProbs?.a ?? 50);
  const probB = pred ? pred.probB : (marketProbs?.b ?? 50);

  const stats: MatchStats = {
    form: pred
      ? `${playerAInputs.form.filter((f) => f === "W").length}V-${playerAInputs.form.filter((f) => f === "L").length}D`
      : "—",
    eloGap: pred?.eloGap ?? 0,
    surface,
    h2h: pred ? "—" : "—",
    ic: pred?.ic ?? [0, 100],
    confidence: pred?.confidence ?? 0,
  };

  return {
    id: `bsd-${b.id}`,
    tournament: tournamentName,
    tournamentCategory: resolveTournamentCategory(tournamentName),
    tournamentPriority: resolveTournamentPriority(tournamentName),
    round: b.round_name ?? "Prematch",
    // BSD V2 renvoie match_date (pas start_time/commence_time).
    scheduledAt: b.match_date ?? "",
    playerA: playerAFinal,
    playerB: playerBFinal,
    insufficientData,
    probA,
    probB,
    stats,
    model: pred?.model ?? "Données insuffisantes",
    modelUpdatedAt: new Date().toISOString(),
    allOdds,
    odds: allOdds[0]
      ? { bookmaker: allOdds[0].bookmaker, decimalA: allOdds[0].decimalA, decimalB: allOdds[0].decimalB }
      : undefined,
    totalGamesPredictions: {
      over18_5: tgPred.over18_5,
      over19_5: tgPred.over19_5,
      over21_5: tgPred.over21_5,
      lambda: tgPred.lambda,
      recommendedBet: tgPred.recommendedBet,
      source: tgPred.source,
    },
    mostAcesPredictions: {
      probAMoreAces: maPred.probAMoreAces,
      probBMoreAces: maPred.probBMoreAces,
      probTie: maPred.probTie,
      probAWinsMarket: maPred.probAWinsMarket,
      lambdaA: maPred.lambdaA,
      lambdaB: maPred.lambdaB,
      lambdaTotal: maPred.lambdaTotal,
      over9_5: maPred.over9_5,
      over12_5: maPred.over12_5,
      over15_5: maPred.over15_5,
      recommendedBet: maPred.recommendedBet,
      source: maPred.source,
    },
    momentumSignals: {
      source: momentum.source,
      weights: momentum.weights,
    },
  };
}

// ─── Live matches (BSD /api/v2/matches/live/) ───────────────────────────────

export type LiveMatchItem = {
  id: string;
  playerA: { name: string };
  playerB: { name: string };
  setsDetail: Array<{ p1: number; p2: number }>;
  currentGame: { p1: number; p2: number };
  currentPoint: { p1: number; p2: number };
  currentSet: number; // 0-indexed (0 = set 1)
  server: "A" | "B";
  liveProbA: number;
  liveProbB: number;
  /** Cotes décimales live BSD (depuis odds_player1/2). null si indisponibles. */
  oddsA: number | null;
  oddsB: number | null;
  isLive: boolean;
  /** Nom du tournoi BSD (R7.3) — ex: "Segovia, Spain", "UTR PTT Waco Men 02". */
  tournamentName?: string;
  /** Round BSD (R7.3) — ex: "Round of 32", "Final". */
  roundName?: string;
  /**
   * Stats live cumulées BSD (shape use-tennis-live-stats) — propagées via le
   * broker/SSE pour affichage < 1s, sans canal socket.io dédié.
   * null si BSD n'expose aucune stat pour ce match.
   */
  live_stats: {
    p1_aces: number | null;
    p2_aces: number | null;
    p1_df: number | null;
    p2_df: number | null;
    p1_first_pct: number | null;
    p2_first_pct: number | null;
    p1_first_won: number | null;
    p2_first_won: number | null;
    p1_second_won: number | null;
    p2_second_won: number | null;
    p1_bp_saved: number | null;
    p2_bp_saved: number | null;
  } | null;
};

/**
 * Fetch live tennis matches via bsd-tennis-service (V2).
 * Returns normalized match objects with scores, sets, server, and live probabilities.
 */
export async function fetchBSDLiveMatches(): Promise<LiveMatchItem[]> {
  const rawData = await fetchLiveMatches();

  return rawData.map((m: BSDLiveMatch): LiveMatchItem | null => {
    if (!m.player1?.name || !m.player2?.name) return null;

    const nameA = m.player1.name;
    const nameB = m.player2.name;
    const statusStr = String(m.status || "").toLowerCase();
    const finishedRx = /finish|complete|ended|cancel|walkover|retired|abandon|w_?o|post/;
    const isLive = (/progress|live|playing|in_play|inplay|set/.test(statusStr) && !finishedRx.test(statusStr))
      || (m.current_set != null && !finishedRx.test(statusStr));

    // Parse per-set game scores from sets_detail
    const setsDetail: Array<{ p1: number; p2: number }> = Array.isArray(m.sets_detail)
      ? m.sets_detail.map((s) => ({
          p1: s.p1 ?? 0,
          p2: s.p2 ?? 0,
        }))
      : [];

    // Current game scores
    const gameP1 = m.current_game_p1 ?? 0;
    const gameP2 = m.current_game_p2 ?? 0;

    // Parse current point string like "15-30" or "40-AV"
    let pointP1 = 0;
    let pointP2 = 0;
    if (m.current_point) {
      const parts = String(m.current_point).split(/[-–—]/);
      const ptVal = (s: string): number => {
        const v = s.trim().toUpperCase();
        if (v === "0" || v === "LOVE") return 0;
        if (v === "15") return 1;
        if (v === "30") return 2;
        if (v === "40") return 3;
        // Avantage = 4 (distinct de 40=3) pour que le diffPoints infère
        // correctement les points de break et le momentum. Sans ça,
        // AV-40 est identique à 40-40 (deuce) et les points avantage
        // sont silencieusement droppés du buffer momentum.
        if (v === "AV" || v === "AD" || v === "ADV") return 4;
        return 0;
      };
      pointP1 = parts[0] ? ptVal(parts[0]) : 0;
      pointP2 = parts[1] ? ptVal(parts[1]) : 0;
    }

    // Determine server
    const server: "A" | "B" = m.is_serving_p1 === true ? "A" : m.is_serving_p1 === false ? "B" : "A";

    // Live probabilities from odds when available
    let liveProbA = 50;
    let liveProbB = 50;
    if (m.odds_player1 != null && m.odds_player2 != null && m.odds_player1 > 0 && m.odds_player2 > 0) {
      const invA = 1 / m.odds_player1;
      const invB = 1 / m.odds_player2;
      const total = invA + invB;
      if (total > 0) {
        liveProbA = Math.round((invA / total) * 100);
        liveProbB = Math.round((invB / total) * 100);
      }
    }

    // current_set is 1-based from BSD → convert to 0-indexed
    const rawCurrentSet = m.current_set != null ? m.current_set : NaN;
    const currentSet = !isNaN(rawCurrentSet) && rawCurrentSet > 0 ? rawCurrentSet - 1
      : (setsDetail.length > 0 ? setsDetail.length - 1 : 0);

    return {
      id: `bsd-${m.id}`,
      playerA: { name: nameA },
      playerB: { name: nameB },
      setsDetail,
      currentGame: { p1: gameP1, p2: gameP2 },
      currentPoint: { p1: pointP1, p2: pointP2 },
      currentSet,
      server,
      liveProbA,
      liveProbB,
      // Cotes décimales live (utiles pour le widget : affichage devant le joueur).
      // On garde les valeurs brutes BSD (>0), null sinon.
      oddsA:
        m.odds_player1 != null && m.odds_player1 > 0 ? m.odds_player1 : null,
      oddsB:
        m.odds_player2 != null && m.odds_player2 > 0 ? m.odds_player2 : null,
      isLive,
      tournamentName: m.tournament?.name || undefined,
      roundName: m.round_name ?? undefined,
      // Stats live cumulées (aces, DF, % 1er srv, % pts gagnés 1er srv, BP
      // sauvées) — déjà fournies par BSD /live, auparavant jetées ici.
      // Consommées par use-tennis-live-stats via le SSE (pas de 2e canal).
      live_stats:
        m.p1_aces != null || m.p2_aces != null || m.p1_double_faults != null ||
        m.p2_double_faults != null || m.p1_first_serve_pct != null ||
        m.p2_first_serve_pct != null || m.p1_first_serve_won_pct != null ||
        m.p2_first_serve_won_pct != null || m.p1_second_serve_won_pct != null ||
        m.p2_second_serve_won_pct != null || m.p1_break_points_saved_pct != null ||
        m.p2_break_points_saved_pct != null
          ? {
              p1_aces: m.p1_aces ?? null,
              p2_aces: m.p2_aces ?? null,
              p1_df: m.p1_double_faults ?? null,
              p2_df: m.p2_double_faults ?? null,
              p1_first_pct: m.p1_first_serve_pct ?? null,
              p2_first_pct: m.p2_first_serve_pct ?? null,
              p1_first_won: m.p1_first_serve_won_pct ?? null,
              p2_first_won: m.p2_first_serve_won_pct ?? null,
              p1_second_won: m.p1_second_serve_won_pct ?? null,
              p2_second_won: m.p2_second_serve_won_pct ?? null,
              p1_bp_saved: m.p1_break_points_saved_pct ?? null,
              p2_bp_saved: m.p2_break_points_saved_pct ?? null,
            }
          : null,
    };
  }).filter((m: LiveMatchItem | null): m is LiveMatchItem => m !== null);
}

function extractForm(history: { elo: number; date: string }[]): ("W" | "L")[] {
  if (history.length < 2) return [];
  const recent = history.slice(-7);
  const form: ("W" | "L")[] = [];
  for (let i = 1; i < recent.length; i++) {
    form.push(recent[i].elo >= recent[i - 1].elo ? "W" : "L");
  }
  return form.slice(-6);
}

/** Fetch scheduled prematch matches via bsd-tennis-service (V2). */
export async function fetchBSDMatches(): Promise<TennisMatch[]> {
  const page = await fetchMatches({ status: "scheduled", limit: 200 });
  const matches = page.results ?? [];

  const tennisMatches: TennisMatch[] = [];
  for (let i = 0; i < matches.length && tennisMatches.length < 30; i++) {
    const bsdMatch = matches[i];
    if (isExcludedTournament(bsdMatch.tournament?.name)) continue;
    const m = buildMatch(bsdMatch, i);
    if (m) tennisMatches.push(m);
  }

  if (tennisMatches.length === 0) {
    throw new Error("BSD returned no valid matches");
  }

  console.log(`[bsd] Fetched ${tennisMatches.length} matches`);
  return tennisMatches;
}
