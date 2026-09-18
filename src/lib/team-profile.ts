import {
  fdSeasons,
  fdStandings,
  fdTeamStats,
  type FdScope,
  type FdStandingRow,
} from "./football-fd";
import { footballElo, footballEloTotal, footballEloMean, normTeam } from "./football-elo";
import { teamInjuries, type InjuryEntry } from "./football-injuries";
import { teamLastMatches, fdHistory } from "./football-history";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import type { TeamAttackDefenseLeague } from "./football-data";

/**
 * Profil équipe saison — agrège football-data (classement + buts/corners par
 * contexte), Elo interne, infirmerie RotoWire et bonus FBref quand disponible.
 * Sert la route /api/football/teams/profile consommée par TeamProfileDialog.
 */

// Slug interne (epl…) -> slug soccerstats des team_stats_* FBref (partiel).
const FBREF_SLUG: Record<string, string> = {
  epl: "england",
  championship: "england2",
  ligue1: "france",
  ligue2: "france2",
  bundesliga: "germany",
  bundesliga2: "germany2",
  laliga: "spain",
  laliga2: "spain2",
  seriea: "italy",
  serieb: "italy2",
};

const clamp = (v: number): number => Math.min(95, Math.max(5, v));

/** Valeur brute -> 0-100 par z-score intra-ligue (moyenne = 50, écart-type = 15). */
function vsLeague(val: number, all: number[], higherBetter = true): number {
  if (all.length < 2) return 50;
  const mean = all.reduce((s, v) => s + v, 0) / all.length;
  const variance = all.reduce((s, v) => s + (v - mean) ** 2, 0) / all.length;
  const std = Math.sqrt(variance) || 1;
  const z = higherBetter ? (val - mean) / std : (mean - val) / std;
  return clamp(50 + z * 15);
}

export type ProfileMetric = {
  key: string;
  label: string;
  /** Score 0-100 vs ligue (même contexte). */
  score: number;
  /** Valeur brute d'affichage (ex. "2,16/m"). */
  display: string;
  rank: number | null;
};

export type PowerBlock = {
  score: number;
  rank: number;
  rankTotal: number;
  metrics: ProfileMetric[];
};

export type MarketSide = "home" | "draw" | "away";

export type MarketInput = {
  /** Probabilités fair modèle 0-1 (ex. prediction.homeProb/100). */
  fair: Record<MarketSide, number>;
  /** Cotes décimales marché (ex. view.odds). */
  odds: Record<MarketSide, number | null | undefined>;
};

/**
 * Edge (points) = P_fair − P_marché dé-viguée, arrondi à 0,1.
 * Null si cotes invalides (≤1, manquantes) ou fair hors [0,1].
 */
export function valueEdge(
  fairProb: number,
  odds: MarketInput["odds"],
  side: MarketSide,
): number | null {
  const { home, draw, away } = odds;
  if (
    !Number.isFinite(fairProb) || fairProb < 0 || fairProb > 1 ||
    home == null || draw == null || away == null ||
    home <= 1 || draw <= 1 || away <= 1
  ) {
    return null;
  }
  const invH = 1 / home, invD = 1 / draw, invA = 1 / away;
  const overround = invH + invD + invA;
  const marketFair = (side === "home" ? invH : side === "draw" ? invD : invA) / overround;
  return Math.round((fairProb - marketFair) * 1000) / 10;
}

