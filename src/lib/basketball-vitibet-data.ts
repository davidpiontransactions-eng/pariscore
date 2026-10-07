/**
 * basketball-vitibet-data.ts — lecture du dump `data/basketball_vitibet_bsd.json`
 * produit par `scripts/pipeline-basketball-vitibet-bsd.ts`.
 *
 * Ce dump est la SEULE ingestion 1xBet du projet (Vitibet + BSD). Il porte par
 * match : index Vitisport, probabilités 1/0/2, tip, Team Power, forme, H2H, et
 * l'appariement BSD quand il existe.
 *
 * ⚠️ RÈGLE : un champ absent reste `null`. Rien n'est recalculé, rien n'est
 * comblé par une moyenne de ligue. Le flag `predictionsAvailable` porte la
 * réalité par match — c'est lui qui décide si l'UI peut afficher un signal
 * financier.
 *
 * ⚠️ Piège prod (même famille que `basketball-history-db`, entry 99) : sous
 * pm2 le cwd du process Next standalone est `.next/standalone`, dont la copie
 * `data/` est tracée au build. Ordre des candidats : racine projet (parent)
 * > cwd. Fichier absent → `null`, jamais une liste vide présentée comme
 * « aucune donnee disponible » : l'API distingue les deux cas.
 */

import fs from "node:fs";
import path from "node:path";

import { toBasketballLeagueId } from "./basketball-vitibet-league";
import type { BasketballLeagueId } from "./basketball-data";

/** Un match tel que stocké par le pipeline. Tous les champs optionnels = null si absents. */
type RawVitibetMatch = {
  match_id?: string;
  datetime?: string;
  status?: string;
  home_score?: number | null;
  away_score?: number | null;
  home_team?: {
    name?: string;
    bsd_team_id?: number | null;
    quarter_scores?: unknown[] | null;
    stats?: Record<string, number | null>;
    top_players?: unknown[];
  };
  away_team?: {
    name?: string;
    bsd_team_id?: number | null;
    quarter_scores?: unknown[] | null;
    stats?: Record<string, number | null>;
    top_players?: unknown[];
  };
  vitibet_data?: {
    vitisport_index?: number | null;
    probabilities?: { home?: number | null; away?: number | null };
    probabilities_draw?: number | null;
    tip?: string | null;
    predicted_score?: string | null;
    team_power?: { home?: number | null; away?: number | null };
    calc_form?: { home?: number | null; away?: number | null };
    h2h?: Array<{
      date?: string;
      team1?: string;
      team2?: string;
      score1?: number | null;
      score2?: number | null;
    }>;
  };
  bsd_enrichment?: Record<string, unknown> | null;
};

type RawLeague = {
  league_id?: string;
  league_name?: string;
  country?: string;
  vitibet_url?: string;
  matches?: RawVitibetMatch[];
};

type RawDump = {
  scraped_at?: string;
  sport?: string;
  source?: string;
  leagues?: RawLeague[];
};

/** Fiche d'une équipe, stats BSD comprises (null si non appariée). */
export type VitibetTeam = {
  name: string;
  bsdTeamId: number | null;
  /** Points par game — null si BSD n'a pas apparié cette équipe. */
  pointsPerGame: number | null;
  /** true seulement si la source publie réellement ces stats. */
  statsAvailable: boolean;
  topPlayers: unknown[];
};

/** Un match 1xBet, filtré sur les ligues calibrées. */
export type VitibetFixture = {
  id: string;
  /** Clé catalogue (`BasketballLeagueId`) — jamais le nom Vitibet. */
  league: BasketballLeagueId;
  /** Nom Vitibet d'origine, pour traçabilité et debug. */
  vitibetLeague: string;
  country: string;
  scheduledAt: string;
  status: string;
  home: VitibetTeam;
  away: VitibetTeam;
  homeScore: number | null;
  awayScore: number | null;

  /** ⚠️ `true` ⇔ proba domicile ET extérieure publiées par la source. */
  predictionsAvailable: boolean;
  /** Raison de l'absence — affichable, jamais une chaîne vide. */
  predictionsUnavailableReason: string | null;
  /** Index Vitisport — null si absent. */
  index: number | null;
  probHome: number | null;
  probDraw: number | null;
  probAway: number | null;
  /** « 1 » / « 2 » / null. Dérivé uniquement de probas réelles. */
  tip: string | null;
  predictedScore: string | null;
  teamPower: { home: number | null; away: number | null };
  form: { home: number | null; away: number | null };
  h2h: Array<{ date: string | null; home: string; away: string; homeScore: number | null; awayScore: number | null }>;
  /** true si l'appariement BSD a réussi pour au moins une des deux équipes. */
  bsdMatched: boolean;
};

/** Charge utile complète du dump. */
export type VitibetSnapshot = {
  scrapedAt: string | null;
  /** Ligues Vitibet présentes dans le dump, avant filtrage. */
  sourceLeagues: number;
  matchesInSource: number;
  /** Matchs retenus après filtrage ligues calibrées. */
  matches: VitibetFixture[];
  /** Ligues Vitibet écartées, avec le motif — pour que le refus soit visible. */
  skippedLeagues: Array<{ vitibetLeague: string; country: string; matches: number; reason: string }>;
};

/**
 * Candidats de localisation, évalués À L'APPEL et non à l'import.
 *
 * Construits au chargement du module, ils figeaient `process.cwd()` : un
 * changement de cwd ultérieur (cas de test) ne changeait rien, et la logique
 * « cwd puis parent » ne se réévalue pas. Coût nul (deux `path.join`).
 */
function fileCandidates(): string[] {
  return [
    path.join(process.cwd(), "data", "basketball_vitibet_bsd.json"),
    path.join(process.cwd(), "..", "data", "basketball_vitibet_bsd.json"),
  ];
}

