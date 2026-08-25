import type {
  CountryNode,
  LeagueNode,
  SportNode,
  SportTabId,
  TreeMatchSummary,
  TimeFilterHours,
} from "@/types/sports-sidebar";
import {
  filterByStartWindow,
  filterByToday,
  filterByTomorrow,
  filterLiveByWindow,
  parseTimeFilter,
} from "@/lib/match-view";

/**
 * builders purs de l'arborescence Sport → Pays → Championnat → Matchs
 * (modèle 1xBet Line). Chaque sport normalise sa payload brute vers la forme
 * intermédiaire `RawTreeMatch`, puis le regroupement pays/ligue est factorisé.
 *
 * Toutes les fonctions sont défensives : une payload dégradée produit un nœud
 * vide plutôt qu'une exception (la sidebar ne doit jamais casser la page).
 */

export const MAX_LEVEL4_MATCHES = 8;

export const SPORT_META: Record<SportTabId, { name: string; icon: string }> = {
  football: { name: "Football", icon: "Trophy" },
  tennis: { name: "Tennis", icon: "Activity" },
  cs2: { name: "CS2", icon: "Crosshair" },
  nba: { name: "NBA", icon: "Dribbble" },
  wnba: { name: "WNBA", icon: "Dribbble" },
  mma: { name: "MMA", icon: "Swords" },
  cycling: { name: "Cyclisme", icon: "Bike" },
  f1: { name: "Formule 1", icon: "Flag" },
  baseball: { name: "Baseball", icon: "Volleyball" },
  rugby: { name: "Rugby", icon: "Shield" },
};

// ---------------------------------------------------------------------------
// Catalogue statique « Favoris & top championnats » (bloc 3 de la sidebar)
// ---------------------------------------------------------------------------

/**
 * Favoris par défaut épinglés dans le bloc 3, DÉTACHÉS de la disponibilité
 * des données de match (corrige BUG-2 : le bloc disparaissait quand les
 * endpoints tennis/NBA étaient en erreur). Ids au format `sport:slug-ligue`,
 * le même que celui des nœuds de l'arbre ; une ligue donnée peut ne pas
 * exister dans l'arbre chargé — l'UI affiche alors un nœud synthétique à
 * compteur 0 plutôt que de masquer le bloc.
 */
export const DEFAULT_FAVORITE_LEAGUES: ReadonlyArray<{
  id: string;
  sportId: SportTabId;
  name: string;
}> = [
  { id: "football:champions-league", sportId: "football", name: "Champions League" },
  { id: "football:premier-league", sportId: "football", name: "Premier League" },
  { id: "football:ligue-1", sportId: "football", name: "Ligue 1" },
  { id: "tennis:grand-slam", sportId: "tennis", name: "Grand Slam" },
  { id: "nba:nba", sportId: "nba", name: "NBA" },
];

/** Vrai si l'id de ligue correspond à un favori par défaut du catalogue. */
export function isDefaultFavoriteLeague(id: string): boolean {
  return DEFAULT_FAVORITE_LEAGUES.some((d) => d.id === id);
}

/** Forme intermédiaire normalisée d'un match, tous sports confondus. */
export interface RawTreeMatch {
  id: string;
  homeName: string;
  awayName: string;
  scheduledAt: string | null;
  isLive: boolean;
  leagueId: string;
  leagueName: string;
  countryName: string;
  /** ISO 3166-1 alpha-2 ; « INT » lorsque non applicable. */
  countryCode: string;
  /** Cotes décimales 1X2 (P0-1). Optionnelles — dégradé si absentes. */
  oddsH?: number;
  oddsD?: number;
  oddsA?: number;
  /** Probabilités de modèle 1X2 en % (P0-2). Optionnelles. */
  probH?: number;
  probD?: number;
  probA?: number;
}

/**
 * Edge de valeur 1X2 : max sur les issues {1, X, 2} de `modelProb − (1/odds)*100`
 * (probabilité implicite de-vig). Ne renvoie un nombre que si cotes (toutes)
 * ET probabilités (toutes) sont présentes et saines ; sinon `null`.
 */
