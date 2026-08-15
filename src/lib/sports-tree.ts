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
    league.matches!.push({
      id: raw.id,
      homeName: raw.homeName,
      awayName: raw.awayName,
      scheduledAt: raw.scheduledAt ?? "",
      isLive: raw.isLive,
    });
  }

  const countries = Array.from(countryMap.values());
  for (const country of countries) {
    country.leagues.sort((a, b) => b.matchCount - a.matchCount || a.name.localeCompare(b.name));
    for (const league of country.leagues) {
      league.matches = pickLevel4(league.matches ?? []);
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
};

export function footballToRaw(matches: MinimalFootballMatch[] | undefined | null): RawTreeMatch[] {
  const list = Array.isArray(matches) ? matches : [];
  return list
    .filter((m) => m && m.home?.name && m.away?.name)
    .map((m) => {
      const isLive = !!m.live && (m.live.status === "LIVE" || m.live.status === "HT");
      const country = m.league?.country?.trim() || "International";
      return {
        id: String(m.id),
        homeName: m.home!.name!,
        awayName: m.away!.name!,
        scheduledAt: isValidDate(m.scheduledAt) ? m.scheduledAt! : null,
        isLive,
        leagueId: String(m.league?.id ?? slug(m.league?.name ?? "autre")),
        leagueName: m.league?.name?.trim() || "Autre compétition",
        countryName: country,
        countryCode: m.league?.countryCode?.trim() || INT,
      };
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
    .filter((m) => m && m.playerA?.name && m.playerB?.name)
    .map((m) => {
      const tournament = m.tournament?.trim() || "Tournoi";
      return {
        id: String(m.id),
        homeName: m.playerA!.name!,
        awayName: m.playerB!.name!,
        scheduledAt: isValidDate(m.scheduledAt) ? m.scheduledAt! : null,
        isLive: false,
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

/** Rugby : pas de matchs individuels agrégés — counts depuis `upcomingCount`. */
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
  if (m.isLive) return true; // les matchs en direct restent visibles
  const { hours, today } = parseTimeFilter(tf);
  if (hours !== null) {
    return filterByStartWindow([m], hours, (x) => x.scheduledAt, now).length > 0;
  }
  if (today) {
    return filterByToday([m], (x) => x.scheduledAt, now).length > 0;
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
