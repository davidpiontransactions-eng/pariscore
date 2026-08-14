/**
 * Contrat de types du domaine Rugby (PariScore Rugby4Cast).
 * Source de vérité unique : zéro `any`, zéro faux bouchon.
 *
 * Deux codes (rugby union / rugby league), les deux hémisphères. Données
 * issues de l'API publique ESPN (aucune clé requise) — jamais inventées :
 * quand une métrique manque, l'UI affiche "—" plutôt qu'une valeur fabriquée.
 */

export type RugbyCode = "UNION" | "LEAGUE";
export type MatchStatus = "scheduled" | "inprogress" | "finished";
export type VerdictLabel =
  | "backing-home"
  | "backing-away"
  | "leaning-home"
  | "leaning-away"
  | "toss-up";

/** Référence compacte vers une équipe (renvoyée par ESPN). */
export interface TeamRef {
  id: string;
  name: string;
  abbreviation: string;
  logo: string;
  color: string;
}

/** Définition statique d'une compétition couverte (registre curé). */
export interface CompetitionDef {
  id: string;
  slug: string;
  espnSport: string;
  espnLeagueId: string;
  name: string;
  code: RugbyCode;
  country: string;
  description: string;
  format: string;
  featured: boolean;
  sortOrder: number;
  /** Fenêtre future de recherche des fixtures (jours). */
  lookaheadDays?: number;
}

/** Compétition avec métadonnées dynamiques (calculées au runtime). */
export interface Competition extends CompetitionDef {
  upcomingCount: number;
  nextFixtureDate: string | null;
  lastSyncAt: string | null;
}

/** Match synchronisé depuis ESPN. */
export interface RugbyMatch {
  id: string;
  competitionSlug: string;
  date: string;
  status: MatchStatus;
  home: TeamRef;
  away: TeamRef;
  homeScore: number | null;
  awayScore: number | null;
  venue: string;
  neutral: boolean;
  form: { home: string; away: string };
}

/** Rating calculé d'une équipe pour une compétition (Elo + facteurs). */
export interface TeamRating {
  teamId: string;
  name: string;
  abbreviation: string;
  logo: string;
  color: string;
  elo: number;
  attack: number;
  defence: number;
  gamesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  /** Forme récente, plus ancien → plus récent, ex. "LWW". */
  form: string;
  /** Jours depuis le dernier match (fraîcheur/fatigue). null si inconnu. */
  restDays: number | null;
}

/** Ligne over/under du marché "total de points". */
export interface OverUnderLine {
  line: number;
  over: number;
  under: number;
}

/** Score exact probable (grille de Poisson). */
export interface TopScore {
  home: number;
  away: number;
  prob: number;
}

/** Bandes de marge — probabilité de gagner par X points ou plus. */
export interface MarginBand {
  label: string;
  homeProb: number;
  awayProb: number;
}

/** Marché handicap (spread) dérivé du score attendu. */
export interface HandicapMarket {
  line: number;
  homeCoverProb: number;
  awayCoverProb: number;
}

/** Prédictions complètes d'un match à venir. */
export interface RugbyPrediction {
  matchId: string;
  homeWinProb: number;
  drawProb: number;
  awayWinProb: number;
  expectedHomeScore: number;
  expectedAwayScore: number;
  expectedMargin: number;
  mostLikelyScore: string;
  topScores: TopScore[];
  overUnderLines: OverUnderLine[];
  handicap: HandicapMarket;
  marginBands: MarginBand[];
  lambdaHome: number;
  lambdaAway: number;
  homeElo: number;
  awayElo: number;
  /** PowerScore 0-100 des deux équipes (synthèse Elo + attaque/défense). */
  powerScore: { home: number; away: number };
  verdict: VerdictLabel;
  verdictTeamId: string | null;
  confidence: number;
  /** Facteurs contextuels appliqués (transparence du modèle). */
  adjustments: {
    homeRestDays: number | null;
    awayRestDays: number | null;
    restEdge: number;
    h2hHomeWins: number;
    h2hAwayWins: number;
    h2hDraws: number;
    h2hEdge: number;
  };
}

