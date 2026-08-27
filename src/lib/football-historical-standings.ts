/**
 * football-historical-standings.ts — Standings historiques (saison précédente)
 * via soccerstats.com/homeaway.asp.
 *
 * Objectif : enrichir les standingStats (Dom/Ext) des matchs prematch en début
 * de saison, quand la saison courante a trop peu de matchs joués (partial).
 * On prend la saison N-1 (fin de saison) et on la combine avec la saison N
 * (début) pour créer un L5 rolling window plus stable.
 *
 * Source : soccerstats.com — pattern URL `homeaway.asp?league={slug}_{year}`
 * où year = année de fin de saison (ex: `_2026` = saison 2025/26).
 */

import type { TeamStandingStats } from "./football-data";

// ── Types internes ──────────────────────────────────────────────────────────

interface SideAgg {
  played: number;
  wins: number;
  draws: number;
  losses: number;
  gf: number;
  ga: number;
}

interface StandingAgg {
  name: string;
  home: SideAgg;
  away: SideAgg;
}

/** Données historiques d'une ligue pour une saison passée. */
export interface HistoricalLeagueStandings {
  leagueSlug: string;
  seasonLabel: string; // ex: "2025/26"
  teams: Map<string, { home: TeamStandingStats; away: TeamStandingStats }>;
  fetchedAt: number;
}

// ── Mapping PariScore slug → soccerstats slug + année saison précédente ─────

/**
 * Le slug soccerstats pour la saison N-1 est `{ss}_YYYY` où YYYY = année de fin.
 * Ex: `england_2026` → saison 2025/26.
 * `histYear` = année de fin de saison historique. Null = pas de données dispo.
 */
const LEAGUE_SST_MAP: Record<string, { ss: string; histYear: number | null }> = {
  // ── Europe T1 ──
  epl:               { ss: "england",     histYear: 2026 },
  laliga:            { ss: "spain",       histYear: 2026 },
  ligue1:            { ss: "france",      histYear: 2026 },
  bundesliga:        { ss: "germany",     histYear: 2026 },
  seriea:            { ss: "italy",       histYear: 2026 },
  primeira_liga:     { ss: "portugal",    histYear: 2026 },
  eredivisie:        { ss: "netherlands", histYear: 2026 },
  // ── Europe T2 ──
  championship:      { ss: "england2",    histYear: 2026 },
  laliga2:           { ss: "spain2",      histYear: 2026 },
  ligue2:            { ss: "france2",     histYear: 2026 },
  // ── Europe autres T1 ──
  super_lig:         { ss: "turkey",      histYear: 2026 },
  scot_prem:         { ss: "scotland",    histYear: 2026 },
  super_league_swiss:{ ss: "switzerland", histYear: 2026 },
  allsvenskan:       { ss: "sweden",      histYear: null },
  liga_1_romania:    { ss: "romania",     histYear: 2026 },
  superleague_greece:{ ss: "greece",      histYear: null },
  jupiler:           { ss: "belgium",     histYear: null },
  // ── Amériques ──
  argentina_primera: { ss: "argentina2",  histYear: 2026 },
  saudi_pro_league:  { ss: "saudiarabia", histYear: 2026 },
  // ── Asie ──
  j1_league:         { ss: "japan",       histYear: null },
  k_league1:         { ss: "southkorea",  histYear: null },
};

// ── Normalisation noms d'équipes ────────────────────────────────────────────

/**
 * Normalisation minimale pour matcher les noms soccerstats avec les noms BSD.
 * Le mapping complet est dans scripts/team_name_mapping.py — ici on reprend
 * les overrides les plus courants pour la matching fuzzy.
 */
