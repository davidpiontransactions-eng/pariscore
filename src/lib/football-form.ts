import { readFileSync, existsSync } from "fs";
import { join } from "path";
import type { BSDFootballMatch } from "@/lib/bsd-football-fetcher";

/**
 * Forme récente par équipe (Domicile / Extérieur) issue de soccerstats.com
 * (`formtable.asp`, scrapé par scripts/scrape_form.py → public/data/form/*.json).
 * Utilisée pour scorer les stratégies « attaque / défense » qui n'ont pas
 * d'équivalent dérivable des cotes.
 */

export type FormRow = {
  teamName: string;
  gp: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
};

export type LeagueForm = {
  meta: { leagueId: string; season: string; window: number; partial: boolean; lastUpdated: string };
  home: FormRow[];
  away: FormRow[];
};

const FORM_DIR = join(process.cwd(), "public", "data", "form");

// ── Normalisation de noms : BSD / soccerstats → clé canonique ──

/**
 * Normalise un nom d'équipe en clé de match.
 * - minuscules, sans diacritiques, sans ponctuation/espaces
 * - retire les préfixes/suffixes institutionnels fréquents (FC, CF, SC, SSC,
 *   AC, AFC, RCD, CD, CA, AS, IF, BK, FK, SK, 'F.C.', 'C.F.', UTD, AFC, …)
 * - réduit quelques abréviations communes
 */
function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

const ALIASES: Record<string, string> = {
  "manchester": "manchester",
  "manutd": "manchester united",
  "nottmforest": "nottingham forest",
  "nottsforest": "nottingham forest",
  "wl": "wolverhampton",
  "wolves": "wolverhampton",
  "spurs": "tottenham",
  "newcastle": "newcastle united",
  "westbrom": "westbromwich",
  "westham": "westham united",
  "leicester": "leicester city",
  "leedsonly": "leeds united", // garde-fou (peu probable)
  "psg": "paris saint germain",
  "parissg": "paris saint germain",
  "marseille": "marseille",
  "olympiquemarseille": "marseille",
  "lyon": "lyon",
  "olympiquelyonnais": "lyon",
  "monaco": "monaco",
  "asmonaco": "monaco",
  "atleticomadrid": "atletico madrid",
  "atmadrid": "atletico madrid",
  "realmadrid": "real madrid",
  "barcelona": "barcelona",
  "fcbarcelona": "barcelona",
  "fcp:o": "barcelona",
  "fcp o": "barcelona",
  "porto": "porto",
  "fcporto": "porto",
  "benfica": "benfica",
  "sporting": "sporting",
  "sportingcp": "sporting",
  "sporting cpl": "sporting",
  "sportinglisboa": "sporting",
  "ajax": "ajax amsterdam",
  "ajaxamsterdam": "ajax amsterdam",
  "psv": "psv",
  "feyenoord": "feyenoord",
  "az": "az alkmaar",
  "azalkmaar": "az alkmaar",
  "fenerbahce": "fenerbahce",
  "fenerbahçe": "fenerbahce",
  "galatasaray": "galatasaray",
  "besiktas": "besiktas",
  "celtic": "celtic",
  "rangers": "rangers",
};

/** Clé de match d'un nom BSD ou soccerstats. */
export function formKey(name: string): string {
  if (!name) return "";
  let s = stripDiacritics(name).toLowerCase();
  s = s.replace(/[^a-z0-9]/g, "");
  // Prune des préfixes/suffixes institutionnels
  s = s.replace(/^(rcd|rsc|sc|ssc|ac|afc|cd|ca|as|cf|fc|if|bk|fk|sk|us|utc|god|sbv|sv|vfl|vfl|vfb|borussia|1fc|1[sş]\/)+/, "");
  s = s.replace(/(utd|united|wanderers|rovers|athletic|athletic|city|town|county|fc|cf|sc|scc|afc|ac)$/g, "");
  s = s.replace(/^(fenerbahçe|fenerbahce)$/, "fenerbahce");
  if (ALIASES[s]) return ALIASES[s];
  return s;
}

// ── Chargement + index ──

const cache = new Map<string, LeagueForm | null>();

