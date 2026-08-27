import type { MatchViewMode, TimeFilterKey } from "@/lib/match-view";

/** Fenêtre temporelle de filtrage des coups d'envoi (pills horaires). */
export type TimeFilterHours = TimeFilterKey;

/** Cotes décimales 1X2 / probabilités de modèle d'un match (signaux P0-1/P0-2). */
export interface TreeMarketRef {
  home: number;
  draw: number;
  away: number;
}

/** Résumé léger d'un match pour le niveau 4 de l'arborescence. */
export interface TreeMatchSummary {
  id: string;
  /** Équipe / joueur à domicile. */
  homeName: string;
  /** Équipe / joueur à l'extérieur. */
  awayName: string;
  /** Date/heure ISO du coup d'envoi. */
  scheduledAt: string;
  /** Match en direct (affiche un point rouge à la place de l'heure). */
  isLive?: boolean;
  /**
   * Cotes décimales 1X2 si disponibles (signal P0-1 : mini-boutons cliquables).
   * Absent quand la source ne fournit pas de cotes (dégradé → pas de bouton).
   */
  odds?: TreeMarketRef;
  /** Probabilités de modèle 1X2 en % (repli d'affichage quand pas de cote). */
  prob?: TreeMarketRef;
  /**
   * Edge de valeur 1X2 (max sur 1/X/2 de `modelProb − (1/odds)*100`), en points
   * de % — permet le badge « +2,1 » par match/ligue (signal P0-2). null → non calculé.
   */
  edgePct?: number | null;
  // Live stats (P2 — funnel sliders, momentum sparkline)
  /** Minute du match live (0 si non-live). */
  liveMinute?: number;
  /** Pression : % possession temps dominant par équipe. */
  pressure?: { homePct: number; awayPct: number };
  /** xG cumulé live par équipe. */
  homeXg?: number;
  awayXg?: number;
  /** Attaques dangereuses par équipe. */
  homeDangerous?: number;
  awayDangerous?: number;
  /** Tirs cadrés (shots on target) par équipe. */
  homeSOT?: number;
  awaySOT?: number;
}

/** Niveau 3 — Championnat / ligue / compétition. */
export interface LeagueNode {
  id: string;
  name: string;
  matchCount: number;
  isFavorite?: boolean;
  /** Sport porteur (permet de basculer l'onglet central au clic). */
  sportId: string;
  /** Prochaines rencontres (niveau 4, optionnel). */
  matches?: TreeMatchSummary[];
  /**
   * Valeur moyenne d'edge 1X2 (en points de %) sur les matchs de la ligue
   * avec cotes+modèle (signal P0-2). `undefined` = pas de signal calculable.
   */
  edgePct?: number;
}

/** Niveau 2 — Pays / région (ou catégorie de circuit au tennis). */
export interface CountryNode {
  id: string;
  name: string;
  /** Code ISO 3166-1 alpha-2 pour le drapeau (« INT » → globe). */
  countryCode: string;
  leagues: LeagueNode[];
}

/** Niveau 1 — Sport. `icon` = nom d'icône Lucide. */
export interface SportNode {
  id: string;
  name: string;
  icon: string;
  totalMatches: number;
  /** Nombre de matchs en direct (badge rouge). */
  liveMatches: number;
  countries: CountryNode[];
  /**
   * Vrai quand l'endpoint du sport a échoué (ex. /api/tennis/prematch → 503)
   * et que le nœud est vide par indisponibilité, PAS parce qu'aucun match
   * n'existe. Permet à l'UI d'afficher « données indisponibles » au lieu
   * d'un compteur 0 trompeur.
   */
  degraded?: boolean;
}

export type SidebarMode = MatchViewMode;

/** Clés d'onglet central — identiques aux ids de sport de l'arborescence. */
export type SportTabId =
  | "tennis"
  | "football"
  | "cs2"
  | "mma"
  | "nba"
  | "wnba"
  | "cycling"
  | "f1"
  | "baseball"
  | "rugby";