const TEAM_NAME_OVERRIDES: Record<string, string> = {
  // Premier League
  "manchester utd": "Manchester United",
  "manchester city": "Manchester City",
  "wolverhampton": "Wolves",
  "wolverhampton wanderers": "Wolves",
  "brighton & hove albion": "Brighton",
  "west ham": "West Ham",
  "west ham united": "West Ham",
  "tottenham": "Tottenham",
  "tottenham hotspur": "Tottenham",
  "newcastle": "Newcastle United",
  "newcastle united": "Newcastle United",
  "nottingham forest": "Nottingham Forest",
  "leicester city": "Leicester",
  "leeds united": "Leeds",
  "crystal palace": "Crystal Palace",
  "aston villa": "Aston Villa",
  // Ligue 1
  "paris saint-germain": "Paris SG",
  "olympique marseille": "Marseille",
  "olympique lyonnais": "Lyon",
  "as monaco": "Monaco",
  "lille osc": "Lille",
  "stade rennais": "Rennes",
  "rc lens": "Lens",
  "ogc nice": "Nice",
  "rc strasbourg": "Strasbourg",
  "stade de reims": "Reims",
  "montpellier hsc": "Montpellier",
  "toulouse fc": "Toulouse",
  "fc nantes": "Nantes",
  "stade brestois 29": "Brest",
  "clermont foot": "Clermont",
  "le havre ac": "Le Havre",
  "aj auxerre": "Auxerre",
  "angers sco": "Angers",
  // La Liga
  "real madrid": "Real Madrid",
  "atletico madrid": "Atletico Madrid",
  "athletic bilbao": "Athletic Bilbao",
  "real sociedad": "Real Sociedad",
  "real betis": "Real Betis",
  "villarreal": "Villarreal",
  // Bundesliga
  "borussia dortmund": "Dortmund",
  "bayern munchen": "Bayern Munich",
  "bayern munich": "Bayern Munich",
  "rb leipzig": "RB Leipzig",
  "bayer leverkusen": "Leverkusen",
  // Serie A
  "ac milan": "AC Milan",
  "internazionale": "Inter Milan",
  "inter milan": "Inter Milan",
  "as roma": "Roma",
  "us lazio": "Lazio",
  "ssc napoli": "Napoli",
  "ac florence": "Fiorentina",
};

function normalizeTeamName(raw: string): string {
  const name = raw.trim().replace(/\s+/g, " ");
  const key = name.toLowerCase();
  return TEAM_NAME_OVERRIDES[key] ?? name;
}

// ── Parsing HTML home/away tables ───────────────────────────────────────────

function parseNumber(text: string): number | null {
  const t = text.trim().replace("%", "").replace(",", "").replace("+", "");
  if (!t || t === "-" || t === "n/a") return null;
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : null;
}

function parseSideAgg(cells: HTMLElement[]): SideAgg | null {
  // Colonnes soccerstats: rank, team, GP, W, D, L, GF, GA, GD, Pts, PPG
  if (cells.length < 10) return null;
  const gp = parseNumber(cells[2]?.textContent ?? "");
  const w = parseNumber(cells[3]?.textContent ?? "");
  const d = parseNumber(cells[4]?.textContent ?? "");
  const l = parseNumber(cells[5]?.textContent ?? "");
  const gf = parseNumber(cells[6]?.textContent ?? "");
  const ga = parseNumber(cells[7]?.textContent ?? "");
  if (gp == null || w == null || d == null || l == null || gf == null || ga == null) return null;
  return { played: gp, wins: w, draws: d, losses: l, gf, ga };
}

// ── Fetch + cache ───────────────────────────────────────────────────────────

const HISTORICAL_CACHE_TTL = 24 * 60 * 60 * 1000; // 24h (données statiques)
const historicalCache = new Map<string, HistoricalLeagueStandings>();

const FLARE_URL = process.env.FLARESOLVERR_URL || "http://127.0.0.1:8191/v1";
const FLARE_ENABLED = process.env.FLARESOLVERR_ENABLED !== "0";

function isChallenge(status: number, body: string): boolean {
  return status === 403 || status === 503 || /just a moment|challenge-platform/i.test(body.slice(0, 2000));
}

/** Fetch via FlareSolverr (session éphémère) — résout les challenges Cloudflare. */
async function fetchViaFlare(url: string): Promise<string> {
  const res = await fetch(FLARE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      cmd: "request.get",
      url,
      maxTimeout: 20_000,
    }),
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) throw new Error(`FlareSolverr HTTP ${res.status}`);
  const body = await res.json() as { solution?: { response?: string } };
  return body.solution?.response ?? "";
}

function sidePts(s: SideAgg): number { return s.wins * 3 + s.draws; }

function toStandingSide(
  side: SideAgg,
  rank: number,
  rankTotal: number,
): TeamStandingStats {
  return {
    played: side.played,
    points: sidePts(side),
    ppg: side.played > 0 ? Math.round((sidePts(side) / side.played) * 100) / 100 : 0,
    wins: side.wins,
    draws: side.draws,
    losses: side.losses,
    goalsFor: side.gf,
    goalsAgainst: side.ga,
    goalDiff: side.gf - side.ga,
    rank,
    rankTotal,
    partial: side.played < 3,
  };
}

