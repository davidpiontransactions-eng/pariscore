export type League = {
  id: string;
  name: string;
  country: string;
  /** Code pays ISO 3166-1 alpha-2 (ex: "FR", "GB-ENG", "EU" pour compétitions continentales). */
  countryCode: string;
  logo: string;
  tier: "T1" | "T2" | "CUP";
};

/**
 * Bilan réel d'une équipe dans un contexte précis (Domicile pour l'équipe 1,
 * Extérieur pour l'équipe 2) — dérivé du classement BSD (splits home/away).
 * `rank` correspond au rang dans le classement PPG de ce contexte (dom vs ext),
 * parmi `rankTotal` équipes de la ligue.
 */
export type TeamStandingStats = {
  /** Matchs joués dans ce contexte (dom pour l'équipe 1, ext pour l'équipe 2). */
  played: number;
  /** Points cumulés dans ce contexte (Victoire=3, Nul=1). */
  points: number;
  /** Moyenne de points par match dans ce contexte (points / played). */
  ppg: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  /** Différence de buts (marqués - encaissés) dans ce contexte. */
  goalDiff: number;
  /** Rang dans le classement PPG du contexte (1 = meilleur). */
  rank: number;
  /** Nombre total d'équipes du classement. */
  rankTotal: number;
  /** true = données partielles (championnat en cours, < 3 matchs joués). */
  partial: boolean;
};

/**
 * Valeur d'une métrique pour une équipe dans un contexte (Domicile pour l'équipe 1,
 * Extérieur pour l'équipe 2), avec son rang dans le classement ligue de cette
 * sous-catégorie. `value: null` / `rank: null` = donnée indisponible (aucune
 * source réelle — jamais inventée).
 */
export type MetricValue = {
  value: number | null;
  rank: number | null;
  rankTotal: number;
};

/** Catégorie tirs / attaques : généré (for), subi (against), total (match). */

/** Statistiques d'attaque par équipe (source: FBref+Understat). */
export type TeamAttackStats = {
  goalsPerGame: number | null;
  shotsPerGame: number | null;
  xGPerGame: number | null;
  attackFrequency: number | null;  // % tirs convertis en buts
  goalsPerGameRank?: number;
  shotsPerGameRank?: number;
  xGPerGameRank?: number;
  attackFrequencyRank?: number;
};

/** Statistiques de defense par equipe (source: FBref). */
export type TeamDefenseStats = {
  concededPerGame: number | null;
  cleanSheetPct: number | null;
  tacklesPerGame: number | null;
  defActionsPerGame: number | null;  // (Tkl+Int+Clr)/MP
  concededPerGameRank?: number;
  cleanSheetPctRank?: number;
  tacklesPerGameRank?: number;
  defActionsPerGameRank?: number;
};

/** Stats attaque/defense d'une equipe pour une ligue. */
export type TeamAttackDefenseEntry = {
  teamName: string;
  attack: TeamAttackStats;
  defense: TeamDefenseStats;
};

/** Stats attaque/defense d'une ligue entiere. */
export type TeamAttackDefenseLeague = {
  meta: {
    leagueName: string;
    leagueSlug: string;
    season: string;
    lastUpdated: string;
    source: string;
    teamCount: number;
  };
  teams: TeamAttackDefenseEntry[];
};

export type TeamMetricCategory = {
  for: MetricValue;
  against: MetricValue;
  total: MetricValue;
};

/** Catégorie buts — seule catégorie 100% réelle (dérivée des scores BSD). */
export type GoalMetrics = {
  /** Moyenne de buts totaux dans les matchs de l'équipe (gf+ga)/played. */
  avg: MetricValue;
  /** Total de buts marqués. */
  scored: MetricValue;
  /** Moyenne de buts marqués par match. */
  scoredPg: MetricValue;
  /** Total de buts encaissés. */
  conceded: MetricValue;
  /** Moyenne de buts encaissés par match. */
  concededPg: MetricValue;
};

/** Catégorie corners + seuils de franchissement (% Over). */
export type CornerMetrics = {
  /** Moyenne de corners par match. */
  total: MetricValue;
  over55: MetricValue;
  over65: MetricValue;
  over75: MetricValue;
  over85: MetricValue;
  over95: MetricValue;
  over105: MetricValue;
};

