import { NextResponse } from "next/server";
import { createTtlCache, isFresh } from "@/lib/cached-route";
import { loadMergedPrematch } from "@/lib/hockey/prematch-data";
import { loadKhlSchedule, khlCalendarWindow, loadOfficialHockeySchedule } from "@/lib/hockey/khl-schedule";

const CACHE_TTL = 5 * 60_000;

type CachePayload = {
  matches: unknown[];
  source: string;
  degraded: boolean;
  /**
   * Volumétrie par source. Elle fait partie du CACHE, pas seulement de la
   * réponse fraîche : sinon la branche « cache hit » renvoyait un payload sans
   * `counts`. Un payload différent selon l'entrée est un bug.
   */
  counts: { total: number; bsd: number; prematch: number; hockeytech: number };
};

const cache = createTtlCache<CachePayload | null>("__hockeyMatchesCache");

async function fetchBSDHockey(): Promise<unknown[]> {
  try {
    // Pattern tennis (bsd-tennis-service.ts) : base = /hockey, endpoints = /api/v2/...
    // Ancien : base=/api + endpoint=/hockey/api/v2/... → /api/hockey/api/v2/... = 404 systématique
    const BSD_BASE_URL = "https://sports.bzzoiro.com/hockey";
    const BSD_API_KEY = process.env.BSD_API_KEY || "";
    if (!BSD_API_KEY) return [];

    // La chaîne est RETOURNÉE telle quelle, sans `new Promise` autour.
    //
    // Bug qui a gardé cette route morte toute la journée du 2026-10-05
    // (0 réponse 200 dans les logs nginx, 504 « upstream timed out ») : le
    // code enveloppait la chaîne dans `new Promise((resolve, reject) => {
    //   const req = fetch(...).then(...).catch(reject); })`. L'exécuteur
    //   IGNORE la valeur renvoyée par la chaîne et `resolve` n'était JAMAIS
    //   appelé — seule l'erreur passait, via `.catch(reject)`. Donc sur
    //   SUCCÈS la promesse restait en suspens pour l'éternité : `await
    //   fetchBSD(...)` ne se réglait pas, `Promise.all` non plus, et la route
    //   ne répondait jamais. Elle ne « fonctionnait » que si l'API BSD
    //   ÉCHOUAIT, puisque `.catch(() => [])` est alors atteint.
    //
    //   Le signal `AbortSignal.timeout(20000)` ne pouvait rien : le fetch était
    //   déjà terminé, c'est la promesse qui restait en suspens.
    //
    //   Attrapé parce qu'un test qui rejoue la même logique en la réécrivant ne
    //   reproduit pas l'enveloppe : il faut tester la route RÉELLE, pas sa
    //   réimplémentation.
    const fetchBSD = (endpoint: string): Promise<unknown[]> =>
      fetch(`${BSD_BASE_URL}${endpoint}`, {
        headers: {
          "Authorization": `Token ${BSD_API_KEY}`,
          "Accept": "application/json",
        },
        signal: AbortSignal.timeout(20000),
      })
        .then((res) => {
          if (res.status === 429 || res.status >= 500) {
            throw new Error(`HTTP ${res.status}`);
          }
          return res.json();
        })
        // BSD v2 renvoie {count, results} (parfois {matches} legacy) — un objet
        // non-array propageait au spread du caller → throw → catch → [].
        .then((parsed) => {
          if (Array.isArray(parsed)) return parsed;
          if (Array.isArray(parsed?.results)) return parsed.results as unknown[];
          if (Array.isArray(parsed?.matches)) return parsed.matches as unknown[];
          return [];
        });

    const live = await fetchBSD("/api/v2/matches/live/").catch(() => [] as unknown[]);
    const predictions = await fetchBSD("/api/v2/predictions/").catch(() => [] as unknown[]);

    const asObj = (v: unknown): Record<string, unknown> | null =>
      typeof v === "object" && v !== null ? (v as Record<string, unknown>) : null;
    const str = (v: unknown): string => (typeof v === "string" ? v : v == null ? "" : String(v));
    const normName = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

    const normalizeBSDM = (m: Record<string, unknown>) => {
      // BSD v2 : home_team/away_team = objets {name}, league = objet, match_date
      const homeTeam = asObj(m.home_team);
      const awayTeam = asObj(m.away_team);
      const leagueObj = asObj(m.league);
      const homeName = str(homeTeam?.name) || str(m.home) || str(m.homeTeam) || "";
      const awayName = str(awayTeam?.name) || str(m.away) || str(m.awayTeam) || "";
      return {
        id: str(m.id || m.event_id || m.match_id) || "bsd-" + str(homeTeam?.id ?? "") + "-" + str(awayTeam?.id ?? "") + "-" + normName(homeName) + normName(awayName),
        homeName,
        awayName,
        scheduledAt: str(m.match_date || m.scheduled_at || m.start_time || m.date) || null,
        isLive: !!m.live || !!m.status_live,
        // Ne JAMAIS passer l'objet league comme leagueId (ancien bug "[object Object]")
        leagueId: str(m.league_id) || str(leagueObj?.id ?? leagueObj?.slug ?? leagueObj?.name) || "hockey",
        leagueName: str(m.league_name) || str(leagueObj?.name) || str(m.competition) || "Hockey",
        countryName: str(m.country || m.country_name) || "International",
        countryCode: str(m.country_code) || "INT",
        oddsH: m.odds_home || m.odds1,
        oddsD: m.odds_draw || m.oddsX,
        oddsA: m.odds_away || m.odds2,
        probBSDH: m.prob_home,
        probBSD: m.prob_draw,
        probBSDA: m.prob_away,
        oddsBSDH: m.odds_home,
        oddsBSDD: m.odds_draw,
        oddsBSDA: m.odds_away,
        h2hUrl: str(m.h2h_url) || null,
        source: "bsd",
      };
    };

    const matches: unknown[] = [];
    for (const m of [...live, ...predictions]) {
      matches.push(normalizeBSDM(m as Record<string, unknown>));
    }
    return matches;
  } catch (e) {
    console.warn("[hockey] BSD fetch failed:", e);
    return [];
  }
}