function normKey(name: string): string {
  return normalizeTeamName(name).toLowerCase().trim();
}

/**
 * Fetch les standings historiques (home/away) d'une ligue depuis soccerstats.com.
 * Résultat caché 24h. Retourne null si le slug n'est pas supporté ou si le fetch échoue.
 */
export async function fetchHistoricalStandings(
  leagueSlug: string,
): Promise<HistoricalLeagueStandings | null> {
  const mapping = LEAGUE_SST_MAP[leagueSlug];
  if (!mapping || mapping.histYear == null) return null;

  const cacheKey = `${mapping.ss}_${mapping.histYear}`;
  const cached = historicalCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < HISTORICAL_CACHE_TTL) return cached;

  const url = `https://www.soccerstats.com/homeaway.asp?league=${cacheKey}`;
  try {
    // Tentative directe d'abord ( fonctionne en local, échoue sur VPS → 403 Cloudflare )
    let html = "";
    try {
      const resp = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "text/html,application/xhtml+xml",
        },
        signal: AbortSignal.timeout(15_000),
      });
      const body = await resp.text();
      if (resp.ok && !isChallenge(resp.status, body)) {
        html = body;
      }
    } catch {
      // Direct échoue → FlareSolverr en fallback
    }

    // Fallback FlareSolverr si direct a échoué ou retourné un challenge
    if (!html && FLARE_ENABLED) {
      try {
        html = await fetchViaFlare(url);
      } catch (e) {
        console.warn(`[hist-stand] FlareSolverr failed for ${cacheKey}:`, (e as Error).message);
      }
    }

    if (!html) {
      console.warn(`[hist-stand] All fetch methods failed for ${cacheKey}`);
      return null;
    }

    const teams = parseHomeAwayHtml(html);

    if (teams.size === 0) {
      console.warn(`[hist-stand] No teams parsed for ${cacheKey}`);
      return null;
    }

    const year = mapping.histYear;
    const result: HistoricalLeagueStandings = {
      leagueSlug,
      seasonLabel: `${year - 1}/${String(year).slice(-2)}`,
      teams,
      fetchedAt: Date.now(),
    };
    historicalCache.set(cacheKey, result);
    console.log(`[hist-stand] ${leagueSlug}: ${teams.size} teams (season ${result.seasonLabel})`);
    return result;
  } catch (e) {
    console.warn(`[hist-stand] fetch failed for ${cacheKey}:`, (e as Error).message);
    return null;
  }
}

/**
 * Parse le HTML de homeaway.asp et retourne une Map<teamKey, { home, away }>.
 * Détecte les sections "Home table" / "Away table" par le texte précédent chaque <table>.
 */
function parseHomeAwayHtml(html: string): Map<string, { home: TeamStandingStats; away: TeamStandingStats }> {
  // Extraction basique via regex — pas de dépendance DOM parser côté serveur.
  // On cherche les tables par leur contexte textuel.
  const result = new Map<string, { home: TeamStandingStats; away: TeamStandingStats }>();

  // Trouver les blocs Home table / Away table
  const homeBlock = extractTableBlock(html, /home\s+table/i);
  const awayBlock = extractTableBlock(html, /away\s+table/i);

  const homeTeams = homeBlock ? parseTableRows(homeBlock) : [];
  const awayTeams = awayBlock ? parseTableRows(awayBlock) : [];

  // Indexer par team name normalisé
  const allNames = new Set([...homeTeams.map((t) => t.name), ...awayTeams.map((t) => t.name)]);
  const rankTotal = allNames.size;
  if (rankTotal === 0) return result;

  // Construire les classements PPG pour les rangs
  const homePpgSorted = [...homeTeams]
    .sort((a, b) => (b.pts / Math.max(b.gp, 1)) - (a.pts / Math.max(a.gp, 1)));
  const awayPpgSorted = [...awayTeams]
    .sort((a, b) => (b.pts / Math.max(b.gp, 1)) - (a.pts / Math.max(a.gp, 1)));

  const homeRankMap = new Map(homePpgSorted.map((t, i) => [normKey(t.name), i + 1]));
  const awayRankMap = new Map(awayPpgSorted.map((t, i) => [normKey(t.name), i + 1]));

  for (const name of allNames) {
    const key = normKey(name);
    const h = homeTeams.find((t) => normKey(t.name) === key);
    const a = awayTeams.find((t) => normKey(t.name) === key);

    const homeSide: SideAgg = h
      ? { played: h.gp, wins: h.w, draws: h.d, losses: h.l, gf: h.gf, ga: h.ga }
      : { played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0 };
    const awaySide: SideAgg = a
      ? { played: a.gp, wins: a.w, draws: a.d, losses: a.l, gf: a.gf, ga: a.ga }
      : { played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0 };

    result.set(key, {
      home: toStandingSide(homeSide, homeRankMap.get(key) ?? rankTotal, rankTotal),
      away: toStandingSide(awaySide, awayRankMap.get(key) ?? rankTotal, rankTotal),
    });
  }

  return result;
}

