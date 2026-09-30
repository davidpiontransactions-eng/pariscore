/**
 * basketball-standings.ts — lib pure du sous-onglet « Stats & Classements ».
 * Config des métriques (filtre + colonnes de la heatmap), calcul des rangs et
 * échelle de couleurs (vert = meilleur, rouge = pire, style matplotlib diverging
 * GnRd comme la référence produit).
 *
 * Sources (cf. services/basketballStandingsService.js) :
 *  - SQLite basketball_match_history (7313 matchs) → PPG/PPG Home/PPG Away/Points/V-D ;
 *  - ESPN /teams/{id}/statistics → FG%, 2P%, 3P%, FT%, RPG, APG, TO, STL, BLK, fautes ;
 *  - ESPN /standings → conférence + rank officiel.
 */

export type BasketballStandingsTeam = {
  id: string;
  name: string;
  abbr: string;
  logo: string | null;
  conference: string | null;
  rank: number | null; // rang de playoffs / classement ESPN
  wins: number | null;
  losses: number | null;
  // SQLite
  games: number | null;
  ppg: number | null;
  ppgHome: number | null;
  ppgAway: number | null;
  points: number | null; // points marqués sur la saison
  oppg: number | null; // points encaissés / match
  // ESPN statistics
  fgPct: number | null;
  twoPct: number | null;
  threePct: number | null;
  ftPct: number | null;
  rpg: number | null;
  orpg: number | null;
  drpg: number | null;
  apg: number | null;
  tpg: number | null;
  spg: number | null;
  bpg: number | null;
  fpg: number | null; // fautes personnelles / match
};

export type MetricDef = {
  /** Clé de la stat dans BasketballStandingsTeam, ou "winPctProxy" (calculée). */
  key: keyof BasketballStandingsTeam | "winPctProxy";
  label: string;
  short: string;
  /** false = plus c'est bas, mieux c'est (TO, fautes) */
  higherIsBetter: boolean;
  decimals: number;
};

/** Ordre des colonnes de la heatmap (inspiré de la référence Western Conference). */
export const METRICS: MetricDef[] = [
  { key: "winPctProxy", label: "Win %", short: "WIN%", higherIsBetter: true, decimals: 1 },
  { key: "ppg", label: "PPG · Points/match", short: "PPG", higherIsBetter: true, decimals: 1 },
  { key: "ppgHome", label: "PPG Home", short: "PPG H", higherIsBetter: true, decimals: 1 },
  { key: "ppgAway", label: "PPG Away", short: "PPG A", higherIsBetter: true, decimals: 1 },
  { key: "oppg", label: "Points encaissés/match", short: "OPP PPG", higherIsBetter: false, decimals: 1 },
  { key: "points", label: "Points (saison)", short: "PTS", higherIsBetter: true, decimals: 0 },
  { key: "fgPct", label: "FG %", short: "FG%", higherIsBetter: true, decimals: 1 },
  { key: "twoPct", label: "2P %", short: "2P%", higherIsBetter: true, decimals: 1 },
  { key: "threePct", label: "3P %", short: "3P%", higherIsBetter: true, decimals: 1 },
  { key: "ftPct", label: "FT %", short: "FT%", higherIsBetter: true, decimals: 1 },
  { key: "rpg", label: "RPG · Rebonds", short: "REB", higherIsBetter: true, decimals: 1 },
  { key: "orpg", label: "Rebonds offensifs", short: "OREB", higherIsBetter: true, decimals: 1 },
  { key: "drpg", label: "Rebonds défensifs", short: "DREB", higherIsBetter: true, decimals: 1 },
  { key: "apg", label: "APG · Passes", short: "AST", higherIsBetter: true, decimals: 1 },
  { key: "tpg", label: "TO · Pertes de balle", short: "TO", higherIsBetter: false, decimals: 1 },
  { key: "spg", label: "SPG · Interceptions", short: "STL", higherIsBetter: true, decimals: 1 },
  { key: "bpg", label: "BPG · Contres", short: "BLK", higherIsBetter: true, decimals: 1 },
  { key: "fpg", label: "Fautes / match", short: "PF", higherIsBetter: false, decimals: 1 },
];

/** winPctProxy : calculé à la volée depuis wins/losses si absent du payload. */
export function resolveMetric(t: BasketballStandingsTeam, key: string): number | null {
  if (key === "winPctProxy") {
    if (t.wins == null || t.losses == null || t.wins + t.losses === 0) return null;
    return (100 * t.wins) / (t.wins + t.losses);
  }
  const v = t[key as keyof BasketballStandingsTeam];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Rangs par métrique : 1 = meilleur. Retourne map teamId → (metricKey → rank). */
export function computeRanks(
  teams: BasketballStandingsTeam[],
  metrics: MetricDef[] = METRICS,
): Map<string, Record<string, number>> {
  const out = new Map<string, Record<string, number>>();
  for (const m of metrics) {
    const entries = teams
      .map((t) => ({ id: t.id, v: resolveMetric(t, m.key) }))
      .filter((e) => e.v != null) as { id: string; v: number }[];
    entries.sort((a, b) => (m.higherIsBetter ? b.v - a.v : a.v - b.v));
    entries.forEach((e, i) => {
      const rec = out.get(e.id) ?? {};
      rec[m.key] = i + 1;
      out.set(e.id, rec);
    });
  }
  return out;
}

/**
 * Couleur divergente vert → blanc → rouge (soft pastel, fond clair) selon le
 * rang : 1 = vert, dernier = rouge. r ∈ [0,1] (0 = meilleur).
 */
export function rankColor(rank: number, maxRank: number): string {
  if (!Number.isFinite(rank) || !Number.isFinite(maxRank) || maxRank <= 1) return "#f5f5f5";
  const r = Math.min(Math.max((rank - 1) / (maxRank - 1), 0), 1);
  // Interpolation vert (152,196,133) → blanc (245,245,245) → rouge (224,110,110)
  const mix = (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] => [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
  const green: [number, number, number] = [129, 199, 132];
  const white: [number, number, number] = [245, 245, 245];
  const red: [number, number, number] = [239, 112, 112];
  const c = r < 0.5
    ? mix(green, white, r * 2)
    : mix(white, red, (r - 0.5) * 2);
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

/** Tri principal du tableau : par métrique sélectionnée (meilleur en premier). */
export function sortByMetric(
  teams: BasketballStandingsTeam[],
  metric: MetricDef,
): BasketballStandingsTeam[] {
  const withV = teams.map((t) => ({ t, v: resolveMetric(t, metric.key) }));
  withV.sort((a, b) => {
    if (a.v == null && b.v == null) return a.t.name.localeCompare(b.t.name);
    if (a.v == null) return 1;
    if (b.v == null) return -1;
    return metric.higherIsBetter ? b.v - a.v : a.v - b.v;
  });
  return withV.map((x) => x.t);
}

/** Filtre conférence (comme la référence : East / West / All). */
export function filterConference(
  teams: BasketballStandingsTeam[],
  conf: "all" | "East" | "West",
): BasketballStandingsTeam[] {
  if (conf === "all") return teams;
  return teams.filter((t) => t.conference === conf);
}