async function fetchPrematchMatches(): Promise<unknown[]> {
  try {
    const data = loadMergedPrematch();
    if (!data) return [];
    const matches: unknown[] = [];
    for (const [leagueId, league] of Object.entries(data.leagues)) {
      if (league?.matches && Array.isArray(league.matches)) {
        for (const m of league.matches) {
          const odds = m.odds1X2;
          matches.push({
            id: `prematch-${leagueId}-${m.team1Id}-${m.team2Id}`,
            homeName: m.team1Name || "",
            awayName: m.team2Name || "",
            scheduledAt: m.date || "",
            isLive: false,
            leagueId,
            leagueName: leagueId.toUpperCase(),
            countryName: "International",
            countryCode: "INT",
            oddsH: odds?.home ?? null,
            oddsD: odds?.draw ?? null,
            oddsA: odds?.away ?? null,
            h2h: m.h2h || null,
            source: "prematch",
          });
        }
      }
    }
    return matches;
  } catch (e) {
    console.warn("[hockey] Prematch fetch failed:", e);
    return [];
  }
}

/**
 * Calendrier KHL officiel (HockeyTech `view=schedule`, 748 matchs pour la
 * saison 2026-2027) — la seule source fixtures KHL exploitable aujourd'hui.
 * `scorebar` est mesurée à 0/6 (tronquée par le proxy), Annabet coupe le TCP
 * depuis le VPS, et BetExplorer dépend d'un Chromium qui ne démarre pas en
 * local. Le fichier est donc scrappé une fois par jour et lu ici tel quel.
 *
 * Chaque match porte son `predictionsAvailable` : le calendrier fonctionne
 * même sans classement, et l'UI peut distinguer « pas de match » de « match
 * sans prédiction » au lieu de deviner.
 */