export function best1x2Edge(
  probH?: number,
  probD?: number,
  probA?: number,
  oddsH?: number,
  oddsD?: number,
  oddsA?: number,
): number | null {
  if (
    !Number.isFinite(probH) || !Number.isFinite(probD) || !Number.isFinite(probA) ||
    !Number.isFinite(oddsH) || !Number.isFinite(oddsD) || !Number.isFinite(oddsA) ||
    oddsH! <= 1 || oddsD! <= 1 || oddsA! <= 1
  ) return null;
  const edges = [
    probH! - (1 / oddsH!) * 100,
    probD! - (1 / oddsD!) * 100,
    probA! - (1 / oddsA!) * 100,
  ];
  return Math.max(...edges);
}

// ---------------------------------------------------------------------------
// Quick-links « Prédictions » (P0-3) : lignes plates pré-médiées, profondeur 4→1
// ---------------------------------------------------------------------------

/** Nombre max de matchs par ligne de quick-links (Live / Value / Aujourd'hui). */
export const MAX_QUICK_LINKS = 6;

/** Entrée plate d'une ligne de quick-links : le match + sa ligue d'origine. */
export interface QuickLinkMatch {
  match: TreeMatchSummary;
  league: LeagueNode;
}

/** Les 3 lignes pré-médiées du bloc quick-links. */
export interface QuickLinks {
  live: QuickLinkMatch[];
  value: QuickLinkMatch[];
  today: QuickLinkMatch[];
}

/**
 * Collecte les lignes plates depuis l'arbre (P0-3) :
 * - `live` : matchs en direct (les plus proches d'abord).
 * - `value` : edge 1X2 strictement positif, trié décroissant (value bets).
 * - `today` : coups d'envoi du jour calendaire, non-live, les plus proches d'abord.
 *
 * Déduplique par id de match, borne chaque ligne à `MAX_QUICK_LINKS`.
 */
export function collectQuickLinks(tree: SportNode[], now: Date = new Date()): QuickLinks {
  const live: QuickLinkMatch[] = [];
  const value: QuickLinkMatch[] = [];
  const today: QuickLinkMatch[] = [];
  const seenLive = new Set<string>();
  const seenValue = new Set<string>();
  const seenToday = new Set<string>();

  for (const sport of tree) {
    for (const country of sport.countries) {
      for (const league of country.leagues) {
        for (const m of league.matches ?? []) {
          const row = { match: m, league };
          if (m.isLive && !seenLive.has(m.id)) {
            seenLive.add(m.id);
            live.push(row);
          }
          const edge = m.edgePct;
          if (edge != null && Number.isFinite(edge) && edge > 0 && !seenValue.has(m.id)) {
            seenValue.add(m.id);
            value.push(row);
          }
          if (!m.isLive && isValidDate(m.scheduledAt)) {
            const isToday = filterByToday([m], (x) => x.scheduledAt, now).length > 0;
            if (isToday && !seenToday.has(m.id)) {
              seenToday.add(m.id);
              today.push(row);
            }
          }
        }
      }
    }
  }

  const byStart = (a: QuickLinkMatch, b: QuickLinkMatch) => {
    const ta = isValidDate(a.match.scheduledAt) ? new Date(a.match.scheduledAt).getTime() : Infinity;
    const tb = isValidDate(b.match.scheduledAt) ? new Date(b.match.scheduledAt).getTime() : Infinity;
    return ta - tb;
  };
  live.sort(byStart);
  today.sort(byStart);
  value.sort((a, b) => (b.match.edgePct ?? 0) - (a.match.edgePct ?? 0));

  return {
    live: live.slice(0, MAX_QUICK_LINKS),
    value: value.slice(0, MAX_QUICK_LINKS),
    today: today.slice(0, MAX_QUICK_LINKS),
  };
}

/** Chemin d'ancêtres d'une ligue sélectionnée (a11y P0-9 : surlignage sport→pays→ligue). */
export function findLeaguePath(
  tree: SportNode[],
  leagueId: string | null,
): { sportId: string; countryId: string } | null {
  if (!leagueId) return null;
  for (const sport of tree) {
    for (const country of sport.countries) {
      if (country.leagues.some((l) => l.id === leagueId)) {
        return { sportId: sport.id, countryId: country.id };
      }
    }
  }
  return null;
}

const INT = "INT";

function slug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isValidDate(raw: string | null | undefined): raw is string {
  if (!raw) return false;
  return Number.isFinite(new Date(raw).getTime());
}