export type TeamProfile = {
  team: string;
  leagueId: string;
  venue: FdScope;
  season: string;
  standing: FdStandingRow & { rank: number; rankTotal: number };
  overall: FdStandingRow & { rank: number; rankTotal: number };
  attack: PowerBlock;
  defense: PowerBlock;
  strengths: string[];
  weaknesses: string[];
  elo: { elo: number; rank: number; rankTotal: number } | null;
  /** Force de calendrier v1 = Elo moyen de la ligue hors l'équipe (T10 affinera par adversaire). */
  sos: number | null;
  /** Écart buts/m − xG/m (contexte FD vs xG FBref overall, null si FBref absent). */
  xgDiff: number | null;
  /** "chaud" si xgDiff > +0.5, "froid" si < −0.5 (signal de réversion). */
  reversion: "chaud" | "froid" | null;
  /** Value modèle-vs-marché sur le camp de l'équipe (null si cotes/probas absentes). */
  value: { side: MarketSide; edgePct: number } | null;
  /** Alertes edge automatiques (max 2). */
  alerts: string[];
  /**
   * Discipline équipe L5 (CSV = comptes par équipe, PAS de noms de joueurs :
   * aucun suspendu nominatif affiché, jamais inventé).
   */
  discipline: { yellows: number; reds: number; redLastMatch: boolean; sample: number } | null;
  /** Congestion : jours depuis le dernier match, matchs prévus à 14 j. */
  congestion: { restDays: number | null; next14d: number; congested: boolean };
  /** Steam moyen : mouvement ouverture (Avg) → clôture (PS) sur les matchs de l'équipe. */
  clv: { samples: number; avgMovePct: number } | null;
  /** Arbitre le plus fréquent (saison) : tendance cartons + bilan de l'équipe avec lui. */
  referee: { name: string; matches: number; avgCards: number; teamW: number; teamD: number; teamL: number } | null;
  /** PPG contexte corrigé : ppg + (sos - 1500) / 400 (400 pts Elo ≈ 1 pt/match). */
  ppmAjuste: number | null;
  injuries: { list: InjuryEntry[]; updatedAt: string } | null;
  /** False = ligue hors couverture RotoWire (5 grands championnats). */
  injuriesCovered: boolean;
};

// Alias noms longs BSD -> noms courts football-data (appliqué à l'entrée).
const TEAM_ALIASES: Record<string, string> = {
  manchesterunited: "manunited",
  manchestercity: "mancity",
  newcastleunited: "newcastle",
  nottinghamforest: "nottmforest",
  tottenhamhotspur: "tottenham",
  brightonhovealbion: "brighton",
  westhamunited: "westham",
  leicestercity: "leicester",
  parissaintgermain: "parissg",
  stadebrestois: "brest",
  staderennais: "rennes",
  atleticomadrid: "athmadrid",
  athleticbilbao: "athbilbao",
  realsociedad: "sociedad",
  rayovallecano: "vallecano",
  eintrachtfrankfurt: "einfrankfurt",
};

/** Clé canonique : normalisation + alias noms longs/shorts (entrée ET référentiels). */
function canonKey(name: string): string {
  const n = normTeam(name);
  return TEAM_ALIASES[n] ?? n;
}

function withRank(
  rows: FdStandingRow[] | null,
  teamKey: string,
): (FdStandingRow & { rank: number; rankTotal: number }) | null {
  if (!rows) return null;
  const idx = rows.findIndex((r) => normTeam(r.team) === teamKey);
  if (idx < 0) return null;
  return { ...rows[idx], rank: idx + 1, rankTotal: rows.length };
}

function readFbref(slug: string): TeamAttackDefenseLeague | null {
  const ss = FBREF_SLUG[slug];
  if (!ss) return null;
  try {
    const file = join(process.cwd(), "public", "data", "metrics", `team_stats_${ss}.json`);
    if (!existsSync(file)) return null;
    return JSON.parse(readFileSync(file, "utf-8")) as TeamAttackDefenseLeague;
  } catch {
    return null;
  }
}

const frNum = (v: number, digits = 2): string =>
  v.toFixed(digits).replace(".", ",");

/**
 * Construit le profil complet d'une équipe (null si ligue/équipe inconnue).
 * `venue` = rôle dans le match cliqué : "home" (domicile) ou "away".
 */
