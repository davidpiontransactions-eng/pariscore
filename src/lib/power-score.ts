/**
 * PowerScore — score de puissance 0-100 par joueur (tennis) / équipe (foot).
 *
 * MÉTRIQUES ET PONDÉRATIONS (définies produit, stables) :
 *
 * Tennis (par joueur) — pondérations calées sur la littérature prédictive
 * (Kovalchik : Élo ; Barnett & Clarke : service/retour ; momentum/form) :
 *   - Élo surface  30 % — force fondamentale sur la surface (Kovalchik).
 *   - Service      20 % — % jeux tenus, facteur n°1 (serve advantage).
 *   - Forme L5     15 % — victoires / 5 derniers (momentum, bruité).
 *   - Retour       15 % — % points de retour (breaks = swings).
 *   - SPS          10 % — Surface PowerScore (redondant partiel avec Élo).
 *   - Fraîcheur    10 % — inverse de la charge (matchs 3 sets / 7 j).
 * Pas de H2H direct : l'Élo l'absorbe déjà et l'historique par paire est
 * trop clairsemé pour un score stable.
 *
 * Foot (par équipe) :
 *   - Forme        30 % — PPG 5 derniers / 3.
 *   - Dom./Ext.    20 % — PPG à domicile (équipe home) ou extérieur (away).
 *   - Attaque      20 % — buts marqués / match vs moyenne ligue.
 *   - Défense      15 % — buts encaissés / match inversés vs moyenne ligue.
 *   - H2H          15 % — avantage historique (-1..+1), ignoré si absent.
 *
 * Métrique absente (null) = exclue, poids renormalisés (pas de 50 neutre
 * arbitraire). `coverage` = part du poids total effectivement utilisée.
 * Toutes les valeurs d'entrée sont clampées 0-100 ; score final arrondi.
 */

export type PowerMetric = {
  key: string;
  /** Libellé FR court (tooltip). */
  label: string;
  /** Poids nominal (somme = 100 si tout présent). */
  weight: number;
  /** Valeur 0-100, null si donnée indisponible. */
  value: number | null;
  /** Valeur brute pour affichage (ex. "2146 Élo", "4/5"). */
  display?: string;
};

export type PowerScore = {
  /** Score 0-100 arrondi. */
  score: number;
  metrics: PowerMetric[];
  /** Poids utilisés / 100 (0-1). */
  coverage: number;
};

const clamp100 = (v: number): number => Math.min(95, Math.max(5, v));

/** Combine les métriques (renormalisation sur les poids présents). */
export function combinePowerMetrics(metrics: PowerMetric[]): PowerScore {
  const used = metrics.filter((m) => m.value != null);
  const totalW = used.reduce((s, m) => s + m.weight, 0);
  if (totalW <= 0) return { score: 50, metrics, coverage: 0 };
  const raw = used.reduce((s, m) => s + (m.value as number) * m.weight, 0) / totalW;
  return {
    score: Math.round(Math.min(100, Math.max(0, raw))),
    metrics,
    coverage: Math.round((totalW / 100) * 100) / 100,
  };
}

// ─── Tennis ───────────────────────────────────────────────────────────────────

export type TennisPowerInput = {
  /** Élo surface (repli Élo global). */
  surfaceElo?: number | null;
  /** Faux = Élo placeholder (1500 par défaut) → métrique exclue. */
  eloKnown?: boolean | null;
  /** Forme : tableau W/L (5 derniers de préférence). */
  form?: ("W" | "L")[] | null;
  /** % jeux de service tenus (0-100). */
  holdPct?: number | null;
  /** % points de retour gagnés (0-100). */
  returnPct?: number | null;
  /** Surface PowerScore 0-100. */
  sps?: number | null;
  /** Charge : matchs 3 sets / 7 j (0 = frais). */
  fatigueLoad?: number | null;
};

const formPct = (form: ("W" | "L")[] | null | undefined): number | null => {
  if (!form || form.length < 3) return null;
  const last5 = form.slice(-5);
  return (last5.filter((f) => f === "W").length / last5.length) * 100;
};