/** Extrait le bloc HTML d'une table à partir du contexte textuel qui la précède. */
function extractTableBlock(html: string, contextPattern: RegExp): string | null {
  // Cherche le pattern dans le texte, puis trouve la <table> suivante
  const idx = html.search(contextPattern);
  if (idx < 0) return null;
  const tableStart = html.indexOf("<table", idx);
  if (tableStart < 0) return null;
  const tableEnd = html.indexOf("</table>", tableStart);
  if (tableEnd < 0) return null;
  return html.slice(tableStart, tableEnd + "</table>".length);
}

interface ParsedRow {
  name: string;
  gp: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  gd: number;
  pts: number;
  ppg: number;
}

/** Parse les lignes d'une table soccerstats homeaway.asp. */
function parseTableRows(tableHtml: string): ParsedRow[] {
  const rows: ParsedRow[] = [];
  // Extraire toutes les lignes <tr> contenant des <td>
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch: RegExpExecArray | null;
  while ((trMatch = trRegex.exec(tableHtml)) !== null) {
    const trContent = trMatch[1];
    // Extraire le texte de chaque cellule
    const cells: string[] = [];
    const tdRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let tdMatch: RegExpExecArray | null;
    while ((tdMatch = tdRegex.exec(trContent)) !== null) {
      // Nettoyer le HTML contenu dans la cellule
      const raw = tdMatch[1].replace(/<[^>]+>/g, "").trim();
      cells.push(raw);
    }
    // Format attendu: rank, team, GP, W, D, L, GF, GA, GD, Pts, PPG
    if (cells.length >= 10) {
      const name = normalizeTeamName(cells[1]);
      const gp = parseNumber(cells[2]) ?? 0;
      const w = parseNumber(cells[3]) ?? 0;
      const d = parseNumber(cells[4]) ?? 0;
      const l = parseNumber(cells[5]) ?? 0;
      const gf = parseNumber(cells[6]) ?? 0;
      const ga = parseNumber(cells[7]) ?? 0;
      const gd = parseNumber(cells[8]) ?? 0;
      const pts = parseNumber(cells[9]) ?? 0;
      const ppg = cells.length > 10 ? (parseNumber(cells[10]) ?? 0) : (gp > 0 ? pts / gp : 0);
      if (name && gp > 0) {
        rows.push({ name, gp, w, d, l, gf, ga, gd, pts, ppg });
      }
    }
  }
  return rows;
}

// ── Blend current + historical ──────────────────────────────────────────────

/**
 * Pondération : plus la saison courante a de matchs, moins l'historique pèse.
 * - 0 matchs courants → 100% historique
 * - 5+ matchs courants → ~70% courant / 30% historique
 * - 10+ matchs courants → ~85% courant / 15% historique
 * - 15+ matchs courants → ~95% courant / 5% historique (seuil d'abandon)
 */
function computeWeights(
  currentPlayed: number,
): { currentWeight: number; historicalWeight: number } {
  if (currentPlayed >= 15) return { currentWeight: 1, historicalWeight: 0 };
  if (currentPlayed <= 0) return { currentWeight: 0, historicalWeight: 1 };
  // Courbe exponentielle douce : w_curr = 1 - e^(-k * played), k ≈ 0.25
  const currentWeight = Math.min(1, 1 - Math.exp(-0.25 * currentPlayed));
  const historicalWeight = 1 - currentWeight;
  return { currentWeight, historicalWeight };
}