/** Regroupe les matchs bruts en pays → ligues (niveaux 2-3) pour un sport. */
export function groupRawMatches(sportId: SportTabId, raws: RawTreeMatch[]): SportNode {
  const meta = SPORT_META[sportId];
  const countryMap = new Map<string, CountryNode>();
  let liveMatches = 0;

  for (const raw of raws) {
    if (raw.isLive) liveMatches++;

    let country = countryMap.get(raw.countryName);
    if (!country) {
      country = {
        id: `${sportId}:${slug(raw.countryName) || INT}`,
        name: raw.countryName || "International",
        countryCode: raw.countryCode || INT,
        leagues: [],
      };
      countryMap.set(raw.countryName, country);
    }

    let league = country.leagues.find((l) => l.id === `${sportId}:${raw.leagueId}`);
    if (!league) {
      league = {
        id: `${sportId}:${raw.leagueId}`,
        name: raw.leagueName,
        matchCount: 0,
        sportId,
        matches: [],
      };
      country.leagues.push(league);
    }
    league.matchCount++;
    const edge = best1x2Edge(raw.probH, raw.probD, raw.probA, raw.oddsH, raw.oddsD, raw.oddsA);
    const hasOdds = Number.isFinite(raw.oddsH) && Number.isFinite(raw.oddsD) && Number.isFinite(raw.oddsA);
    const hasProb = Number.isFinite(raw.probH) && Number.isFinite(raw.probD) && Number.isFinite(raw.probA);
    const summary: TreeMatchSummary = {
      id: raw.id,
      homeName: raw.homeName,
      awayName: raw.awayName,
      scheduledAt: raw.scheduledAt ?? "",
      isLive: raw.isLive,
      edgePct: edge,
    };
    if (hasOdds) summary.odds = { home: raw.oddsH!, draw: raw.oddsD!, away: raw.oddsA! };
    if (hasProb) summary.prob = { home: raw.probH!, draw: raw.probD!, away: raw.probA! };
    league.matches!.push(summary);
  }

  const countries = Array.from(countryMap.values());
  for (const country of countries) {
    country.leagues.sort((a, b) => b.matchCount - a.matchCount || a.name.localeCompare(b.name));
    for (const league of country.leagues) {
      league.matches = pickLevel4(league.matches ?? []);
      // Edge moyen de la ligue (P0-2) : moyenne des edges 1X2 calculables.
      const edges = (league.matches as TreeMatchSummary[])
        .map((m) => m.edgePct)
        .filter((e): e is number => Number.isFinite(e));
      if (edges.length > 0) {
        const avg = edges.reduce((s, e) => s + e, 0) / edges.length;
        if (Number.isFinite(avg)) league.edgePct = Math.round(avg * 10) / 10;
      }
    }
  }
  countries.sort((a, b) => {
    const ac = a.leagues.reduce((n, l) => n + l.matchCount, 0);
    const bc = b.leagues.reduce((n, l) => n + l.matchCount, 0);
    return bc - ac || a.name.localeCompare(b.name);
  });

  return {
    id: sportId,
    name: meta.name,
    icon: meta.icon,
    totalMatches: raws.length,
    liveMatches,
    countries,
  };
}

/** Niveau 4 : matchs live d'abord, puis les plus proches, N éléments max. */
function pickLevel4(matches: TreeMatchSummary[]): TreeMatchSummary[] {
  return [...matches]
    .sort((a, b) => {
      if (!!a.isLive !== !!b.isLive) return a.isLive ? -1 : 1;
      const ta = isValidDate(a.scheduledAt) ? new Date(a.scheduledAt).getTime() : Infinity;
      const tb = isValidDate(b.scheduledAt) ? new Date(b.scheduledAt).getTime() : Infinity;
      return ta - tb;
    })
    .slice(0, MAX_LEVEL4_MATCHES);
}

/** Nœud vide (sport indisponible : API en erreur / aucune donnée). */
export function emptySportNode(sportId: SportTabId): SportNode {
  const meta = SPORT_META[sportId];
  return { id: sportId, name: meta.name, icon: meta.icon, totalMatches: 0, liveMatches: 0, countries: [] };
}

// ---------------------------------------------------------------------------
// Normaliseurs par sport (payload brute → RawTreeMatch[])
// ---------------------------------------------------------------------------

