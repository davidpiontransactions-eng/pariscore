"use client";

import useSWR from "swr";

export interface CornervalueTeam {
  teamName: string;
  avgCornersFT: number | null;
  avgCornersFor: number | null;
  avgCornersAgainst: number | null;
  hitRates: Record<string, { pct: number; hit: number; total: number }>;
}

export interface CornervalueLeague {
  meta: {
    leagueName: string;
    leagueSlug: string;
    leagueAvgFT: number | null;
    lastUpdated: string;
    source: string;
  };
  teams: CornervalueTeam[];
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/** Charge les stats Cornervalue pour une ligue donnee. */
export function useCornervalueStats(leagueSlug: string | null) {
  const url = leagueSlug
    ? `/data/metrics/cornervalue_${leagueSlug}.json`
    : null;

  const { data, error, isLoading } = useSWR<CornervalueLeague>(url, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 3600_000, // 1h cache
  });

  return { data, error, isLoading };
}

/** Calcule le hit rate estime pour over 6.5 a partir des donnees over 7.5 */
export function estimateOver65(hitRates: CornervalueTeam["hitRates"]): number | null {
  const o75 = hitRates["over7_5"];
  if (!o75) return null;
  // Over 6.5 ≈ Over 7.5 + ~15% (empirique : si 71% O7.5 → ~86% O6.5)
  return Math.min(100, o75.pct + 15);
}

/**
 * Longueur minimale du nom stocké pour autoriser une correspondance PARTIELLE.
 * En dessous, le nom est un fragment générique trop ambigu (voir matchTeamName).
 */
const MIN_PARTIAL_MATCH_LENGTH = 8;

/**
 * Matcher fuzzy entre nom stocké (Cornervalue) et nom requête (BSD).
 *
 * ## Pourquoi la correspondance partielle est limitée
 *
 * Le scraper a tronqué des noms de clubs : `Madrid` (Real ET Atlético Madrid),
 * `United` (Manchester / West Ham), `City`, `Town`, `County`, `Rovers`. Dans un
 * même JSON, `Madrid` porte les stats d'un club et celles de l'autre ne sont pas
 * identiques. Une correspondance par sous-chaîne non gardée ferait donc afficher les
 * corners de l'Atlético sur un match du Real Madrid.
 *
 * On refuse donc les correspondances partielles dont le nom stocké est trop court
 * pour être discriminant. Une ligne absente vaut mieux qu'une ligne d'un autre club :
 * ces valeurs servent à des décisions de pari.
 */
export function matchTeamName(cvName: string, fsName: string): boolean {
  const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const c = clean(cvName);
  const f = clean(fsName);
  if (c === f) return true;
  if (c.length < MIN_PARTIAL_MATCH_LENGTH) return false;
  return c.includes(f) || f.includes(c);
}

/**
 * Trouve les stats Cornervalue pour une equipe donnee.
 *
 * Les JSON livres par le scraper dupliquent les equipes (38 lignes pour 19 clubs sur
 * `cornervalue_italy.json`) : on retourne la PREMIERE occurrence, donc un seul
 * `find`. Le defaut du dedoublonnage cote scraper reste ouvert.
 */
export function findTeamCornerStats(
  teamName: string,
  cvData: CornervalueLeague | undefined,
): CornervalueTeam | undefined {
  if (!cvData?.teams) return undefined;
  return cvData.teams.find((t) => matchTeamName(t.teamName, teamName));
}
