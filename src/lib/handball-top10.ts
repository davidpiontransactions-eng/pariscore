// Top 10 handball — type de ligne, drapeaux et construction des stratégies.
//
// Remplace le calcul de seuil historique `bestOverLine` (src/lib/vitibet/over.ts)
// qui : (1) exige `scoreErrorSigma()` non-null, or celui-ci a besoin de ≥ 30 matchs
// terminés — donc aucun conseil du tout dès que l'ingestion décroche (elle est
// bloquée depuis le 28/09) ; (2) ne connaît QUE le total prédit Vitibet, sans
// distinguer les forces offensives et défensives des deux équipes ; (3) ne
// connaît pas la cote, donc ne peut pas appliquer la règle « ≥ 1.15 ».
//
// Ici chaque ligne est construite depuis les DEUX équipes (attaque ET défense)
// avec le ν calibré sur données réelles, et la cote est prise en compte.

import {
  calculateOptimalOverGoals,
  calculateOptimalUnderGoals,
  type ThresholdTeamStats,
} from "./handball-optimal-thresholds";
import { CALIBRATED_NU } from "./handball-goals-calibration";

// ─── Drapeaux ───

/**
 * Drapeau emoji à partir d'un code ISO 3166-1 alpha-2.
 * null si le code n'a pas 2 lettres ASCII → l'appelant affiche le code ISO.
 */
export function countryFlag(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const code = iso.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return null;
  // Point de code U+1F1E6 + (lettre − 'A') = lettre regionale.
  return String.fromCodePoint(
    0x1f1e6 + (code.charCodeAt(0) - 65),
    0x1f1e6 + (code.charCodeAt(1) - 65),
  );
}

// ─── Type de ligne ───

/** Stratégie retenue pour une ligne du Top 10. */
export type TopMatchStrategyKind =
  | "over"
  | "under"
  | "favorite"
  | "none";

export type TopMatchStrategy = {
  /** Rang 1..10 (1 = le plus prioritaire). */
  rank: number;
  /** Clé de match (fixtureId ou identifiant stable). */
  matchId: string;
  /** Nom de l'équipe à domicile. */
  home: string;
  /** Nom de l'équipe à l'extérieur. */
  away: string;
  /**
   * Horodatage ISO COMPLET du coup d'envoi (avec offset) —
   * « 2026-10-04T18:30:00+02:00 ». Volontairement un ISO plutôt qu'un
   * « JJ/MM | HH:MM » : le formatage dépend de la locale et du fuseau, il ne
   * doit jamais être figé dans la donnée.
   */
  dateTime: string;
  /** Code pays ISO 3166-1 alpha-2 de la ligue (pour le drapeau). */
  countryCode: string | null;
  /** Nom du championnat tel qu'affiché. */
  leagueName: string;
  /** Stratégie retenue. */
  kind: TopMatchStrategyKind;
  /** Libellé affiché (« Over 54.5 », « Under 62.5 », « Victoire Dom »…). */
  label: string;
  /** Probabilité estimée 0-100. null si stratégie « none ». */
  prob: number | null;
  /** Cote indicative. null si inconnue — jamais de cote inventée. */
  odds: number | null;
  /** true si la ligne respecte P ≥ 65 % ET cote ≥ 1.15. */
  qualifies: boolean;
  /**
 * Ligne de total en POINTS, telle que sortie par le modèle CMP.
 *
 * `null` = aucune ligne de total (stratégie favori 1N2, ou rien ne qualifie).
 * Elle est exposée comme nombre, et non reconstruite depuis `label` : parser
 * « Over 54.5 » pour en extraire 54.5 serait fragile (séparateur décimal,
 * espaces) et créerait une DEUXIÈME source de vérité. `label` reste l'affichage,
 * `totalLine` la donnée.
 */
  totalLine: number | null;
  /** Score prédit (optionnel, informatif). */
  predictedHome?: number | null;
  predictedAway?: number | null;
};

// ─── Format d'affichage ───

const DAY_FMT = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  day: "2-digit",
  month: "2-digit",
});
const TIME_FMT = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * « 04/10 | 18:30 », ou « Aujourd'hui | 20:00 » / « Demain | 18:00 » pour les
 * 2 prochains jours (plus lisible sur un tableau qui mélange les journées).
 * null si l'horodatage est illisible — jamais de date inventée.
 */
export function formatTop10DateTime(
  dateTime: string,
  now: Date = new Date(),
): { day: string; time: string; relative: string | null } | null {
  const d = new Date(dateTime);
  if (Number.isNaN(d.getTime())) return null;
  const day = DAY_FMT.format(d);
  const time = TIME_FMT.format(d);
  const todayKey = DAY_FMT.format(now);
  const tomorrow = new Date(now.getTime() + 86_400_000);
  const rel =
    DAY_FMT.format(d) === todayKey
      ? "Aujourd'hui"
      : DAY_FMT.format(d) === DAY_FMT.format(tomorrow)
        ? "Demain"
        : null;
  return { day, time, relative: rel };
}