type MinimalFootballMatch = {
  id: string | number;
  scheduledAt?: string | null;
  league?: { id?: string | number; name?: string | null; country?: string | null; countryCode?: string | null } | null;
  home?: { name?: string | null } | null;
  away?: { name?: string | null } | null;
  live?: { status?: string | null } | null;
  prediction?: {
    homeProb?: number | null;
    drawProb?: number | null;
    awayProb?: number | null;
  } | null;
  odds?: { home?: number | null; draw?: number | null; away?: number | null } | null;
};

export function footballToRaw(matches: MinimalFootballMatch[] | undefined | null): RawTreeMatch[] {
  const list = Array.isArray(matches) ? matches : [];
  return list
    .filter((m) => m && m.home?.name && m.away?.name)
    .map((m) => {
      const isLive = !!m.live && (m.live.status === "LIVE" || m.live.status === "HT");
      const country = m.league?.country?.trim() || "International";
      const pred = m.prediction;
      const raw: RawTreeMatch = {
        id: String(m.id),
        isLive,
        homeName: m.home!.name!,
        awayName: m.away!.name!,
        scheduledAt: isValidDate(m.scheduledAt) ? m.scheduledAt! : null,
        leagueId: String(m.league?.id ?? slug(m.league?.name ?? "autre")),
        leagueName: m.league?.name?.trim() || "Autre compétition",
        countryName: country,
        countryCode: m.league?.countryCode?.trim() || INT,
      };
      const probOk = pred && Number.isFinite(pred.homeProb) && Number.isFinite(pred.drawProb) && Number.isFinite(pred.awayProb);
      if (probOk) {
        raw.probH = pred!.homeProb!;
        raw.probD = pred!.drawProb!;
        raw.probA = pred!.awayProb!;
      }
      const odds = m.odds;
      const oddsOk = odds && Number.isFinite(odds.home) && Number.isFinite(odds.draw) && Number.isFinite(odds.away);
      if (oddsOk) {
        raw.oddsH = odds!.home!;
        raw.oddsD = odds!.draw!;
        raw.oddsA = odds!.away!;
      }
      return raw;
    });
}

type MinimalTennisMatch = {
  id: string | number;
  tournament?: string | null;
  tournamentCategory?: string | null;
  scheduledAt?: string | null;
  playerA?: { name?: string | null } | null;
  playerB?: { name?: string | null } | null;
};

export function tennisToRaw(matches: MinimalTennisMatch[] | undefined | null): RawTreeMatch[] {
  const list = Array.isArray(matches) ? matches : [];
  return list
    .filter((m) => m && 
          m.playerA?.name != null && m.playerA?.name !== "" &&
          m.playerB?.name != null && m.playerB?.name !== "")
    .map((m) => {
      const tournament = m.tournament?.trim() || "Tournoi";
      // Live BSD : live_stats/currentPoint présents uniquement sur les items
      // du flux /api/tennis/live (les prematch ne les portent pas).
      const isLive = !!(m as any).live_stats || !!(m as any).currentPoint;
      // Un match EN DIRECT se joue maintenant : si la source ne fournit pas
      // de coup d'envoi exploitable (payload LiveMatchItem BSD sans date),
      // on l'ancre à maintenant — sinon applyTimeFilter/tri l'éjectent et
      // la sidebar affiche « Tennis | 0 » malgré des API 200 (bug tracé dans
      // TENNIS_SIDEBAR_DEBUG.md).
      const scheduledAt = isValidDate(m.scheduledAt)
        ? m.scheduledAt!
        : isLive
          ? new Date().toISOString()
          : null;

      return {
        id: String(m.id),
        homeName: m.playerA!.name!,
        awayName: m.playerB!.name!,
        scheduledAt,
        isLive: isLive,
        leagueId: slug(tournament),
        leagueName: tournament,
        countryName: m.tournamentCategory?.trim() || "Circuit",
        countryCode: INT,
      };
    });
}

type MinimalCs2Match = {
  id?: string | number;
  scheduled?: string | null;
  status?: string | null;
  tournament?: string | null;
  team1?: { name?: string | null } | null;
  team2?: { name?: string | null } | null;
};