/** Statistiques par catégorie d'une équipe dans un contexte donné. */
export type TeamMetricStats = {
  /** Tirs — indisponible dans la source BSD events actuelle (value: null). */
  shots: TeamMetricCategory;
  /** Tirs cadrés — indisponible (value: null). */
  sot: TeamMetricCategory;
  /** Attaques dangereuses — indisponible (value: null). */
  attacks: TeamMetricCategory;
  /** Buts — réels (dérivés des scores). */
  goals: GoalMetrics;
  /** Corners — indisponible (value: null). */
  corners: CornerMetrics;
};

/** Métriques du match : équipe 1 à domicile (`home`) vs équipe 2 à l'extérieur (`away`). */
export type MatchMetricStats = {
  home: TeamMetricStats;
  away: TeamMetricStats;
  /** true = données partielles (championnat en cours, < 3 matchs joués). */
  partial: boolean;
};

/** Ligne d'un leaderboard de championnat pour une métrique donnée. */
export type MetricRankingRow = {
  teamId: string;
  name: string;
  value: number | null;
  rank: number;
};

/** Leaderboards du championnat par métrique réelle (PPG, buts…). Clé = metricKey. */
export type MetricRankings = Record<string, MetricRankingRow[]>;

/** Signature complète des détails métriques d'un match (comparatifs + rankings). */
export type FootballMatchDetail = {
  metrics: MatchMetricStats;
  rankings: MetricRankings;
};

/**
 * Contexte Domicile/Extérieur d'un match : l'équipe 1 joue à domicile
 * (`home`), l'équipe 2 à l'extérieur (`away`).
 */
export type StandingContext = {
  home: TeamStandingStats;
  away: TeamStandingStats;
  /** Si blend avec saison N-1, label de la saison historique (ex: "2025/26"). */
  historicalSeason?: string;
};


export type Team = {
  id: string;
  name: string;
  shortName: string;
  logo: string;
  color: string;
  form: ("W" | "D" | "L")[];
  rank: number;
  /** Meilleur buteur de l'équipe (nom + buts + photo). */
  topScorer?: { name: string; goals: number; photoUrl?: string; xgPerMatch?: number };
  /** Meilleur passeur décisif (nom + passes + photo). */
  topAssister?: { name: string; assists: number; photoUrl?: string; keyPasses?: number };
  /** Meilleur défenseur/intercepteur (nom + tacles + photo). */
  topDefender?: { name: string; tackles: number; photoUrl?: string; duelsWonPct?: number };
};

export type FootballMatchOdds = {
  bookmaker: string;
  home: number;
  draw: number;
  away: number;
  impliedHome: number;
  impliedDraw: number;
  impliedAway: number;
  margin: number;
};