export function buildTeamProfile(
  leagueId: string,
  team: string,
  venue: FdScope,
  market?: MarketInput,
): TeamProfile | null {
  const seasons = fdSeasons(leagueId);
  if (seasons.length === 0) return null;
  const season = seasons[0];
  const scope: FdScope = venue;

  const scopeRows = fdStandings(leagueId, season, scope);
  const overallRows = fdStandings(leagueId, season, "overall");
  const teamKey = canonKey(team);
  // Jointure floue : égalité normalisée puis inclusion (ex. "Paris SG" / "PSG").
  const resolveName = (rows: FdStandingRow[] | null): string | null => {
    if (!rows) return null;
    const exact = rows.find((r) => normTeam(r.team) === teamKey);
    if (exact) return exact.team;
    const partial = rows.find(
      (r) => normTeam(r.team).includes(teamKey) || teamKey.includes(normTeam(r.team)),
    );
    return partial?.team ?? null;
  };
  const fdName = resolveName(scopeRows) ?? resolveName(overallRows);
  if (!fdName) return null;
  const fdKey = normTeam(fdName);

  const standing = withRank(scopeRows, fdKey);
  const overall = withRank(overallRows, fdKey);
  if (!standing || !overall) return null;
  const stats = fdTeamStats(leagueId, season, fdName);
  if (!stats) return null;

  const ctx = stats[scope] ?? stats.overall;
  const N = scopeRows?.length ?? 0;

  // Bonus FBref (overall uniquement, absent = poids renormalisés).
  const fbref = readFbref(leagueId);
  const ad = fbref?.teams.find((t) => canonKey(t.teamName) === fdKey);

  // — Distributions ligue (même contexte) pour la normalisation —
  // Accès direct aux champs du contexte FD (évite la closure ci-dessus).
  const distOf = (
    field: "gfPg" | "gaPg" | "o15" | "u35" | "bttsYesPct" | "cornersForPg" | "ppm",
  ): { val: number; all: number[] } => {
    const all: number[] = [];
    let val = 0;
    for (const row of scopeRows ?? []) {
      const s = fdTeamStats(leagueId, season, row.team)?.[scope];
      if (!s || s.gp === 0) continue;
      const v = s[field] as number;
      all.push(v);
      if (normTeam(row.team) === fdKey) val = v;
    }
    return { val, all };
  };

  const rankOf = (
    field: "gfPg" | "gaPg" | "o15" | "u35" | "bttsYesPct" | "cornersForPg" | "ppm",
    higherBetter = true,
  ): number | null => {
    const { val, all } = distOf(field);
    if (all.length === 0) return null;
    const sorted = [...all].sort((a, b) => (higherBetter ? b - a : a - b));
    const idx = sorted.indexOf(val);
    return idx < 0 ? null : idx + 1;
  };

  // — PowerScore Attaque (pondérations validées produit) —
  // buts marqués PG 40 % · Over 1,5 % 20 % · BTTS % 15 % · corners/m 10 % · xG 15 % (bonus).
  const gf = distOf("gfPg");
  const o15 = distOf("o15");
  const btts = distOf("bttsYesPct");
  const corn = distOf("cornersForPg");
  const atkParts: { w: number; s: number }[] = [
    { w: 40, s: vsLeague(gf.val, gf.all, true) },
    { w: 20, s: vsLeague(o15.val, o15.all, true) },
    { w: 15, s: vsLeague(btts.val, btts.all, true) },
    { w: 10, s: vsLeague(corn.val, corn.all, true) },
  ];
  const atkMetrics: ProfileMetric[] = [
    { key: "gfPg", label: "Buts marqués/match", score: atkParts[0].s, display: `${frNum(ctx.gfPg)}/m`, rank: rankOf("gfPg", true) },
    { key: "o15", label: "Over 1,5 buts", score: atkParts[1].s, display: `${frNum(ctx.o15, 1)} %`, rank: rankOf("o15", true) },
    { key: "btts", label: "Les 2 marquent", score: atkParts[2].s, display: `${frNum(ctx.bttsYesPct, 1)} %`, rank: rankOf("bttsYesPct", true) },
    { key: "corn", label: "Corners/match", score: atkParts[3].s, display: `${frNum(ctx.cornersForPg)}/m`, rank: rankOf("cornersForPg", true) },
  ];
  if (ad?.attack.xGPerGame != null && fbref) {
    const xgs = fbref.teams.map((t) => t.attack.xGPerGame ?? 0).filter((v) => v > 0);
    const xs = vsLeague(ad.attack.xGPerGame, xgs.length > 1 ? xgs : [ad.attack.xGPerGame, ad.attack.xGPerGame], true);
    atkParts.push({ w: 15, s: xs });
    atkMetrics.push({
      key: "xg", label: "xG/match (FBref)", score: Math.round(xs),
      display: `${frNum(ad.attack.xGPerGame)}/m`,
      rank: ad.attack.xGPerGameRank ?? null,
    });
  }
  const atkW = atkParts.reduce((s, p) => s + p.w, 0);
  const atkScore = Math.round(atkParts.reduce((s, p) => s + p.s * p.w, 0) / atkW);

  // — PowerScore Défense —
  // buts encaissés PG inversé 45 % · Under 3,5 % 20 % · clean sheets 20 % (bonus) · tacles+ 15 % (bonus).
  const ga = distOf("gaPg");
  const u35 = distOf("u35");
  const defParts: { w: number; s: number }[] = [
    { w: 45, s: vsLeague(ga.val, ga.all, false) },
    { w: 20, s: vsLeague(u35.val, u35.all, true) },
  ];
  const defMetrics: ProfileMetric[] = [
    { key: "gaPg", label: "Buts encaissés/match", score: defParts[0].s, display: `${frNum(ctx.gaPg)}/m`, rank: rankOf("gaPg", false) },
    { key: "u35", label: "Under 3,5 buts", score: defParts[1].s, display: `${frNum(ctx.u35, 1)} %`, rank: rankOf("u35", true) },
  ];
  if (ad?.defense.cleanSheetPct != null && fbref) {
    const css = fbref.teams.map((t) => t.defense.cleanSheetPct ?? 0).filter((v) => v > 0);
    const cs = vsLeague(ad.defense.cleanSheetPct, css.length > 1 ? css : [ad.defense.cleanSheetPct, ad.defense.cleanSheetPct], true);
    defParts.push({ w: 20, s: cs });
    defMetrics.push({
      key: "cs", label: "Clean sheets (FBref)", score: Math.round(cs),
      display: `${frNum(ad.defense.cleanSheetPct, 1)} %`,
      rank: ad.defense.cleanSheetPctRank ?? null,
    });
  }
  if (ad?.defense.defActionsPerGame != null && fbref) {
    const das = fbref.teams.map((t) => t.defense.defActionsPerGame ?? 0).filter((v) => v > 0);
    const da = vsLeague(ad.defense.defActionsPerGame, das.length > 1 ? das : [ad.defense.defActionsPerGame, ad.defense.defActionsPerGame], true);
    defParts.push({ w: 15, s: da });
    defMetrics.push({
      key: "da", label: "Actions déf./match", score: Math.round(da),
      display: `${frNum(ad.defense.defActionsPerGame)}/m`,
      rank: ad.defense.defActionsPerGameRank ?? null,
    });
  }
  const defW = defParts.reduce((s, p) => s + p.w, 0);
  const defScore = Math.round(defParts.reduce((s, p) => s + p.s * p.w, 0) / defW);

  // — Rang des PowerScores : proxy par le rang buts marqués/encaissés
  // (même contexte) — le score exact est déjà normalisé intra-ligue.

  // — Forces / faiblesses : rangs ≤ 3 = force, rangs ≥ N-2 = faiblesse —
  const allMetrics = [...atkMetrics, ...defMetrics];
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  for (const m of allMetrics) {
    if (m.rank == null || N === 0) continue;
    if (m.rank <= 3) strengths.push(`${m.label} (#${m.rank}/${N})`);
    else if (m.rank >= N - 2) weaknesses.push(`${m.label} (#${m.rank}/${N})`);
  }
  // Compléments classement : PPG contexte et Elo.
  const eloEntry = footballElo(leagueId, fdName);
  const sos = footballEloMean(leagueId, fdName);
  // Debug temporaire — retirer après diagnostic.
  if (eloEntry == null && sos == null) {
    console.error("[team-profile] elo/sos null:", { leagueId, fdName, fdKey, teamKey });
  }
  const ppmAjuste =
    sos == null ? null : Math.round((standing.ppg + (sos - 1500) / 400) * 100) / 100;
  if (standing.rank <= 3) strengths.unshift(`PPG ${scopeLabel(scope)} (#${standing.rank}/${N})`);
  if (standing.rank >= N - 2 && N > 0) weaknesses.unshift(`PPG ${scopeLabel(scope)} (#${standing.rank}/${N})`);

  const atkRank = rankOf("gfPg", true) ?? Math.round(N / 2);
  const defRank = rankOf("gaPg", false) ?? Math.round(N / 2);

  const inj = teamInjuries(leagueId, fdName);

  // Discipline L5 saison courante (comptes équipe home/away, pas nominatif).
  const last5 = teamLastMatches(leagueId, season, fdName, 5);
  let yellows = 0, reds = 0, redLastMatch = false;
  last5.forEach((m, i) => {
    const isHome = normTeam(m.home) === fdKey;
    yellows += (isHome ? m.hy : m.ay) ?? 0;
    const r = (isHome ? m.hr : m.ar) ?? 0;
    reds += r;
    if (i === 0 && r > 0) redLastMatch = true;
  });
  const discipline = last5.length > 0 ? { yellows, reds, redLastMatch, sample: last5.length } : null;

  // Congestion + steam : historique brut de la saison (joués + à venir).
  // Fallback saison précédente si la saison courante n'a pas encore d'historique
  // (début de saison, CSV scrapés avant ajout clé history).
  const todayISO = new Date().toISOString().slice(0, 10);
  const in14d = new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10);
  const prevSeason = fdSeasons(leagueId).find((s) => s !== season);
  const allRowsRaw = fdHistory(leagueId, season) ?? [];
  const allRows = allRowsRaw.length > 0
    ? allRowsRaw
    : (prevSeason ? fdHistory(leagueId, prevSeason) ?? [] : []);
  const teamRows = allRows.filter(
    (r) => normTeam(r.home) === fdKey || normTeam(r.away) === fdKey,
  );
  // Debug temporaire — retirer après diagnostic.
  if (allRows.length === 0) {
    console.error("[team-profile] history empty:", { leagueId, season, teamRows: teamRows.length });
  }
  const playedRows = teamRows.filter((r) => r.hg != null);
  const lastPlayed = playedRows.length > 0 ? playedRows[playedRows.length - 1].date : null;
  const restDays =
    lastPlayed == null
      ? null
      : Math.max(0, Math.round((Date.parse(todayISO) - Date.parse(lastPlayed)) / 864e5));
  const next14d = teamRows.filter((r) => r.hg == null && r.date >= todayISO && r.date <= in14d).length;
  const congestion = { restDays, next14d, congested: next14d >= 3 };

  // Steam : (clôture − ouverture) / ouverture sur les 10 derniers joués du contexte.
  // allRows inclut déjà le fallback saison précédente (voir plus haut).
  const steamPool = teamRows;
  const steamRows = steamPool
    .filter((r) => {
      if (r.hg == null) return false;
      const isHome = normTeam(r.home) === fdKey;
      if (scope === "home" && !isHome) return false;
      if (scope === "away" && isHome) return false;
      const avg = isHome ? r.avgH : r.avgA;
      const ps = isHome ? r.psH : r.psA;
      return avg != null && ps != null && avg > 1;
    })
    .slice(-10);
  const moves = steamRows.map((r) => {
    const isHome = normTeam(r.home) === fdKey;
    const avg = (isHome ? r.avgH : r.avgA) as number;
    const ps = (isHome ? r.psH : r.psA) as number;
    return ((ps - avg) / avg) * 100;
  });
  const clv =
    moves.length > 0
      ? { samples: moves.length, avgMovePct: Math.round((moves.reduce((s, v) => s + v, 0) / moves.length) * 10) / 10 }
      : null;

  // Arbitre le plus fréquent de l'équipe (saison) : cartons/match ligue + bilan équipe.
  const refCounts = new Map<string, number>();
  for (const m of teamRows) {
    if (m.hg == null || !m.referee) continue;
    refCounts.set(m.referee, (refCounts.get(m.referee) ?? 0) + 1);
  }
  let referee: TeamProfile["referee"] = null;
  if (refCounts.size > 0) {
    const topRef = [...refCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const withRef = allRows.filter((r) => r.hg != null && r.referee === topRef);
    const cards = withRef.map((r) => (r.hy ?? 0) + (r.ay ?? 0));
    let teamW = 0, teamD = 0, teamL = 0;
    for (const m of withRef) {
      const isHome = normTeam(m.home) === fdKey;
      if (!isHome && normTeam(m.away) !== fdKey) continue;
      const won = isHome ? m.ftr === "H" : m.ftr === "A";
      const drawn = m.ftr === "D";
      if (won) teamW++;
      else if (drawn) teamD++;
      else teamL++;
    }
    referee = {
      name: topRef,
      matches: withRef.length,
      avgCards: Math.round((cards.reduce((s, v) => s + v, 0) / cards.length) * 10) / 10,
      teamW, teamD, teamL,
    };
  }

  // Écart buts/m (contexte) − xG/m (FBref overall) : sur/sous-performance.
  const xgDiff =
    ad?.attack.xGPerGame != null
      ? Math.round((ctx.gfPg - ad.attack.xGPerGame) * 100) / 100
      : null;
  const reversion: "chaud" | "froid" | null =
    xgDiff == null ? null : xgDiff > 0.5 ? "chaud" : xgDiff < -0.5 ? "froid" : null;

  // Value : camp suivi = domicile/extérieur selon venue, meilleur des deux en général.
  let value: TeamProfile["value"] = null;
  if (market) {
    const sides: MarketSide[] = scope === "overall" ? ["home", "away"] : [scope];
    let best: TeamProfile["value"] = null;
    for (const side of sides) {
      const fair = market.fair[side];
      const edgePct = valueEdge(fair, market.odds, side);
      if (edgePct == null) continue;
      if (!best || edgePct > best.edgePct) best = { side, edgePct };
    }
    value = best;
  }

  return {
    team: fdName,
    leagueId,
    venue: scope,
    season,
    standing,
    overall,
    attack: { score: atkScore, rank: atkRank, rankTotal: N, metrics: atkMetrics },
    defense: { score: defScore, rank: defRank, rankTotal: N, metrics: defMetrics },
    strengths: strengths.slice(0, 4),
    weaknesses: weaknesses.slice(0, 4),
    elo: eloEntry
      ? { elo: eloEntry.elo, rank: eloEntry.rank, rankTotal: footballEloTotal(leagueId) }
      : null,
    sos,
    ppmAjuste,
    xgDiff,
    reversion,
    value,
    alerts: buildAlerts({
      standingRank: standing.rank,
      rankTotal: N,
      venueLabel: scopeLabel(scope),
      eloRank: eloEntry?.rank ?? null,
      defRank,
      o15Rank: atkMetrics.find((m) => m.key === "o15")?.rank ?? null,
      gaRank: defMetrics.find((m) => m.key === "gaPg")?.rank ?? null,
      reversion,
    }),
    injuries: inj ? { list: inj.injuries, updatedAt: inj.updatedAt } : null,
    injuriesCovered: inj !== null,
    discipline,
    congestion,
    clv,
    referee,
  };
}