export function cs2ToRaw(matches: MinimalCs2Match[] | undefined | null): RawTreeMatch[] {
  const list = Array.isArray(matches) ? matches : [];
  return list
    .filter((m) => m && m.team1?.name && m.team2?.name)
    .map((m) => {
      const tournament = m.tournament?.trim() || "Tournoi CS2";
      const status = (m.status ?? "").toLowerCase();
      return {
        id: String(m.id ?? `${m.team1!.name}-${m.team2!.name}-${m.scheduled ?? ""}`),
        homeName: m.team1!.name!,
        awayName: m.team2!.name!,
        scheduledAt: isValidDate(m.scheduled) ? m.scheduled! : null,
        isLive: status.includes("live") || status.includes("ongoing"),
        leagueId: slug(tournament),
        leagueName: tournament,
        countryName: "International",
        countryCode: INT,
      };
    });
}

type MinimalBasketballMatch = {
  id?: string | number;
  commence_time?: string | null;
  home?: { name?: string | null } | null;
  away?: { name?: string | null } | null;
};

export function basketballToRaw(
  leagueName: "NBA" | "WNBA",
  matches: MinimalBasketballMatch[] | undefined | null,
): RawTreeMatch[] {
  const list = Array.isArray(matches) ? matches : [];
  return list
    .filter((m) => m && m.home?.name && m.away?.name)
    .map((m, i) => ({
      id: String(m.id ?? `${leagueName}-${i}`),
      homeName: m.home!.name!,
      awayName: m.away!.name!,
      scheduledAt: isValidDate(m.commence_time) ? m.commence_time! : null,
      isLive: false,
      leagueId: leagueName.toLowerCase(),
      leagueName,
      countryName: "USA",
      countryCode: "US",
    }));
}

type MinimalMmaEvent = {
  event_name?: string | null;
  event_date?: string | null;
  fights?: Array<{
    fighter_a?: string | null;
    fighter_b?: string | null;
    commence_time?: string | null;
  }> | null;
};

export function mmaToRaw(events: MinimalMmaEvent[] | undefined | null): RawTreeMatch[] {
  const list = Array.isArray(events) ? events : [];
  const out: RawTreeMatch[] = [];
  list.forEach((event, ei) => {
    if (!event) return;
    const eventName = event.event_name?.trim() || `Événement ${ei + 1}`;
    const fights = Array.isArray(event.fights) ? event.fights : [];
    fights.forEach((f, fi) => {
      if (!f?.fighter_a || !f?.fighter_b) return;
      const at = isValidDate(f.commence_time)
        ? f.commence_time!
        : isValidDate(event.event_date)
          ? event.event_date!
          : null;
      out.push({
        id: `${slug(eventName)}-${fi}`,
        homeName: f.fighter_a,
        awayName: f.fighter_b,
        scheduledAt: at,
        isLive: false,
        leagueId: slug(eventName),
        leagueName: eventName,
        countryName: "International",
        countryCode: INT,
      });
    });
  });
  return out;
}

type MinimalCyclingStage = {
  race?: string | null;
  country?: string | null;
  date?: string | null;
  stage?: number | string | null;
  route?: string | null;
};

export function cyclingToRaw(stage: MinimalCyclingStage | undefined | null): RawTreeMatch[] {
  if (!stage?.race) return [];
  const race = stage.race.trim();
  const today = new Date().toDateString();
  const isToday = isValidDate(stage.date) && new Date(stage.date!).toDateString() === today;
  return [
    {
      id: `${slug(race)}-etape-${stage.stage ?? "x"}`,
      homeName: `Étape ${stage.stage ?? ""}`.trim(),
      awayName: stage.route?.trim() || race,
      scheduledAt: isValidDate(stage.date) ? stage.date! : null,
      isLive: isToday,
      leagueId: slug(race),
      leagueName: race,
      countryName: stage.country?.trim() || "International",
      countryCode: INT,
    },
  ];
}

type MinimalF1Race = {
  round?: number | string | null;
  name?: string | null;
  date?: string | null;
  country?: string | null;
};

export function f1ToRaw(races: MinimalF1Race[] | undefined | null, nextRace?: MinimalF1Race | null): RawTreeMatch[] {
  let list = Array.isArray(races) ? races.filter((r) => r?.name) : [];
  if (list.length === 0 && nextRace?.name) list = [nextRace];
  return list.map((r, i) => ({
    id: `f1-gp-${r.round ?? i}`,
    homeName: r.name!.replace(/grand prix/i, "GP").trim(),
    awayName: "",
    scheduledAt: isValidDate(r.date) ? r.date! : null,
    isLive: false,
    leagueId: slug(r.name!),
    leagueName: r.name!,
    countryName: r.country?.trim() || "International",
    countryCode: INT,
  }));
}

