// Couche générique « ligue couverte par Vitibet » du modèle Pariscore handball.
//
// Extraite de handball-danish.ts : la conversion Vitibet → Pariscore est
// identique pour les ligues danoises et pour la MOL Liga Women. On garde donc
// UNE seule implémentation (Ladder échelon 2 : « ça existe déjà ») au lieu de
// dupliquer le parsing par ligue.
//
// Source Vitibet : 6 tableaux rendus en séquence (Overall / Home / Away /
// Form (last 6) / 1st Half / 2nd Half), colonnes # Team P W D L Score PTS.
// Modèle Pariscore : totaux + splits domicile/extérieur + moyennes + forme.

import { CMP_NEUTRAL_LAMBDA } from "./handball-cmp";

// ─── Forme BRUTE Vitibet ───

/** Une ligne d'un tableau Vitibet (Overall, Home ou Away). */
export type VitibetStandingRow = {
  rank: number;
  team: string;
  /** id d'image API-Sports (media.api-sports.io/handball/teams/NNN.png). */
  teamId: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  /** GF bruts (le « +diff » affiché à côté est recalculé, jamais utilisé). */
  goalsFor: number;
  goalsAgainst: number;
  points: number;
};

/** Un match à venir Vitibet (section « Upcoming Matches »). */
export type VitibetFixtureRow = {
  fixtureId: number;
  date: string;
  time: string;
  home: string;
  away: string;
  /** Score PRÉDIT par Vitibet (pas un résultat). null quand la source n'en publie pas. */
  predictedHome: number | null;
  /** Score prédit côté extérieur. null quand la source n'en publie pas. */
  predictedAway: number | null;
  /** true = statut temps réel (FT / 1H / 2H) au scrape. */
  live?: boolean;
  /**
   * Vitibet publie-t-il une PRÉDICTION pour ce match ?
   *
   * Granulaire par match, et non par ligue — c'est ce que la source donne
   * réellement (mesuré 2026-10-05) : Superlig 10 prédictions sur 19 matchs (les 9
   * autres sont des matchs terminés, sans prévision à faire), Liga Nationala
   * Women 0 sur 16. Une ligue peut donc avoir les deux.
   *
   * false ⇒ `tip`, `indexValue`, `prob*`, `predictedHome/Away` valent null. On ne
   * les comble JAMAIS par un calcul maison : une valeur présente sous le nom de
   * Vitibet qui n'en vient pas de Vitibet est un mensonge de provenance.
   */
  predictionsAvailable?: boolean;
  /** Conseil Vitibet (« 1 », « X », « 2 », …) ou null. */
  tip?: string | null;
  /** INDEX Vitisport, ex. 7 pour 61 % de probabilité. null si absent. */
  indexValue?: number | null;
  probHome?: number | null;
  probDraw?: number | null;
  probAway?: number | null;
  /** Score RÉEL d'un match terminé — historique, jamais prédiction. */
  finalHome?: number | null;
  finalAway?: number | null;
  hasFinalScore?: boolean;
};

/** Un match TERMINÉ (section « Latest results ») — base du backtesting. */
export type VitibetResultRow = {
  fixtureId: number;
  date: string;
  time: string;
  home: string;
  away: string;
  /** Score final réel. */
  homeGoals: number;
  awayGoals: number;
  /** Mi-temps réel, si la source l'affiche. */
  homeHalf: number | null;
  awayHalf: number | null;
  /**
   * true = entrée SYNTHÉTIQUE (absente de la source, générée pour couvrir
   * l'historique demandé). Les métriques ne doivent jamais présenter ces lignes
   * comme des résultats réels — cf. `syntheticCount` sur la ligue.
   */
  synthetic?: boolean;
};

// ─── Modèle Pariscore ───

export type SplitStats = {
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
};

/** Stats classiques enrichies : total + splits + moyennes + forme. */
export type TeamSeasonStats = SplitStats & {
  rank: number;
  team: string;
  teamId: number;
  points: number;
  home: SplitStats;
  away: SplitStats;
  scoredAvg: number;
  concededAvg: number;
  /** Points de victoire par match (2V + 1N, sur `played`). */
  ppg: number;
  /** Séquence de forme brute « WWDWL » (ancien → récent). */
  form: string;
};

export type LeagueMeta = {
  vitibetLeagueId: number;
  name: string;
  url: string;
  country: string;
  gender: "M" | "F";
  level: 1 | 2;
};