// ─── Construction des stratégies ───

export type Top10InputMatch = {
  matchId: string;
  home: string;
  away: string;
  dateTime: string;
  leagueName: string;
  countryCode?: string | null;
  homeStats: ThresholdTeamStats;
  awayStats: ThresholdTeamStats;
  /** Cotes 1X2 réelles si disponibles. */
  odds?: { home?: number; draw?: number; away?: number };
  /** Cotes de total par ligne. */
  totalOdds?: Record<string, { over?: number; under?: number }>;
  /** Score prédit, informatif. */
  predictedHome?: number | null;
  predictedAway?: number | null;
};

/**
 * Meilleure stratégie disponible pour un match : on privilégie le marché de
 * total (Over/Under) car il atteint plus facilement 65 % que le 1N2 au
 * handball, puis le favori 1N2 si lui aussi passe la barre.
 *
 * null si rien ne passe les deux contraintes — on ne force jamais une ligne.
 */
export function buildTopMatchStrategy(
  input: Top10InputMatch,
): Pick<TopMatchStrategy, "kind" | "label" | "prob" | "odds" | "qualifies" | "totalLine"> {
  const opts = { nu: CALIBRATED_NU, oddsByLine: input.totalOdds };
  const over = calculateOptimalOverGoals(input.homeStats, input.awayStats, 65, opts);
  const under = calculateOptimalUnderGoals(input.homeStats, input.awayStats, 65, opts);

  const viable = [over, under].filter((t) => t != null && t.qualifies) as NonNullable<
    typeof over
  >[];
  if (viable.length > 0) {
    viable.sort((a, b) => b.prob - a.prob);
    const best = viable[0];
    return {
      kind: best.side,
      label: `${best.side === "over" ? "Over" : "Under"} ${best.line}`,
      prob: best.prob,
      odds: best.odds,
      qualifies: true,
      // Ligne du modèle, exposée telle quelle : l'UI n'a rien à recalculer.
      totalLine: best.line,
    };
  }

  // Repli 1X2 : le favori du modèle, s'il atteint 65 % avec une cote ≥ 1.15.
  // On estime la force par la différence de buts marquer/encaisser : c'est une
  // approximation 1D, suffisante pour un classement de conseil (et signalée
  // comme telle — la probabilité exacte vient du moteur Skellam côté popup).
  const edgeHome = (input.homeStats.scoredAvg - input.homeStats.concededAvg) / 12;
  const edgeAway = (input.awayStats.scoredAvg - input.awayStats.concededAvg) / 12;
  const pHome = clamp01(0.5 + 0.18 * (edgeHome - edgeAway));
  const pAway = clamp01(0.5 + 0.18 * (edgeAway - edgeHome));
  const favHome = pHome >= pAway;
  const prob = Math.round((favHome ? pHome : pAway) * 1000) / 10;
  const odd = favHome ? (input.odds?.home ?? null) : (input.odds?.away ?? null);
  if (prob >= 65 && odd != null && odd >= 1.15) {
    return {
      kind: "favorite",
      label: `Victoire ${favHome ? "Dom" : "Ext"}`,
      prob,
      odds: odd,
      qualifies: true,
      // Marché 1N2 : il n'y a pas de ligne de total. `null` — et non une
      // reconversion de la probabilité, qui serait une ligne inventée.
      totalLine: null,
    };
  }

  return { kind: "none", label: "—", prob: null, odds: null, qualifies: false, totalLine: null };
}

function clamp01(v: number): number {
  return v < 0.02 ? 0.02 : v > 0.98 ? 0.98 : v;
}

/**
 * Construit les lignes du Top 10 : `matches` → lignes numérotées 1..10, triées
 * par probabilité décroissante (les conseils les plus sûrs d'abord).
 *
 * Les matchs sans stratégie qualifiante sont ÉCARTÉS : un Top 10 de lignes
 * « — » n'aide pas l'utilisateur. Si aucune ligne ne qualify → tableau vide.
 */
export function buildTop10(matches: Top10InputMatch[], limit = 10): TopMatchStrategy[] {
  const rows: TopMatchStrategy[] = [];
  for (const m of matches) {
    const s = buildTopMatchStrategy(m);
    if (s.kind === "none") continue;
    rows.push({
      rank: 0,
      matchId: m.matchId,
      home: m.home,
      away: m.away,
      dateTime: m.dateTime,
      countryCode: m.countryCode ?? null,
      leagueName: m.leagueName,
      ...s,
      predictedHome: m.predictedHome ?? null,
      predictedAway: m.predictedAway ?? null,
    });
  }
  rows.sort((a, b) => (b.prob ?? 0) - (a.prob ?? 0));
  return rows.slice(0, limit).map((r, i) => ({ ...r, rank: i + 1 }));
}