function fetchKhlMatches(): unknown[] {
  try {
    const data = loadKhlSchedule();
    if (!data) return [];
    const { fenetre, matchs } = khlCalendarWindow(data);
    return matchs.map((m) => ({
      id: `khl-${m.id}`,
      homeName: m.homeName || "",
      awayName: m.awayName || "",
      scheduledAt: m.scheduledAt,
      isLive: m.isLive,
      isFinished: m.isFinished,
      leagueId: "khl",
      leagueName: "KHL",
      countryName: "Russie",
      countryCode: "RU",
      // Aucune cote sur cette source : `null` explicite, jamais 0 (0 se lit
      // comme une cote de 1.00 sur un marché fermé).
      oddsH: null,
      oddsD: null,
      oddsA: null,
      homeGoals: m.homeGoals,
      awayGoals: m.awayGoals,
      overtime: m.overtime,
      shootout: m.shootout,
      venue: m.venue,
      homeCode: m.homeCode,
      awayCode: m.awayCode,
      predictionsAvailable: m.predictionsAvailable,
      predictionsUnavailableReason: m.predictionsUnavailableReason,
      window: fenetre,
      h2h: null,
      source: "hockeytech",
    }));
  } catch (e) {
    console.warn("[hockey] KHL schedule load failed:", e);
    return [];
  }
}

/**
 * Calendrier NHL officiel (ESPN public API, 1344 matchs pour la saison
 * 2026-2027). C'est la source la plus large du projet hockey : RotoWire
 * sert les alignements, hockey-reference et quanthockey renvoient 403.
 *
 * Le fichier est produit par `scripts/scrape-nhl-schedule.mjs` et porte le
 * MÊME schéma que `khl_schedule.json`, d'où le lecteur partagé.
 */
function fetchNhlMatches(): unknown[] {
  try {
    const data = loadOfficialHockeySchedule("nhl");
    if (!data) return [];
    const { fenetre, matchs } = khlCalendarWindow(data);
    return matchs.map((m) => ({
      id: `nhl-${m.id}`,
      homeName: m.homeName || "",
      awayName: m.awayName || "",
      scheduledAt: m.scheduledAt,
      isLive: m.isLive,
      isFinished: m.isFinished,
      leagueId: "nhl",
      leagueName: "NHL",
      countryName: "USA/Canada",
      countryCode: "US",
      oddsH: null,
      oddsD: null,
      oddsA: null,
      homeGoals: m.homeGoals,
      awayGoals: m.awayGoals,
      venue: m.venue,
      homeCode: m.homeCode,
      awayCode: m.awayCode,
      predictionsAvailable: m.predictionsAvailable,
      predictionsUnavailableReason: m.predictionsUnavailableReason,
      window: fenetre,
      h2h: null,
      source: "espn",
    }));
  } catch (e) {
    console.warn("[hockey] NHL schedule load failed:", e);
    return [];
  }
}