export type Prediction = {
  homeProb: number;
  drawProb: number;
  awayProb: number;
  bttsProb: number;
  over25Prob: number;
  model: string;
  /** Meilleure option double chance (1X, X2, ou 12) et sa probabilité. */
  doubleChance?: { selection: "1X" | "X2" | "12"; prob: number };
  /** P(buts ≥ 2) — probabilité qu'il y ait au moins 2 buts dans le match. */
  over15Prob?: number;
  /** P(buts ≤ 3) — probabilité qu'il y ait 3 buts ou moins. */
  under35Prob?: number;
  /** Meilleure ligne de corners over avec probabilité ≥ 65%. */
  bestCornerOver?: { line: number; overProb: number; over65Prob: number };
  /** Barres de comparaison d'équipe (max 4) avec probabilités domicile/extérieur. */
  teamComparisons?: { label: string; homeProb: number; awayProb: number }[];
  /** Stats saisonnières par métrique avec moyennes Home/Away + rangs ligue (null = indisponible, jamais simulé). */
  teamSeasonStats?: {
    label: string;
    homeAvg: number;
    /** Rang ligue réel (null = non calculé pour cette métrique — ne pas simuler). */
    homeRank: number | null;
    homeRankTotal: number;
    awayAvg: number;
    awayRank: number | null;
    awayRankTotal: number;
  }[];
  /** Bilan réel Domicile (équipe 1) vs Extérieur (équipe 2) — MJ, Pts, PPG+Rang, GD. */
  standingStats?: StandingContext;
  /** Métriques par catégorie Domicile/Extérieur (Buts réelles ; Tirs/Corners/Attaques indisponibles → value:null). */
  metricStats?: MatchMetricStats;
  /** Leaderboards du championnat par métrique réelle (PPG, buts…) pour le classement. */
  metricRankings?: MetricRankings;
  /** xGa moyen (expected goals average) — estimé depuis les xG live ou le modèle. */
  xGa?: { home: number; away: number; total: number };
  /** xGd (différentiel xG) — home_xg - away_xg normalisé [-1, +1].
   *  `null` = données xG live indisponibles (pas de calcul possible).
   *  `0`   = différentiel parfaitement équilibré. */
  xGd?: number | null;
  /** Innovation 1: Indice xP (Expected Points difference).
   *  xP_diff = points_réels - points_attendus_selon_xG.
   *  > 0 = sur-performance, < 0 = sous-performance. */
  xpDiff?: number;
  /** Innovation 2: Risque cartons lié à l'arbitre.
   *  score > 1.3 = risque élevé, < 0.7 = arbitre permissif. */
  refereeCardRisk?: { score: number; label: "élevé" | "modéré" | "faible" };
  /** Innovation 3: Tendance de forme récente (5 derniers matchs).
   *  trend: up/down/stable + valeurs xG créé L5. */
  formMomentum?: {
    home: { trend: "up" | "down" | "stable"; values: number[] };
    away: { trend: "up" | "down" | "stable"; values: number[] };
  };
  /** Innovation 4: Indice de vulnérabilité sur coups de pied arrêtés.
   *  edge > 0.10 = avantage CPA domicile, < -0.10 = vulnérabilité. */
  setPieceEdge?: number;
};

export type FootballLiveState = {
  homeScore: number;
  awayScore: number;
  minute: number;
  status: "LIVE" | "HT" | "FT" | "PEN";
  /** Période brute BSD (ex: "1H", "2H", "HT"). Permet de distinguer les mi-temps. */
  period?: string;
  homePossession: number;
  /** null si la source ne fournit pas la statistique (≠ 0 absent). */
  homeShots: number | null;
  awayShots: number | null;
  homeShotsOnTarget: number | null;
  awayShotsOnTarget: number | null;
  homeCorners: number | null;
  awayCorners: number | null;
  /** Attaques totales (BSD live_stats / sr_stats). Absent si la source ne fournit pas. */
  homeAttacks?: number | null;
  awayAttacks?: number | null;
  /** Attaques dangereuses — métrique distincte des attaques (signal live clé). */
  homeDangerousAttacks?: number | null;
  awayDangerousAttacks?: number | null;
  homeFouls?: number | null;
  awayFouls?: number | null;
  homeYellowCards?: number | null;
  awayYellowCards?: number | null;
  homeRedCards?: number | null;
  awayRedCards?: number | null;
  /** xG cumulé live (BSD actual_*_xg / *_xg_live). */
  homeXg?: number | null;
  awayXg?: number | null;
  /** Timeline momentum BSD [-100,+100] (signé, + = domicile domine). Lazy : absent du list live. */
  momentum?: { minute: number; value: number }[];
  /** xG incrémental par minute. Lazy : absent du list live. */
  xgPerMinute?: { minute: number; home: number; away: number }[];
  /** Buts (depuis shotmap BSD). Lazy : absent du list live. */
  goals?: { minute: number; home: boolean; type: string }[];
};

export type FootballMatch = {
  id: string;
  league: League;
  round: string;
  scheduledAt: string;
  home: Team;
  away: Team;
  prediction: Prediction;
  odds?: { bookmaker: string; home: number; draw: number; away: number };
  allOdds?: FootballMatchOdds[];
  live?: FootballLiveState | null;
  /** Stade (image de fond filigrane via /img/venue/{id}/, pattern BSD public). */
  venue?: { id: number; name: string; city?: string; country?: string } | null;
};