export type AlertInput = {
  standingRank: number;
  rankTotal: number;
  venueLabel: string;
  eloRank: number | null;
  defRank: number | null;
  o15Rank: number | null;
  gaRank: number | null;
  reversion: "chaud" | "froid" | null;
};

/**
 * Alertes edge automatiques (max 2, ordre de priorité).
 * Seuils documentés : top3 = rank ≤ 3, bottom3 = rank ≥ total − 2.
 */
export function buildAlerts(input: AlertInput): string[] {
  const { standingRank, rankTotal, venueLabel, eloRank, defRank, o15Rank, gaRank, reversion } = input;
  const alerts: string[] = [];
  if (standingRank <= 3 && eloRank != null && eloRank > 6) {
    alerts.push(`Outsider sous-coté : top 3 ${venueLabel} mais Elo #${eloRank}`);
  }
  if (standingRank === 1 && defRank != null && defRank <= 3) {
    alerts.push(`Forteresse ${venueLabel} : #1 + défense #${defRank}`);
  }
  if (o15Rank != null && o15Rank <= 3 && gaRank != null && gaRank >= rankTotal - 2) {
    alerts.push("Piège Over : attaque top 3 mais défense bottom 3");
  }
  if (reversion === "chaud") {
    alerts.push("Surrégime offensif — réversion probable");
  }
  return alerts.slice(0, 2);
}

function scopeLabel(scope: FdScope): string {
  return scope === "home" ? "domicile" : scope === "away" ? "extérieur" : "général";
}