/**
 * Calcule un nombre "virtuel" de matchs historiques pour atteindre un L5 rolling.
 * Si on a 2 matchs courants, on prend 3 matchs historiques (5 total).
 * Si on a 0 matchs courants, on prend 5 matchs historiques.
 */
function virtualHistoricalPlayed(currentPlayed: number): number {
  const TARGET = 5;
  return Math.max(0, Math.min(TARGET - currentPlayed, TARGET));
}

function blendSideAgg(
  current: SideAgg,
  historical: SideAgg,
  currentPlayed: number,
): SideAgg {
  const { currentWeight, historicalWeight } = computeWeights(currentPlayed);
  if (historicalWeight === 0) return current;
  if (currentWeight === 0) return historical;

  const vhp = virtualHistoricalPlayed(currentPlayed);
  // Pondérer le côté historique par le ratio de matchs virtuels vs réels
  const histRatio = historical.played > 0 ? vhp / historical.played : 0;

  const blend = (cVal: number, hVal: number): number => {
    const blended = currentWeight * cVal + historicalWeight * hVal * histRatio;
    return Math.round(blended * 100) / 100;
  };

  const gp = Math.round(blend(current.played, historical.played));
  const w = Math.round(blend(current.wins, historical.wins));
  const d = Math.round(blend(current.draws, historical.draws));
  const l = Math.round(blend(current.losses, historical.losses));
  const gf = Math.round(blend(current.gf, historical.gf));
  const ga = Math.round(blend(current.ga, historical.ga));

  return { played: gp, wins: w, draws: d, losses: l, gf, ga };
}

function blendStandingSide(
  current: TeamStandingStats,
  historical: TeamStandingStats,
): TeamStandingStats {
  const currentPlayed = current.played;
  const { currentWeight } = computeWeights(currentPlayed);

  // Si historique est vide, retourner le courant tel quel
  if (historical.played === 0) return current;
  // Si courant est vide, retourner l'historique
  if (currentPlayed === 0) return { ...historical, partial: true };

  const blendedSide = blendSideAgg(
    { played: current.played, wins: current.wins, draws: current.draws, losses: current.losses, gf: current.goalsFor, ga: current.goalsAgainst },
    { played: historical.played, wins: historical.wins, draws: historical.draws, losses: historical.losses, gf: historical.goalsFor, ga: historical.goalsAgainst },
    currentPlayed,
  );

  const pts = blendedSide.wins * 3 + blendedSide.draws;
  const played = blendedSide.played;
  const ppg = played > 0 ? Math.round((pts / played) * 100) / 100 : 0;

  // Rang : on reprend le rang de la source dominante (courante si > 5 matchs)
  const rank = currentWeight > 0.5 ? current.rank : historical.rank;
  const rankTotal = current.rankTotal || historical.rankTotal;

  return {
    played,
    points: pts,
    ppg,
    wins: blendedSide.wins,
    draws: blendedSide.draws,
    losses: blendedSide.losses,
    goalsFor: blendedSide.gf,
    goalsAgainst: blendedSide.ga,
    goalDiff: blendedSide.gf - blendedSide.ga,
    rank,
    rankTotal,
    // partial = true si < 3 matchs courants (même si historique complète)
    partial: currentPlayed < 3,
  };
}

/**
 * Enrichit les standingStats (home/away) avec les données historiques.
 * Si `partial` est true (< 3 matchs joués) et que les données historiques
 * sont disponibles, fait un blend pondéré.
 *
 * @param current - StandingData actuel (de BSD)
 * @param historical - StandingData historique (de soccerstats, saison N-1)
 * @returns StandingData enrichi
 */
export function blendWithHistorical(
  current: { home: TeamStandingStats; away: TeamStandingStats },
  historical: { home: TeamStandingStats; away: TeamStandingStats } | null,
): { home: TeamStandingStats; away: TeamStandingStats; historicalSeason?: string } {
  if (!historical) return current;

  // Ne blending que si le courant est partial (< 5 matchs)
  // Au-delà, le courant est suffisamment fiable
  if (current.home.played >= 5 && current.away.played >= 5) return current;

  return {
    home: blendStandingSide(current.home, historical.home),
    away: blendStandingSide(current.away, historical.away),
    historicalSeason: undefined, // Sera défini par l'appelant
  };
}