function locateDump(): string | null {
  for (const f of fileCandidates()) {
    try {
      // turbopackIgnore : candidats calculés à l'exécution — bead ParisScorebis-r4g8.
      if (fs.existsSync(/*turbopackIgnore: true*/ f)) return f;
    } catch {
      /* suivant */
    }
  }
  return null;
}

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

function readTeam(raw: RawVitibetMatch["home_team"]): VitibetTeam {
  const stats = raw?.stats ?? null;
  const ppg = num(stats?.points_per_game);
  return {
    name: raw?.name ?? "?",
    bsdTeamId: num(raw?.bsd_team_id),
    pointsPerGame: ppg,
    // `points_per_game: null` est le cas « BSD non apparié » : une clé présente
    // mais nulle ne vaut pas une mesure.
    statsAvailable: ppg !== null,
    topPlayers: Array.isArray(raw?.top_players) ? raw.top_players : [],
  };
}

function toFixture(
  m: RawVitibetMatch,
  league: BasketballLeagueId,
  vitibetLeague: string,
  country: string,
): VitibetFixture {
  const v = m.vitibet_data ?? null;
  const probHome = num(v?.probabilities?.home);
  const probAway = num(v?.probabilities?.away);
  const index = num(v?.vitisport_index);

  // Même règle que `vitibetPrediction` : la présence se judge sur les
  // probabilités, jamais sur l'index (mesuré : index -10.42 avec 0%/0%/0%).
  const predictionsAvailable = probHome !== null && probHome > 0 && probAway !== null && probAway > 0;
  const reason = predictionsAvailable
    ? null
    : index !== null
      ? "Vitibet publie un index mais aucune probabilité pour ce match (cellules 0%)."
      : "Vitibet ne publie ni index ni probabilité pour ce match.";

  const home = readTeam(m.home_team);
  const away = readTeam(m.away_team);

  return {
    id: String(m.match_id ?? ""),
    league,
    vitibetLeague,
    country,
    scheduledAt: m.datetime ?? "",
    status: m.status ?? "unknown",
    home,
    away,
    homeScore: num(m.home_score),
    awayScore: num(m.away_score),
    predictionsAvailable,
    predictionsUnavailableReason: reason,
    index,
    probHome,
    probDraw: num(v?.probabilities_draw),
    probAway,
    tip: v?.tip ?? (predictionsAvailable ? (probHome >= probAway ? "1" : "2") : null),
    predictedScore: v?.predicted_score ?? null,
    // ⚠️ `team_power` et `calc_form` sortent à **0** sur tous les pop-ups sans
    // prédiction — mesuré : 228 zéros, 0 null sur 300 valeurs (NBA inclus). Ce
    // n'est pas une mesure (0 est un Team Power plausible à mi-parcours) mais le
    // `toNum(null) → 0` du parseur. Traiter 0 comme absent, sinon l'UI affiche
    // « Power 0.0 » là où la source n'a rien publié.
    teamPower: {
      home: predictionsAvailable ? num(v?.team_power?.home) : null,
      away: predictionsAvailable ? num(v?.team_power?.away) : null,
    },
    form: {
      home: predictionsAvailable ? num(v?.calc_form?.home) : null,
      away: predictionsAvailable ? num(v?.calc_form?.away) : null,
    },
    h2h: (v?.h2h ?? []).map((r) => ({
      date: r.date ?? null,
      home: r.team1 ?? "?",
      away: r.team2 ?? "?",
      homeScore: num(r.score1),
      awayScore: num(r.score2),
    })),
    bsdMatched: home.statsAvailable || away.statsAvailable,
  };
}

/**
 * Lit le dump et ne retourne que les matchs de ligues calibrées.
 *
 * Le filtrage est fait ICI, une seule fois : la route ne voit jamais un match
 * d'une ligue sans base mesurée, donc elle ne peut pas le publier par oubli.
 */
export function loadVitibetSnapshot(
  leagues: readonly BasketballLeagueId[],
): VitibetSnapshot | null {
  const file = locateDump();
  if (!file) return null;

  let raw: RawDump;
  try {
    raw = JSON.parse(fs.readFileSync(/*turbopackIgnore: true*/ file, "utf8")) as RawDump;
  } catch {
    // Dump illisible ≠ « aucune donnée » : on renvoie null et l'API l'annonce.
    return null;
  }

  const allowed = new Set<BasketballLeagueId>(leagues);
  const matches: VitibetFixture[] = [];
  const skippedLeagues: VitibetSnapshot["skippedLeagues"] = [];
  let matchesInSource = 0;

  for (const lg of raw.leagues ?? []) {
    const vitibetLeague = (lg.league_name ?? "").trim();
    const country = lg.country ?? "";
    const lm = lg.matches ?? [];
    matchesInSource += lm.length;

    const id = toBasketballLeagueId(vitibetLeague);
    if (!id) {
      skippedLeagues.push({
        vitibetLeague,
        country,
        matches: lm.length,
        reason: "aucune clé de catalogue vérifiée pour ce nom de ligue",
      });
      continue;
    }
    if (!allowed.has(id)) {
      skippedLeagues.push({
        vitibetLeague,
        country,
        matches: lm.length,
        reason: `ligue ${id} sans base mesurée — aucun marché publiable`,
      });
      continue;
    }
    for (const m of lm) matches.push(toFixture(m, id, vitibetLeague, country));
  }

  return {
    scrapedAt: raw.scraped_at ?? null,
    sourceLeagues: (raw.leagues ?? []).length,
    matchesInSource,
    matches: matches.sort(
      (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
    ),
    skippedLeagues,
  };
}