// Types de la table `vitibet_tips` (pariscore.db) — pronostics handball Vitibet.
// Remplie par scripts/scrape-vitibet.js (cron PM2 `pariscore-cron-vitibet`).
// Schéma SQL : voir .context/plan-vitibet-handball-scraping.md §4.

/** Issue pronostiquée : 1 = domicile, X = nul, 2 = extérieur. */
export type VitibetTipValue = "1" | "X" | "2";

/** Statut du match au moment du scrape Vitibet. */
export type VitibetTipStatut = "scheduled" | "live" | "finished";

/** Pronostic Vitibet d'un match (une ligne de `vitibet_tips`). */
export type VitibetTip = {
  /** Identifiant fixture Vitibet (lien page détail). */
  fixtureId: number;
  /** Identifiant ligue Vitibet (53 ligues handball couvertes). */
  leagueId: number;
  /** Sport Vitibet (`sekce`) — « hazena » pour le handball. */
  sport: string;
  /** Date du match, « AAAA-MM-JJ ». */
  dateMatch: string;
  /** Heure de coup d'envoi « HH:MM » (absente si non publiée). */
  heure: string | null;
  /** Équipe domicile (nom Vitibet). */
  equipeDom: string;
  /** Équipe extérieure (nom Vitibet). */
  equipeExt: string;
  /** Tip vainqueur (absent si ligue non modélisée par Vitibet). */
  tip: VitibetTipValue | null;
  /** INDEX = rapport de force signé (> 0 = avantage domicile). */
  indexValue: number | null;
  /** Probabilité victoire domicile en % (0-100). */
  probHome: number | null;
  /** Probabilité nul en % (0-100). */
  probDraw: number | null;
  /** Probabilité victoire extérieur en % (0-100). */
  probAway: number | null;
  /** Buts domicile prédits. */
  scorePreditD: number | null;
  /** Buts extérieur prédits. */
  scorePreditE: number | null;
  /** Statut du match côté Vitibet. */
  statut: VitibetTipStatut | null;
  /** Buts domicile réels (backtest T6). */
  scoreReelD: number | null;
  /** Buts extérieur réels (backtest T6). */
  scoreReelE: number | null;
  /** Horodatage du dernier scrape (ISO). */
  scrapedAt: string | null;
};

/** Segment de stats du backtest (un tip ou une ligue). */
export type VitibetBacktestSegment = {
  /** Matchs finished évalués (tip + score réel complet). */
  total: number;
  /** Tips justes (issue réelle = tip). */
  hits: number;
  /** Taux de réussite 0..1 (0 si total = 0). */
  rate: number;
};

/** Stats du backtest par ligue Vitibet. */
export type VitibetBacktestLeague = VitibetBacktestSegment & {
  /** Identifiant ligue Vitibet. */
  leagueId: number;
};

/** Résultat du backtest des tips Vitibet (T6) — résultat FT vs tip prédit. */
export type VitibetBacktestResult = {
  /** Matchs finished avec tip ET score réel (échantillon du taux). */
  total: number;
  /** Tips justes. */
  hits: number;
  /** Taux de réussite global 0..1 (0 si total = 0). */
  rate: number;
  /** Répartition par type de tip ('1' | 'X' | '2'). */
  byTip: Record<VitibetTipValue, VitibetBacktestSegment>;
  /** Répartition par ligue (tri décroissant par échantillon). */
  byLeague: VitibetBacktestLeague[];
  /** Dates « AAAA-MM-JJ » des matchs évalués (croissant) — période couverte. */
  sampleDates: string[];
  /** Matchs finished sans tip — exclus du taux (transparence). */
  excludedNoTip: number;
};