/** Ligue complète, telle que consommée par le popup. */
export type CoveredLeague = LeagueMeta & {
  /** Moyenne de buts par équipe et par match (base du Team Power). */
  baseline: number;
  /** Buts par MATCH (les 2 équipes) — c'est l'unité de la spec MOL Liga. */
  goalsPerMatch: number;
  standings: TeamSeasonStats[];
  fixtures: VitibetFixtureRow[];
  /** Matchs terminés (réels + synthétiques, voir `syntheticResults`). */
  results: VitibetResultRow[];
  /** Nombre d'entrées de `results` qui sont synthétiques. */
  syntheticResults: number;
};

// ─── Parsing ───

/**
 * Parse le score Vitibet « 272:233 +39 » (ou « 91:91 0 ») en GF/GA. La
 * différence après l'espace est ignorée : elle se recalcule en interne et ne
 * doit jamais être la source (Vitibet l'affiche avec ou sans « + »).
 */
export function parseVitibetScore(score: string): { goalsFor: number; goalsAgainst: number } | null {
  const m = score.trim().match(/^(\d{1,3})\s*:\s*(\d{1,3})/);
  if (!m) return null;
  return { goalsFor: Number(m[1]), goalsAgainst: Number(m[2]) };
}

/**
 * Normalise une séquence de forme Vitibet en W/D/L compact. Accepte les 2
 * formats rencontrés sur les pages scrapées :
 *   • « W W W W W D »      (espace séparé)
 *   • « *W**W**W**W**W* »  (cellule en italique Markdown)
 */