export async function GET() {
  const cached = cache.getEntry();
  if (cached?.data && isFresh(cached, CACHE_TTL) && !cached.data.degraded) {
    return NextResponse.json({
      matches: cached.data.matches,
      source: cached.data.source,
      degraded: cached.data.degraded,
      counts: cached.data.counts,
    });
  }

  try {
    const [bsdMatches, prematchMatches, khlMatches, nhlMatches] = await Promise.all([
      fetchBSDHockey(),
      fetchPrematchMatches(),
      Promise.resolve(fetchKhlMatches()),
      Promise.resolve(fetchNhlMatches()),
    ]);

const allMatches = [...bsdMatches, ...prematchMatches, ...khlMatches, ...nhlMatches];
    const seen = new Set<string>();
    const norm = (s: string) => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");

    // Garde unique, appliquée aux QUATRE sources après fusion.
    //
    // MESURÉ en production le 2026-10-06 : les 50 lignes BSD servies portaient
    // « Home » / « Away » comme noms d'équipe, la source ne fournissant pas de
    // nom. Repliées sur du texte, elles étaient invisibles : 20 % du payload
    // était du vide habillé en données, et `counts.bsd = 50` le comptait
    // comme une mesure — un `0` déguisé en donnée, le défaut exact que les
    // routes de football corrigent déjà ailleurs dans ce dépôt.
    //
    // Un match dont les deux équipes ne sont pas nommées n'est pas un match :
    // il est ÉCARTÉ et COMPTÉ, jamais renommé. Appliqué ici plutôt qu'autour
    // de chaque source parce que le défaut est commun aux quatre — le repli
    // `|| "Home"` existait dans les quatre mappingeurs.
    const sansEquipes = new Map<string, number>();
    const nommes = allMatches.filter((m) => {
      const r = m as Record<string, unknown>;
      const h = norm(String(r.homeName ?? ""));
      const a = norm(String(r.awayName ?? ""));
      if (!h || !a || h === "home" || h === "away" || a === "home" || a === "away") {
        const src = String(r.source ?? "?");
        sansEquipes.set(src, (sansEquipes.get(src) ?? 0) + 1);
        return false;
      }
      return true;
    });
    for (const [src, n] of sansEquipes) console.warn(`[hockey] ${src} : ${n} match(s) ecarte(s), nom d'equipe absent de la source`);

    const deduped = nommes.filter((m) => {
      const id = String((m as Record<string, unknown>).id);
      // Clé étendue : ids divergents BSD↔prematch pour un même fixture
      const key = id + "|" + norm((m as Record<string, unknown>).homeName as string) + "|" + norm((m as Record<string, unknown>).awayName as string);
      if (seen.has(key) || seen.has(id)) return false;
      seen.add(key);
      seen.add(id);
      return true;
    });

    const hasBSD = bsdMatches.length > 0;
    const hasPrematch = prematchMatches.length > 0;
    const hasKhl = khlMatches.length > 0;
    const hasNhl = nhlMatches.length > 0;
    const degraded = !(hasBSD || hasPrematch || hasKhl || hasNhl);

// Volumétrie par source, mesurée sur ce qui est RÉELLEMENT servi.
    //
    // MESURÉ en production le 2026-10-06, juste après le correctif des noms de
    // substitution : la réponse annonçait `counts.bsd = 50` et
    // `source = bsd+…` alors qu'aucun match BSD n'était servi — les 50 avaient
    // été écartés. Un compte qui décrit la source brute et non la réponse est
    // un compte faux : il annonce une contribution que le client ne reçoit
    // pas, et un tableau de volumétrie qui ment est pire que pas de tableau.
    // On compte donc sur `deduped`, après garde ET après dédoublonnage.
    const compteParSource = (nom: string) =>
      deduped.filter((m) => String((m as Record<string, unknown>).source) === nom).length;

    const counts = {
      total: deduped.length,
      bsd: compteParSource("bsd"),
      prematch: compteParSource("prematch"),
      hockeytech: compteParSource("hockeytech"),
      espn: compteParSource("espn"),
    };

    // `source` ne nomme que les sources qui contribuent réellement : annoncer
    // « bsd » quand la source n'a fourni aucun match exploitable est faux.
    const sourceParts = (["bsd", "prematch", "hockeytech", "espn"] as const).filter((s) => counts[s] > 0);
    const source = sourceParts.length > 0 ? sourceParts.join("+") : "none";

    if (!degraded) {
      cache.set({ matches: deduped, source, degraded, counts });
    }

    return NextResponse.json({
      matches: deduped,
      source,
      degraded,
      // Volumétrie par source : sans elle, « source: hockeytech » ne dit pas
      // si l'onglet affiche 5 matchs NHL ou 748 matchs KHL.
      counts,
    });
  } catch (err) {
    console.error("[hockey] fetch failed:", (err as Error).message);
    return NextResponse.json({ error: "hockey data unavailable" }, { status: 503 });
  }
}