/** PowerScore d'un joueur de tennis (0-100 + détail). */
export function tennisPowerScore(input: TennisPowerInput): PowerScore {
  const elo = input.surfaceElo;
  const eloKnown = input.eloKnown !== false;
  const form = formPct(input.form);
  const freshness =
    input.fatigueLoad == null ? null : Math.max(0, 100 - input.fatigueLoad * 25);
  return combinePowerMetrics([
    {
      key: "elo",
      label: "Élo surface",
      weight: 30,
      value: !eloKnown || elo == null ? null : clamp100((elo - 1400) / 8),
      display: !eloKnown || elo == null ? undefined : `${Math.round(elo)} Élo`,
    },
    {
      key: "serve",
      label: "Service (hold %)",
      weight: 20,
      value: input.holdPct ?? null,
      display: input.holdPct == null ? undefined : `${input.holdPct.toFixed(1)} %`,
    },
    {
      key: "form",
      label: "Forme (5 derniers)",
      weight: 15,
      value: form,
      display: form == null ? undefined : `${Math.round(form)} %`,
    },
    {
      key: "return",
      label: "Retour (pts %)",
      weight: 15,
      value: input.returnPct ?? null,
      display: input.returnPct == null ? undefined : `${input.returnPct.toFixed(1)} %`,
    },
    {
      key: "sps",
      label: "SPS surface",
      weight: 10,
      value: input.sps ?? null,
      display: input.sps == null ? undefined : `${Math.round(input.sps)}/100`,
    },
    {
      key: "fresh",
      label: "Fraîcheur (7 j)",
      weight: 10,
      value: freshness,
      display: freshness == null ? undefined : `${Math.round(freshness)} %`,
    },
  ]);
}

// ─── Foot ─────────────────────────────────────────────────────────────────────

export type FootballPowerInput = {
  /** PPG 5 derniers (0-3). */
  formPpg?: number | null;
  /** PPG domicile (équipe home) ou extérieur (away). */
  venuePpg?: number | null;
  /** Buts marqués / match. */
  scoredPg?: number | null;
  /** Moyenne ligue buts marqués (référence attaque). */
  leagueAvgScored?: number | null;
  /** Buts encaissés / match. */
  concededPg?: number | null;
  /** Moyenne ligue buts encaissés (référence défense). */
  leagueAvgConceded?: number | null;
  /** Avantage H2H -1..+1 (positif = favorable). */
  h2hEdge?: number | null;
};

/** Buts/match → 0-100 (0 but = 20, 3+ buts = ~90, heuristique documentée). */
const attackScore = (scored: number): number =>
  clamp100(20 + scored * 22);

/** Buts encaissés/match → 0-100 (0 = 90, 3+ = ~20), ajusté à la moyenne ligue. */
const defenseScore = (conceded: number, leagueAvg: number | null): number => {
  const base = 90 - conceded * 22;
  if (leagueAvg == null) return clamp100(base);
  // Bonus si meilleure défense que la moyenne (écart inversé, ±15).
  return clamp100(base + (leagueAvg - conceded) * 8);
};

/** PowerScore d'une équipe de foot (0-100 + détail). */
export function footballPowerScore(input: FootballPowerInput): PowerScore {
  const form = input.formPpg == null ? null : clamp100((input.formPpg / 3) * 100);
  const venue = input.venuePpg == null ? null : clamp100((input.venuePpg / 3) * 100);
  const atk =
    input.scoredPg == null
      ? null
      : attackScore(
          input.leagueAvgScored != null && input.leagueAvgScored > 0
            ? (input.scoredPg / input.leagueAvgScored) * 1.5
            : input.scoredPg,
        );
  const def =
    input.concededPg == null
      ? null
      : defenseScore(input.concededPg, input.leagueAvgConceded ?? null);
  const h2h = input.h2hEdge == null ? null : clamp100(50 + input.h2hEdge * 50);
  return combinePowerMetrics([
    { key: "form", label: "Forme (PPG)", weight: 30, value: form },
    { key: "venue", label: "Dom./Ext.", weight: 20, value: venue },
    { key: "attack", label: "Attaque", weight: 20, value: atk },
    { key: "defense", label: "Défense", weight: 15, value: def },
    { key: "h2h", label: "H2H", weight: 15, value: h2h },
  ]);
}