/** Prédiction "marqueur d'essai" (anytime / first). */
export interface TryScorerPrediction {
  playerName: string;
  teamId: string;
  teamName: string;
  position: string;
  expectedTries: number;
  anytimeProb: number;
  firstTryProb: number;
  rank: number;
}

/** Match à venir + prédiction associée (payload liste). */
export interface PredictedMatch {
  match: RugbyMatch;
  prediction: RugbyPrediction | null;
}

/** Ligne de classement (rating + simulation Monte Carlo). */
export interface StandingRow {
  teamId: string;
  name: string;
  abbreviation: string;
  logo: string;
  color: string;
  elo: number;
  attack: number;
  defence: number;
  gamesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  form: string;
  points: number;
  /** PowerScore 0-100 (synthèse Elo + attaque/défense). */
  powerScore: number;
  /** Probabilité simulée de finir 1er (0..1). null si pas de simulation. */
  titleChance: number | null;
}

/** Détail complet d'un match (page/panneau détail). */
export interface MatchDetail {
  match: RugbyMatch;
  competition: CompetitionDef | null;
  prediction: RugbyPrediction | null;
  homeRating: TeamRating | null;
  awayRating: TeamRating | null;
  h2h: RugbyMatch[];
  tryScorers: TryScorerPrediction[];
}

/** Payload liste des compétitions. */
export interface CompetitionsPayload {
  competitions: Competition[];
  fetchedAt: string;
  degraded: boolean;
}

/** Payload prédictions d'une compétition. */
export interface PredictionsPayload {
  competition: CompetitionDef;
  matches: PredictedMatch[];
  fetchedAt: string;
  degraded: boolean;
}

/** Payload classement. */
export interface StandingsPayload {
  competition: CompetitionDef;
  standings: StandingRow[];
  simulatedRuns: number;
  fetchedAt: string;
  degraded: boolean;
}

/** Payload détail d'un match. */
export interface MatchDetailPayload {
  detail: MatchDetail;
  fetchedAt: string;
  degraded: boolean;
}

/** Résultat d'une opération de sync. */
export interface SyncResult {
  ok: boolean;
  competitions: number;
  matches: number;
  predictions: number;
  durationMs: number;
  message: string;
}

/* ------------------------------------------------------------------ */
/* PowerScore & backtest spread                                         */
/* ------------------------------------------------------------------ */

/** Ligne du classement PowerScore d'une compétition. */
export interface PowerRow {
  teamId: string;
  name: string;
  abbreviation: string;
  logo: string;
  color: string;
  powerScore: number;
  elo: number;
  attack: number;
  defence: number;
  gamesPlayed: number;
  form: string;
}

/** Payload GET /api/rugby/power (top 10 par compétition). */
export interface PowerPayload {
  competition: CompetitionDef;
  teams: PowerRow[];
  fetchedAt: string;
  degraded: boolean;
}

/** Entrée du store de backtest spread (persistée dans data/rugby-backtest.json). */
export interface BacktestEntry {
  matchId: string;
  slug: string;
  date: string;
  /** Ligne du spread au moment de la prédiction (côté domicile). */
  handicapLine: number;
  expectedHomeScore: number;
  expectedAwayScore: number;
  homeWinProb: number;
  awayWinProb: number;
  /** Résultat réel, null tant que le match n'est pas terminé. */
  actualHomeScore: number | null;
  actualAwayScore: number | null;
  settledAt: string | null;
}

/** Couverture du spread par bande de probabilité domicile. */
export interface BacktestBand {
  label: string;
  n: number;
  /** Taux de couverture par le domicile (0..1), null si n === 0. */
  homeCoverRate: number | null;
  /** Taux de couverture par l'extérieur (0..1), null si n === 0. */
  awayCoverRate: number | null;
}

/** Stats agrégées du backtest spread d'une compétition (ou toutes). */
export interface BacktestStats {
  slug: string | null;
  bands: BacktestBand[];
  total: { n: number; homeCoverRate: number | null; awayCoverRate: number | null };
}

/** Payload GET /api/rugby/backtest. */
export interface BacktestStatsPayload {
  stats: BacktestStats;
  fetchedAt: string;
  degraded: boolean;
}