export function parseVitibetForm(raw: string): string {
  return raw.toUpperCase().replace(/[^WDL]/g, "").slice(0, 6);
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

function splitOf(row: VitibetStandingRow | null | undefined): SplitStats | null {
  if (!row) return null;
  return {
    played: row.played,
    wins: row.wins,
    draws: row.draws,
    losses: row.losses,
    goalsFor: row.goalsFor,
    goalsAgainst: row.goalsAgainst,
  };
}

function emptySplit(): SplitStats {
  return { played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 };
}

/**
 * Stats de saison d'une équipe à partir de ses lignes Vitibet + sa forme.
 *
 * Le TOTAL vient de la ligne Overall (officielle), pas de `home + away` : elle
 * reste correcte même si Vitibet a un match en cours non ventilé.
 *
 * null si la ligne Overall est absente ou incohérente (W+D+L ≠ P → ligne
 * corrompue) : l'appelant affiche un état vide, jamais une ligne de zéros.
 */
export function toPariscoreTeamStats(input: {
  overall: VitibetStandingRow;
  home?: VitibetStandingRow | null;
  away?: VitibetStandingRow | null;
  form?: string | null;
}): TeamSeasonStats | null {
  const { overall, home, away, form } = input;
  const played = overall.played;
  if (played <= 0) return null;
  if (overall.wins + overall.draws + overall.losses !== played) return null;
  return {
    rank: overall.rank,
    team: overall.team,
    teamId: overall.teamId,
    played,
    wins: overall.wins,
    draws: overall.draws,
    losses: overall.losses,
    goalsFor: overall.goalsFor,
    goalsAgainst: overall.goalsAgainst,
    points: overall.points,
    home: splitOf(home) ?? emptySplit(),
    away: splitOf(away) ?? emptySplit(),
    scoredAvg: round1(overall.goalsFor / played),
    concededAvg: round1(overall.goalsAgainst / played),
    ppg: round1((overall.wins * 2 + overall.draws) / played),
    form: parseVitibetForm(form ?? ""),
  };
}

// ─── Baseline de ligue ───

/**
 * Moyenne de buts par équipe et par match, dérivée du classement :
 * `Σ GF / (Σ P / 2) / 2`. Chaque équipe joue `played` matchs et chaque match
 * compte 2 fois dans Σ GF → Σ GF = buts totaux et le nombre de matchs vaut Σ P / 2.
 *
 * Référence du Team Power (spec Danoises §2.B : « rapporté à la moyenne du
 * championnat concerné »). null si aucun match joué (jamais NaN).
 */
export function deriveLeagueBaseline(standings: VitibetStandingRow[]): number | null {
  let goals = 0;
  let teamGames = 0;
  for (const r of standings) {
    goals += r.goalsFor;
    teamGames += r.played;
  }
  if (teamGames <= 0) return null;
  const matches = teamGames / 2;
  if (matches <= 0) return null;
  return round1(goals / matches / 2);
}

/** Mêmes agrégats mais exprimés en buts PAR MATCH (les 2 équipes). */
export function deriveGoalsPerMatch(standings: VitibetStandingRow[]): number | null {
  const perTeam = deriveLeagueBaseline(standings);
  return perTeam == null ? null : round1(perTeam * 2);
}

// ─── Lookups ───

/** Normalise un nom (casse, accents, ponctuation) pour le rapprochement. */
export function normTeamName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Vrai si le nom de ligue du snapshot correspond (gère le préfixe pays). */
export function leagueNameMatches(leagueName: string, candidate: string): boolean {
  const a = normTeamName(leagueName);
  const b = normTeamName(candidate);
  return a === b || a.endsWith(` ${b}`) || b.endsWith(` ${a}`);
}

/** Stats d'une équipe dans une ligue, par nom Vitibet. null si absente. */
export function findTeamStats(
  league: CoveredLeague,
  teamName: string,
): TeamSeasonStats | null {
  const target = normTeamName(teamName);
  return league.standings.find((s) => normTeamName(s.team) === target) ?? null;
}

/** Match à venir d'une rencontre. null si absent du calendrier Vitibet. */
export function findFixture(
  league: CoveredLeague,
  homeName: string,
  awayName: string,
): VitibetFixtureRow | null {
  const h = normTeamName(homeName);
  const a = normTeamName(awayName);
  return (
    league.fixtures.find((f) => normTeamName(f.home) === h && normTeamName(f.away) === a) ?? null
  );
}

/** Première base de buts non nulle parmi les ligues demandées. */
export function resolveLeagueMean(leagueName: string, leagues: CoveredLeague[]): number {
  const hit = leagues.find((l) => leagueNameMatches(leagueName, l.name));
  return hit ? hit.baseline : CMP_NEUTRAL_LAMBDA;
}

// ─── Assemblage depuis une fixture JSON ───

/** Shape d'une ligue dans le JSON de fixture (avant dérivation Pariscore). */
export type RawLeague = {
  key: string;
  vitibetLeagueId: number;
  name: string;
  url: string;
  country: string;
  gender: "M" | "F";
  level: 1 | 2;
  fixtures: VitibetFixtureRow[];
  standingsOverall: VitibetStandingRow[];
  standingsHome: VitibetStandingRow[];
  standingsAway: VitibetStandingRow[];
  form: Record<string, string>;
  /** Historique terminé ; absent = pas de backtesting possible. */
  results?: VitibetResultRow[];
};

/**
 * Construit une ligue couverte depuis sa section JSON.
 *
 * Le `baseline` est TOUJOURS dérivé du classement (jamais écrit en dur → jamais
 * désynchronisé des buts réels). `meta` fournit le libellé de confiance ; les
 * champs présents dans le JSON servent de repli.
 *
 * Les équipes absentes d'une ligne Home/Away gardent un split vide plutôt
 * qu'un split à 0 (sinon on afficherait « 0 buts à domicile »).
 */
export function buildLeagueFromFixture(raw: RawLeague, meta: LeagueMeta): CoveredLeague {
  const baseline = deriveLeagueBaseline(raw.standingsOverall) ?? CMP_NEUTRAL_LAMBDA;
  const byName = (rows: VitibetStandingRow[]) => {
    const m = new Map<string, VitibetStandingRow>();
    for (const r of rows) m.set(normTeamName(r.team), r);
    return m;
  };
  const home = byName(raw.standingsHome);
  const away = byName(raw.standingsAway);
  const standings: TeamSeasonStats[] = [];
  for (const o of raw.standingsOverall) {
    const key = normTeamName(o.team);
    const stats = toPariscoreTeamStats({
      overall: o,
      home: home.get(key) ?? null,
      away: away.get(key) ?? null,
      form: raw.form?.[o.team] ?? raw.form?.[key] ?? null,
    });
    if (stats) standings.push(stats);
  }
  const results = raw.results ?? [];
  return {
    ...meta,
    name: meta.name || raw.name,
    url: meta.url || raw.url,
    vitibetLeagueId: raw.vitibetLeagueId,
    country: meta.country || raw.country,
    gender: meta.gender ?? raw.gender,
    level: meta.level ?? raw.level,
    baseline,
    goalsPerMatch: deriveGoalsPerMatch(raw.standingsOverall) ?? round1(baseline * 2),
    standings,
    fixtures: raw.fixtures ?? [],
    results,
    syntheticResults: results.filter((r) => r.synthetic === true).length,
  };
}

/** Première ligue couverte dont le nom correspond. null si aucune. */
export function findCoveredLeague(
  leagueName: string,
  leagues: CoveredLeague[],
): CoveredLeague | null {
  return leagues.find((l) => leagueNameMatches(leagueName, l.name)) ?? null;
}

/** Base de buts d'une ligue couverte, ou null si elle n'est pas référencée. */
export function coveredLeagueBaseline(
  leagueName: string,
  leagues: CoveredLeague[],
): number | null {
  return findCoveredLeague(leagueName, leagues)?.baseline ?? null;
}