const BASEBALL_LEAGUE_COUNTRY: Record<string, { country: string; code: string }> = {
  MLB: { country: "USA", code: "US" },
  KBO: { country: "Corée du Sud", code: "KR" },
  NPB: { country: "Japon", code: "JP" },
  CPBL: { country: "Taïwan", code: "TW" },
  LMB: { country: "Mexique", code: "MX" },
  LIDOM: { country: "Rép. dominicaine", code: "DO" },
  LVBP: { country: "Venezuela", code: "VE" },
};

type MinimalBaseballMatch = {
  game?: { id?: string | number; league?: string | null; gameDateIso?: string | null; status?: string | null } | null;
  homeTeam?: { name?: string | null; city?: string | null } | null;
  awayTeam?: { name?: string | null; city?: string | null } | null;
};

export function baseballToRaw(matches: MinimalBaseballMatch[] | undefined | null): RawTreeMatch[] {
  const list = Array.isArray(matches) ? matches : [];
  return list
    .filter((m) => m?.game && m.homeTeam?.name && m.awayTeam?.name)
    .map((m) => {
      const league = m.game!.league ?? "MLB";
      const geo = BASEBALL_LEAGUE_COUNTRY[league] ?? { country: "International", code: INT };
      return {
        id: String(m.game!.id ?? m.game!.gameDateIso ?? `${m.homeTeam!.name}-${m.awayTeam!.name}`),
        homeName: m.homeTeam!.name!,
        awayName: m.awayTeam!.name!,
        scheduledAt: isValidDate(m.game!.gameDateIso) ? m.game!.gameDateIso! : null,
        isLive: m.game!.status === "live",
        leagueId: league.toLowerCase(),
        leagueName: league,
        countryName: geo.country,
        countryCode: geo.code,
      };
    });
}

type MinimalRugbyCompetition = {
  slug?: string | null;
  name?: string | null;
  country?: string | null;
  upcomingCount?: number | null;
};

/**
 * Rugby : pas de matchs individuels agrégés — counts depuis `upcomingCount`.
 *
 * ⚠️ Sémantique du badge (BUG-4) : `upcomingCount` = « prochains matchs
 * programmés » sur une fenêtre future large (plusieurs semaines), tandis que
 * les autres sports comptent les matchs de la fenêtre temporelle affichée
 * (jour / N heures). Un badge rugby est donc naturellement **plus grand** que
 * football/baseball à sémantique comparable. On DOCUMENTE la différence ici
 * (et dans le tooltip) au lieu de la masquer. `applyTimeFilter` ne filtre pas
 * ces ligues (pas de détail de matchs) → leur count reste « à venir ».
 */
export function rugbyLeagues(competitions: MinimalRugbyCompetition[] | undefined | null): LeagueNode[] {
  const list = Array.isArray(competitions) ? competitions : [];
  return list
    .filter((c) => c?.name)
    .map((c) => ({
      id: `rugby:${c.slug ?? slug(c.name!)}`,
      name: c.name!,
      matchCount: c.upcomingCount ?? 0,
      sportId: "rugby" as const,
    }));
}

export function rugbyCountries(competitions: MinimalRugbyCompetition[] | undefined | null): CountryNode[] {
  const byCountry = new Map<string, CountryNode>();
  for (const league of rugbyLeagues(competitions)) {
    const raw = (competitions ?? []).find((c) => `rugby:${c.slug ?? slug(c.name!)}` === league.id);
    const countryName = raw?.country?.trim() || "International";
    let country = byCountry.get(countryName);
    if (!country) {
      country = { id: `rugby:${slug(countryName)}`, name: countryName, countryCode: INT, leagues: [] };
      byCountry.set(countryName, country);
    }
    country.leagues.push(league);
  }
  return Array.from(byCountry.values());
}

export function rugbySportNode(competitions: MinimalRugbyCompetition[] | undefined | null): SportNode {
  const countries = rugbyCountries(competitions);
  const total = countries.reduce(
    (n, c) => n + c.leagues.reduce((m, l) => m + l.matchCount, 0),
    0,
  );
  return { ...emptySportNode("rugby"), totalMatches: total, countries };
}

// ---------------------------------------------------------------------------
// Agrégation + filtres (recherche, fenêtre temporelle)
// ---------------------------------------------------------------------------