function readForm(slug: string): LeagueForm | null {
  if (cache.has(slug)) return cache.get(slug) ?? null;
  let data: LeagueForm | null = null;
  try {
    const file = join(FORM_DIR, `${slug}.json`);
    if (existsSync(file)) data = JSON.parse(readFileSync(file, "utf-8")) as LeagueForm;
  } catch {
    data = null;
  }
  cache.set(slug, data);
  return data;
}

export type FormAgg = {
  gp: number;
  gf: number;
  ga: number;
  ppg: number;
};

function agg(rows: FormRow[]): FormAgg {
  const gp = rows.reduce((s, r) => s + (r.gp || 0), 0);
  const gf = rows.reduce((s, r) => s + (r.gf || 0), 0);
  const ga = rows.reduce((s, r) => s + (r.ga || 0), 0);
  const pts = rows.reduce((s, r) => s + (r.w * 3 + r.d), 0);
  return { gp, gf, ga, ppg: gp > 0 ? pts / gp : 0 };
}

/**
 * Forme Domicile / Extérieur d'un match, indexée par slugs ligue.
 *
 * @param slugsByLeague Map slug interne → true, parcouru pour trouver la ligue
 * @param match fixture BSD
 *
 * Retourne null si la ligue n'a pas de forme ou si les équipes sont introuvables.
 */
export function matchForm(
  leagueSlug: string | undefined,
  match: BSDFootballMatch,
): { home: FormAgg; away: FormAgg } | null {
  if (!leagueSlug) return null;
  const form = readForm(leagueSlug);
  if (!form) return null;

  const homeKey = formKey(match.home_team_obj?.name ?? match.home_team);
  const awayKey = formKey(match.away_team_obj?.name ?? match.away_team);
  if (!homeKey || !awayKey) return null;

  const homeRow = form.home.find((r) => formKey(r.teamName) === homeKey);
  const awayRow = form.away.find((r) => formKey(r.teamName) === awayKey);
  if (!homeRow || !awayRow) return null;
  if (homeRow.gp < 1 || awayRow.gp < 1) return null;

  return { home: agg([homeRow]), away: agg([awayRow]) };
}

/**
 * Modèle de corners dérivé de la forme (résultats 2025/26).
 *
 * Les corners ne sont pas exposés en table scrapable fiable sur les sources
 * gratuites. On utilise donc un modèle empirique calé sur le volume de jeu de
 * la forme réelle : le total de corners d'un match est corrélé aux buts.
 * Calibration sur échantillon BSD (avgCorners≈11.8, avgGoals≈3.6) →
 * λCorners = BASE + buts × K, avec BASE≈7.5 et K≈1.2 (corners additionnels
 * générés par un jeu ouvert / déficit).
 */
const CORNERS_BASE = 7.5;
const CORNERS_PER_GOAL = 1.2;

/** Expected total corners du match (home + away), dérivés des buts attendus. */
export function expectedMatchCorners(m: { home: FormAgg; away: FormAgg }): number {
  const hGf = m.home.gp > 0 ? m.home.gf / m.home.gp : 0;
  const aGf = m.away.gp > 0 ? m.away.gf / m.away.gp : 0;
  // Expected goals du match : production offensive des deux équipes.
  const expectedGoals = hGf + aGf;
  return Math.max(0, CORNERS_BASE + expectedGoals * CORNERS_PER_GOAL);
}

/**
 * Scor « attaque » (expected goals) et « défense » (encaissés) d'un match,
 * dérivés de la forme Domicile (recevant) + Extérieur (visiteur).
 */
export function scoreFormMatch(m: { home: FormAgg; away: FormAgg }): {
  bestAttack: number;
  bestDefense: number;
  defensePick: "home" | "away";
  expectedCorners: number;
} {
  const hGf = m.home.gp > 0 ? m.home.gf / m.home.gp : 0;
  const aGf = m.away.gp > 0 ? m.away.gf / m.away.gp : 0;
  const hGa = m.home.gp > 0 ? m.home.ga / m.home.gp : 0;
  const aGa = m.away.gp > 0 ? m.away.ga / m.away.gp : 0;

  // Expected goals du match : chaque équipe score à son rythme (moyenne GF).
  const bestAttack = hGf + aGf;

  // Défense : la plus étanche (moins de buts encaissés par match).
  const bestDefense = Math.min(hGa, aGa);
  const defensePick: "home" | "away" = hGa <= aGa ? "home" : "away";

  return { bestAttack, bestDefense, defensePick, expectedCorners: expectedMatchCorners(m) };
}