/** Trie final : plus de matchs d'abord ; à égalité, ordre alphabétique. */
export function sortSportsTree(sports: SportNode[]): SportNode[] {
  return [...sports].sort(
    (a, b) => b.totalMatches - a.totalMatches || a.name.localeCompare(b.name),
  );
}

function matchInTimeWindow(m: TreeMatchSummary, tf: TimeFilterHours, now: Date): boolean {
  const { hours, today, tomorrow } = parseTimeFilter(tf);
  // Un match en direct se joue MAINTENANT : il relève de toute fenêtre
  // « heures » et de « Aujourd'hui », même sans date de début exploitable
  // (ex: flux live tennis sans coup d'envoi) — sinon la sidebar affiche
  // « Tennis | 0 » avec un filtre temporel persisté (bug TENNIS_SIDEBAR_DEBUG).
  if (m.isLive && (hours !== null || today)) return true;
  if (hours !== null) {
    // Live : fenêtre glissante passée [now − Nh, now] (coup d'envoi déjà eu
    // lieu) ; prematch : fenêtre à venir [now − tolérance, now + Nh].
    const fn = m.isLive ? filterLiveByWindow : filterByStartWindow;
    return fn([m], hours, (x) => x.scheduledAt, now).length > 0;
  }
  if (today) {
    return filterByToday([m], (x) => x.scheduledAt, now).length > 0;
  }
  if (tomorrow) {
    return filterByTomorrow([m], (x) => x.scheduledAt, now).length > 0;
  }
  return true;
}

/** Recalcule l'arborescence en ne comptant que les matchs de la fenêtre. */
export function applyTimeFilter(tree: SportNode[], tf: TimeFilterHours, now: Date = new Date()): SportNode[] {
  if (tf === "all") return tree;
  return tree.map((sport) => {
    let total = 0;
    let live = 0;
    const countries: CountryNode[] = [];
    for (const country of sport.countries) {
      const leagues: LeagueNode[] = [];
      for (const league of country.leagues) {
        const details = league.matches;
        if (!details || details.length === 0) {
          // Ligues sans détail de matchs (rugby) : impossible de filtrer la
          // fenêtre — conservées telles quelles plutôt qu'un count menteur.
          leagues.push(league);
          total += league.matchCount;
          continue;
        }
        const kept = details.filter((m) => matchInTimeWindow(m, tf, now));
        if (kept.length === 0) continue;
        const count = kept.length;
        total += count;
        live += kept.filter((m) => m.isLive).length;
        leagues.push({ ...league, matchCount: count, matches: kept });
      }
      if (leagues.length > 0) countries.push({ ...country, leagues });
    }
    return { ...sport, totalMatches: total, liveMatches: live, countries };
  });
}

/**
 * Recherche plein-texte sur l'arborescence : sport, pays, ligue puis
 * équipes/joueurs (élagage des branches vides). Dès la 2e lettre tapée.
 */
export function filterTreeByQuery(tree: SportNode[], query: string): SportNode[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return tree;

  const out: SportNode[] = [];
  for (const sport of tree) {
    if (sport.name.toLowerCase().includes(q)) {
      out.push(sport);
      continue;
    }
    let sportTotal = 0;
    let sportLive = 0;
    const countries: CountryNode[] = [];
    for (const country of sport.countries) {
      if (country.name.toLowerCase().includes(q)) {
        const t = country.leagues.reduce((n, l) => n + l.matchCount, 0);
        sportTotal += t;
        countries.push(country);
        continue;
      }
      const leagues: LeagueNode[] = [];
      for (const league of country.leagues) {
        if (league.name.toLowerCase().includes(q)) {
          sportTotal += league.matchCount;
          leagues.push(league);
          continue;
        }
        const matched = (league.matches ?? []).filter(
          (m) =>
            m.homeName.toLowerCase().includes(q) || m.awayName.toLowerCase().includes(q),
        );
        if (matched.length > 0) {
          sportTotal += matched.length;
          sportLive += matched.filter((m) => m.isLive).length;
          leagues.push({ ...league, matchCount: matched.length, matches: matched });
        }
      }
      if (leagues.length > 0) countries.push({ ...country, leagues });
    }
    if (countries.length > 0) {
      out.push({ ...sport, totalMatches: sportTotal, liveMatches: sportLive, countries });
    }
  }
  return out;
}
