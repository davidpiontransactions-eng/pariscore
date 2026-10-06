#!/usr/bin/env bun
/**
 * pipeline-basketball-vitibet-bsd.ts — Pipeline basket : extraction Vitibet
 * (hub principal + pop-ups) et enrichissement multi-sources via l'API BSD.
 *
 * Sources
 *   1. Vitibet — https://www.vitibet.com/index.php?clanek=quicktips&sekce=basket&lang=en
 *      • Hub quotidien (?date=AAAA-MM-JJ, onglets changeDate() = J→J+3) :
 *        blocs .livescore-league[data-lid] (ligue + pays + URL /basketball/tips/)
 *        et cartes .livescore-match-row (fixture_id, league_id, data-time UTC+2,
 *        équipes data-h/data-a + logo team_{id}.png, status, INDEX .idx-val,
 *        probas .prob-itemPct (1/X/2), tip .tip-indicator-circle,
 *        score prédit .livescore-score-line, score réel .act-score-line).
 *        Zéros / no-tip-row = pas de prédiction → NULL (jamais inventé).
 *      • Pop-ups ?clanek=basket-match-detail&fixture_id=&league_id= (1 req/s) :
 *        🧠 Vitisport Analytics (INDEX + probas 1/0/2 + Calculated Form + Team
 *        Power), 📅 Last 8 Matches (forme H/A + score par équipe),
 *        ⚔️ Head-to-Head (H2H natif : date, équipes, score), 📊 Overall Table.
 *   2. API BSD — https://sports.bzzoiro.com/basketball/api/v2 (Token BSD_API_KEY)
 *      • /leagues/ (7 : NBA, Euroleague, Eurocup, Liga ACB, Lega A, BBL, WNBA)
 *      • /events/?date_from&date_to&status&team&league (fenêtre ±1 j pour la
 *        union des fuseaux), /events/{id}/ (periods_score = Q1..Q4 + OT,
 *        prediction ELO/CatBoost), /events/{id}/box-score/ (composition +
 *        stats joueurs), /players/?team={id} (season_avg → top joueurs).
 *
 * Jointure (src/lib/basketball-entity-match.ts) — normalisation + Levenshtein +
 * Jaro-Winkler + couverture de tokens ; seuil 0.84, sinon bsd_team_id: null
 * (jamais d'entité inventée). Matching équipe orienté (domicile↔domicile) avec
 * cohérence de date ±1 jour, appariement glouton par meilleur score.
 *
 * Sortie : data/basketball_vitibet_bsd.json (schéma normalisé du lot, §3) +
 * cache d'agrégats d'équipe data/cache/basket_bsd_team_stats.json (TTL 24 h,
 * calculés depuis les box-scores des K derniers matchs terminés : PPG, FG%,
 * 3P%, rebonds/passes/balles perdus par match).
 *
 * Usage :
 *   bun run scripts/pipeline-basketball-vitibet-bsd.ts                  # J→J+3 complet
 *   bun run scripts/pipeline-basketball-vitibet-bsd.ts --date=2026-10-05 # un seul jour
 *   bun run scripts/pipeline-basketball-vitibet-bsd.ts --limit=5 --no-popups  # smoke
 *   bun run scripts/pipeline-basketball-vitibet-bsd.ts --dry-run         # résumé, 0 écriture
 *   bun run scripts/pipeline-basketball-vitibet-bsd.ts --no-team-stats   # sans agrégats box-score
 *
 * Politesse : Vitibet 1 req/s (robots.txt allow sur *clanek=quicktips ; URLs
 * interdites jamais requêtées), BSD 250 ms — UA PariscoreBot identifié.
 */
import fs from "node:fs";
import path from "node:path";
import {
  leagueSimilarity,
  matchBest,
  similarity,
  stripLeagueCountry,
} from "../src/lib/basketball-entity-match";
import { vitibetPrediction, vitibetTip } from "../src/lib/basketball-vitibet-guard";

// ─── CLI ──────────────────────────────────────────────────────────────────────
const args: Record<string, string | boolean> = {};
for (const a of process.argv.slice(2)) {
  const m = a.match(/^--([a-z-]+)(?:=(.*))?$/);
  if (m) args[m[1]] = m[2] === undefined ? true : m[2];
}
const DATE_ARG = typeof args.date === "string" ? args.date : null;
const LIMIT = typeof args.limit === "string" ? parseInt(args.limit, 10) : 0;
const DRY_RUN = !!args["dry-run"];
const NO_POPUPS = !!args["no-popups"];
const NO_TEAM_STATS = !!args["no-team-stats"];
const OUT_PATH =
  typeof args.out === "string"
    ? args.out
    : path.join(process.cwd(), "data", "basketball_vitibet_bsd.json");

if (DATE_ARG && !/^\d{4}-\d{2}-\d{2}$/.test(DATE_ARG)) {
  console.error(`[pipe] --date invalide : ${DATE_ARG} (AAAA-MM-JJ)`);
  process.exit(1);
}

// ─── Constantes ───────────────────────────────────────────────────────────────
const VITIBET_BASE = "https://www.vitibet.com";
const VITIBET_UA = "PariscoreBot (+https://pariscore.fr)";
const VITIBET_DELAY_MS = 1000; // politesse ~1 req/s
const BSD_BASE = "https://sports.bzzoiro.com/basketball/api/v2";
const BSD_DELAY_MS = 250;
const WINDOW_DAYS = 4; // J → J+3 (onglets Vitibet)
const TEAM_STATS_TTL_MS = 24 * 60 * 60 * 1000;
const TEAM_STATS_K = 5; // derniers matchs terminés agrégés
const MIN_MATCH_SCORE = 0.84;
const RETRIES = 3;
const CACHE_PATH = path.join(process.cwd(), "data", "cache", "basket_bsd_team_stats.json");
const PLAYERS_CACHE_PATH = path.join(process.cwd(), "data", "cache", "basket_bsd_team_players.json");

// ─── Env (bun charge .env ; repli lecture fichier pour node) ──────────────────
function envValue(name: string): string | undefined {
  if (process.env[name]) return process.env[name];
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), ".env"), "utf8");
    const m = raw.match(new RegExp(`^${name}=(.*)$`, "m"));
    return m ? m[1].trim().replace(/^["']|["']$/g, "") : undefined;
  } catch {
    return undefined;
  }
}
const BSD_KEY = envValue("BSD_API_KEY") || "";

// ─── HTTP ─────────────────────────────────────────────────────────────────────
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchRetry(url: string, headers: Record<string, string>, delayMs: number): Promise<string | null> {
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(20_000),
      });
      if (res.status === 429 && attempt < RETRIES) {
        await sleep(1000 * attempt);
        continue;
      }
      if (!res.ok) {
        console.warn(`[http] HTTP ${res.status} ${url}`);
        if (attempt < RETRIES) { await sleep(500 * attempt); continue; }
        return null;
      }
      const body = await res.text();
      await sleep(delayMs);
      return body;
    } catch (err) {
      console.warn(`[http] erreur ${url} (${attempt}/${RETRIES}) : ${(err as Error).message}`);
      if (attempt < RETRIES) await sleep(700 * attempt);
    }
  }
  return null;
}

async function bsdJson(pathname: string): Promise<any | null> {
  if (!BSD_KEY) return null;
  const body = await fetchRetry(
    `${BSD_BASE}${pathname}`,
    { Authorization: `Token ${BSD_KEY}`, Accept: "application/json" },
    BSD_DELAY_MS,
  );
  if (body === null) return null;
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

// ─── Dates ────────────────────────────────────────────────────────────────────
/** Offset (minutes) de Europe/Paris pour l'instant UTC donné (DST compris). */
function parisOffsetMinutes(utcInstantMs: number): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Paris",
    hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const p: Record<string, string> = {};
  for (const part of dtf.formatToParts(new Date(utcInstantMs))) p[part.type] = part.value;
  const asUtc = Date.UTC(
    Number(p.year), Number(p.month) - 1, Number(p.day),
    Number(p.hour) % 24, Number(p.minute), Number(p.second),
  );
  return (asUtc - utcInstantMs) / 60_000;
}

/** « 2026-10-05 01:00:00 » (heure Vitibet = Europe/Paris) → ISO UTC Z. */
function parisLocalToUtcIso(local: string): string | null {
  const m = local.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  const naive = Date.parse(`${m[1]}T${m[2]}:${m[3] || "00"}Z`);
  if (!Number.isFinite(naive)) return null;
  let offset = parisOffsetMinutes(naive);
  offset = parisOffsetMinutes(naive - offset * 60_000); // 2e passe (transitions)
  return new Date(naive - offset * 60_000).toISOString();
}

/** Date ISO UTC → clé date Europe/Paris (AAAA-MM-JJ). */
function isoToParisDate(iso: string): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date(iso));
}

function todayPlus(n: number): string {
  const d = new Date(Date.now() + n * 86_400_000);
  return d.toISOString().slice(0, 10);
}

// ─── Types Vitibet ────────────────────────────────────────────────────────────
type VitibetStatus = "scheduled" | "live" | "finished";

type FormItem = {
  date: string | null;      // « 01.05. » tel qu'affiché (sans année)
  venue: "H" | "A" | null;
  opponent: string;
  points_for: number | null;
  points_against: number | null;
  result: "W" | "L" | null;
};

type H2hRow = {
  date: string | null;      // « 02.04.2026 » → 2026-04-02 si convertible
  team1: string;            // équipe à gauche du score côté « span droite »
  team2: string;
  score1: number | null;
  score2: number | null;
};

type PopupData = {
  index: number | null;
  prob_home: number | null;
  prob_draw: number | null;
  prob_away: number | null;
  calc_form_home: number | null;
  calc_form_away: number | null;
  team_power_home: number | null;
  team_power_away: number | null;
  h2h: H2hRow[];
  form_home: FormItem[];
  form_away: FormItem[];
  form_home_team: string | null;
  form_away_team: string | null;
};

type VitibetLeague = {
  league_id: number;
  title: string;            // « United States: NBA »
  name: string;             // « NBA » (titre sans pays)
  country: string | null;   // « United States »
  url: string | null;
};

type VitibetMatch = {
  fixture_id: number;
  league_id: number;
  date_match: string | null;
  heure: string | null;
  home_name: string;
  away_name: string;
  home_tid: number | null;
  away_tid: number | null;
  home_logo: string | null;
  away_logo: string | null;
  status: VitibetStatus;
  tip: string | null;
  index: number | null;
  prob_home: number | null;
  prob_draw: number | null;
  prob_away: number | null;
  predicted_home: number | null;
  predicted_away: number | null;
  actual_home: number | null;
  actual_away: number | null;
  popup: PopupData | null;
};

// ─── Parsing Vitibet ──────────────────────────────────────────────────────────
const toNum = (s: string | undefined | null): number | null => {
  if (s === undefined || s === null) return null;
  const t = String(s).replace("%", "").replace(",", ".").replace("+", "").trim();
  if (t === "" || t === "-" || t === "?" || t === "–" || t === "—") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};
const toInt = (s: string | undefined | null): number | null => {
  const n = toNum(s);
  return n === null ? null : Math.trunc(n);
};

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#039;|&apos;/g, "'").replace(/&nbsp;/g, " ");
}

/** Parse les cartes .livescore-match-row d'un bloc (hub ou segment de ligue). */
function parseRows(segment: string): VitibetMatch[] {
  const rows: VitibetMatch[] = [];
  const rowRe = /<a\b([^>]*\blivescore-match-row[^>]*)>([\s\S]*?)<\/a>/g;
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(segment))) {
    const attrs = m[1];
    const body = m[2];
    const href = (attrs.match(/href=["']([^"']+)["']/) || [])[1] || "";
    const fixtureId = toInt((href.match(/fixture_id=(\d+)/) || [])[1]);
    const leagueId = toInt((href.match(/league_id=(\d+)/) || [])[1]) ??
      toInt((attrs.match(/data-lid=["'](\d+)["']/) || [])[1]);
    if (fixtureId === null || leagueId === null) continue;

    const statusRaw = ((attrs.match(/data-status=["']([^"']+)["']/) || [])[1] || "scheduled").toLowerCase();
    const status: VitibetStatus =
      statusRaw === "live" || statusRaw === "finished" ? statusRaw : "scheduled";

    const dataTime = (body.match(/data-time=["']([^"']+)["']/) || [])[1] || "";
    const dateMatch = dataTime.slice(0, 10) || null;
    const heure = dataTime.length >= 16 ? dataTime.slice(11, 16) : null;

    const teams = [...body.matchAll(/livescore-team-name["'][^>]*>([^<]*)</g)]
      .map((t) => decodeEntities(t[1]).trim());
    if (teams.length < 2) continue;

    const homeTid = toInt((attrs.match(/data-h=["'](\d+)["']/) || [])[1]);
    const awayTid = toInt((attrs.match(/data-a=["'](\d+)["']/) || [])[1]);
    const logos = [...body.matchAll(/src=["']([^"']*team_\d+\.png)["']/g)].map((x) => x[1]);

    // Prédiction (hub) : absente sur les cartes no-tip-row → NULL partout.
    // ⚠️ Même garde que le pop-up (voir parsePopup) : un Index non nul ne
    // prouve PAS une prédiction publiée. Le hub peut afficher une valeur
    // d'index sur une carte sans proba, et l'ancien test `index !== 0` la
    // déclarait « prédite ». On exige une probabilité 1 ET 2 non nulles.
    const index = toNum((body.match(/idx-val["'][^>]*>\s*([+\-\d.,]+?)\s*</) || [])[1]);
    const tipRaw = ((body.match(/tip-indicator-circle["'][^>]*>([^<]*)</) || [])[1] || "").trim();
    const tip = /^[12X]$/.test(tipRaw) ? tipRaw : null;

    const probs: Record<string, number | null> = { "1": null, X: null, "2": null };
    const probRe = /prob-itemPct[\s\S]*?prob-head["'][^>]*>\s*([1X2])\s*<[\s\S]*?prob-val["'][^>]*>\s*(\d+)\s*%/g;
    let pm: RegExpExecArray | null;
    while ((pm = probRe.exec(body))) probs[pm[1]] = toInt(pm[2]);

    // Présence réelle = proba domicile ET extérieur publiées (même règle que le
    // pop-up, voir src/lib/basketball-vitibet-guard.ts). Un index non nul ne
    // suffit pas : le hub affiche une valeur d'index sur des cartes sans proba.
    const hasPrediction =
      probs["1"] !== null && probs["1"] > 0 && probs["2"] !== null && probs["2"] > 0;

    const scoreLines = [...body.matchAll(/livescore-score-line["'][^>]*>([^<]*)</g)]
      .map((s) => toInt(s[1]));

    // Score réel (listing = source FT) : .act-score-line ou badge « FT d:e ».
    const actualCol = (body.match(/livescore-match-actual-col["'][^>]*>([\s\S]*?)(?=<div class=["']livescore-match-prob-col|<div class=["']livescore-match-tip-badge-col|$)/) || [])[1] || "";
    const actLines = [...actualCol.matchAll(/act-score-line[^>]*>(\d+)</g)].map((s) => toInt(s[1]));
    let actualHome: number | null = null;
    let actualAway: number | null = null;
    if (actLines.length >= 2) {
      [actualHome, actualAway] = [actLines[0], actLines[1]];
    } else {
      const badge = actualCol.match(/(?:FT|LIVE)[^\d<]{0,10}(\d+)\s*:\s*(\d+)/);
      if (badge) { actualHome = toInt(badge[1]); actualAway = toInt(badge[2]); }
    }

    rows.push({
      fixture_id: fixtureId,
      league_id: leagueId,
      date_match: dateMatch,
      heure,
      home_name: teams[0],
      away_name: teams[1],
      home_tid: homeTid,
      away_tid: awayTid,
      home_logo: logos[0] ? `${VITIBET_BASE}${logos[0]}` : null,
      away_logo: logos[1] ? `${VITIBET_BASE}${logos[1]}` : null,
      status,
      tip,
      index: hasPrediction ? index : null,
      prob_home: hasPrediction ? probs["1"] : null,
      prob_draw: hasPrediction ? probs.X : null,
      prob_away: hasPrediction ? probs["2"] : null,
      predicted_home: scoreLines[0] ?? null,
      predicted_away: scoreLines[1] ?? null,
      actual_home: actualHome,
      actual_away: actualAway,
      popup: null,
    });
  }
  return rows;
}

/** Blocs de ligue du hub : data-lid + titre + URL tips + cartes internes. */
function parseHub(html: string): { leagues: VitibetLeague[]; matches: VitibetMatch[] } {
  const starts = [...html.matchAll(/<div[^>]*class=["'][^"']*livescore-league[^"']*["']/g)]
    .map((m) => m.index ?? 0);
  const leagues: VitibetLeague[] = [];
  const matches: VitibetMatch[] = [];
  for (let i = 0; i < starts.length; i++) {
    const segment = html.slice(starts[i], i + 1 < starts.length ? starts[i + 1] : undefined);
    const lid = toInt((segment.match(/data-lid=["'](\d+)["']/) || [])[1]);
    if (lid === null) continue;
    const title = decodeEntities(
      ((segment.match(/league-title["'][^>]*>([^<]*)</) || [])[1] || "").trim(),
    );
    const url = (segment.match(/href=["']([^"']*\/basketball\/tips\/[^"']+)["']/) || [])[1] || null;
    const colon = title.indexOf(":");
    const country = colon > 0 ? title.slice(0, colon).trim() : null;
    const name = stripLeagueCountry(title);
    leagues.push({ league_id: lid, title, name, country, url });
    for (const row of parseRows(segment)) {
      if (row.league_id === lid) matches.push(row);
    }
  }
  return { leagues, matches };
}

/** Pop-up match-detail : analytics + Last 8 + H2H (styles/scripts retirés). */
function parsePopup(html: string): PopupData {
  const dom = html
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<script[\s\S]*?<\/script>/g, " ");

  // 🧠 Analytics — INDEX (0 = pas de prédiction → NULL)
  const idxRaw = toNum(
    (dom.match(/analytics-index-box">\s*<div[^>]*font-weight:\s*900[^>]*>\s*([+\-\d.,]+)/) || [])[1],
  );
  // 🧠 Analytics — INDEX + probas
  //
  // La garde de présence vit dans src/lib/basketball-vitibet-guard.ts (testée
  // sur du HTML réel). Rappel du bug corrigé : `idxRaw !== 0` déclarait « prédit »
  // un match dont les trois cellules valaient 0% (Index -10.42 malgré tout), puis
  // en tirait un `tip` via `0 >= 0` → « 1 ». Voir basketball-vitibet-guard.ts.
  const probs = vitibetPrediction(dom);
  const index = probs ? idxRaw : null;
  const probHome = probs ? probs.probHome : null;
  const probDraw = probs ? probs.probDraw : null;
  const probAway = probs ? probs.probAway : null;

  const formM = dom.match(/>([+\-\d.,]+)<\/span><span>Calculated Form<\/span><span>([+\-\d.,]+)<\/span>/);
  const powerM = dom.match(/>([+\-\d.,]+)<\/span><span>Team Power<\/span><span>([+\-\d.,]+)<\/span>/);

  // ⚔️ H2H natif : rangees date | eqDroite | score | eqGauche (score = 1:2)
  const h2h: H2hRow[] = [];
  const h2hStart = dom.search(/Head-to-Head\s*\(H2H\)/);
  if (h2hStart >= 0) {
    const rest = dom.slice(h2hStart);
    const endRel = rest.search(/<h3 class="section-title"/);
    const zone = endRel > 0 ? rest.slice(0, endRel) : rest.slice(0, 12_000);
    const rowRe = /grid-template-columns:\s*80px 1fr 60px 1fr;[^>]*>\s*<span[^>]*>([^<]*)<\/span>\s*<span[^>]*>([^<]*)<\/span>\s*<span[^>]*>([^<]*)<\/span>\s*<span[^>]*>([^<]*)<\/span>/g;
    let hm: RegExpExecArray | null;
    while ((hm = rowRe.exec(zone))) {
      const [, d, t1, score, t2] = hm;
      const sm = score.match(/(\d+)\s*:\s*(\d+)/);
      const dm = d.match(/(\d{2})\.(\d{2})\.(\d{4})/);
      h2h.push({
        date: dm ? `${dm[3]}-${dm[2]}-${dm[1]}` : null,
        team1: decodeEntities(t1).trim(),
        team2: decodeEntities(t2).trim(),
        score1: sm ? toInt(sm[1]) : null,
        score2: sm ? toInt(sm[2]) : null,
      });
      if (h2h.length >= 20) break;
    }
  }

  // 📅 Last 8 Matches : 2 cartes (domicile puis extérieur), entete = nom équipe.
  const parseForm = (card: string): { team: string | null; items: FormItem[] } => {
    const team = decodeEntities(
      ((card.match(/background:\s*#f8fafc;[^>]*>([^<]*)</) || [])[1] || "").trim(),
    ) || null;
    const items: FormItem[] = [];
    for (const chunk of card.split(/last-match-item/).slice(1)) {
      const venue = (chunk.match(/loc-(home|away)/) || [])[1];
      const date = (chunk.match(/>(\d{2}\.\d{2}\.)</) || [])[1] || null;
      const opponent = decodeEntities(
        ((chunk.match(/font-weight:\s*600[^>]*>([^<]*)</) || [])[1] || "").trim(),
      );
      const sc = chunk.match(/score-indicator\s+score-(w|l)[^>]*>\s*(\d+)\s*:\s*(\d+)/);
      items.push({
        date,
        venue: venue === "home" ? "H" : venue === "away" ? "A" : null,
        opponent,
        points_for: sc ? toInt(sc[2]) : null,
        points_against: sc ? toInt(sc[3]) : null,
        result: sc ? (sc[1] === "w" ? "W" : "L") : null,
      });
      if (items.length >= 8) break;
    }
    return { team, items };
  };

  let formHome: FormItem[] = [];
  let formAway: FormItem[] = [];
  let formHomeTeam: string | null = null;
  let formAwayTeam: string | null = null;
  const lmStart = dom.search(/last-matches-container/);
  if (lmStart >= 0) {
    const zone = dom.slice(lmStart, lmStart + 24_000);
    const cards = zone.split(/<div class="match-card">/).slice(1, 3);
    if (cards[0]) {
      const parsed = parseForm(cards[0]);
      formHome = parsed.items; formHomeTeam = parsed.team;
    }
    if (cards[1]) {
      const parsed = parseForm(cards[1]);
      formAway = parsed.items; formAwayTeam = parsed.team;
    }
  }

  return {
    index,
    prob_home: probHome,
    prob_draw: probDraw,
    prob_away: probAway,
    calc_form_home: formM ? toNum(formM[1]) : null,
    calc_form_away: formM ? toNum(formM[2]) : null,
    team_power_home: powerM ? toNum(powerM[1]) : null,
    team_power_away: powerM ? toNum(powerM[2]) : null,
    h2h,
    form_home: formHome,
    form_away: formAway,
    form_home_team: formHomeTeam,
    form_away_team: formAwayTeam,
  };
}

// ─── Types BSD + fetchers ─────────────────────────────────────────────────────
type BsdLeague = { id: number; name: string; country: string; country_code: string; is_active: boolean; priority: number };

type BsdEvent = {
  id: number;
  league: { id: number; name: string; country: string };
  home_team: { id: number; name: string; short_name?: string } | null;
  away_team: { id: number; name: string; short_name?: string } | null;
  home_team_name?: string;
  away_team_name?: string;
  event_date: string;
  status: "scheduled" | "live" | "finished" | string;
  home_score: number | null;
  away_score: number | null;
  periods_score?: Record<string, [number, number]> | null;
  prediction?: {
    prob_home_win?: number; prob_away_win?: number;
    elo_home?: number; elo_away?: number;
    model_version?: string; predicted_winner_id?: number;
  } | null;
};

async function bsdPaginate(pathname: string, maxPages = 4): Promise<any[]> {
  const out: any[] = [];
  let url: string | null = `${BSD_BASE}${pathname}`;
  let pages = 0;
  while (url && pages < maxPages) {
    const body: string | null = await fetchRetry(
      url,
      { Authorization: `Token ${BSD_KEY}`, Accept: "application/json" },
      BSD_DELAY_MS,
    );
    if (!body) break;
    try {
      const j = JSON.parse(body);
      if (Array.isArray(j)) { out.push(...j); break; }
      if (Array.isArray(j.results)) out.push(...j.results);
      url = j.next || null;
    } catch {
      break;
    }
    pages++;
  }
  return out;
}

// ─── Cache d'agrégats d'équipe ────────────────────────────────────────────────
type TeamAgg = {
  computed_at: string;
  games: number;
  points_per_game: number | null;
  fg_pct: number | null;
  three_pt_pct: number | null;
  rebounds_pg: number | null;
  assists_pg: number | null;
  turnovers_pg: number | null;
};

type TeamCacheFile = { teams: Record<string, TeamAgg> };

function loadTeamCache(): TeamCacheFile {
  try {
    const j = JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"));
    if (j && typeof j === "object" && j.teams) return j as TeamCacheFile;
  } catch { /* premier run */ }
  return { teams: {} };
}

function saveTeamCache(cache: TeamCacheFile): void {
  fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2) + "\n", "utf8");
}

function freshAgg(agg: TeamAgg | undefined): TeamAgg | null {
  if (!agg) return null;
  const age = Date.now() - new Date(agg.computed_at).getTime();
  return age < TEAM_STATS_TTL_MS ? agg : null;
}

// ─── Enrichissement par équipe (box-scores + players) ─────────────────────────
type TopPlayer = { name: string; ppg: number | null; rpg: number | null; apg: number | null };

async function boxTeamAgg(teamId: number): Promise<TeamAgg | null> {
  const events = await bsdPaginate(
    `/events/?team=${teamId}&status=finished&limit=${TEAM_STATS_K}`,
    1,
  );
  const ids: number[] = events
    .map((e: BsdEvent) => e.id)
    .filter((id: unknown): id is number => typeof id === "number")
    .slice(0, TEAM_STATS_K);
  if (!ids.length) return null;

  let games = 0, pts = 0, fgm = 0, fga = 0, tpm = 0, tpa = 0, reb = 0, ast = 0, tov = 0;
  for (const id of ids) {
    const box = await bsdJson(`/events/${id}/box-score/`);
    if (!box) continue;
    const isHome = box.home_team && box.home_team.id === teamId;
    const players = isHome ? box.home_box : box.away_box;
    if (!Array.isArray(players) || !players.length) continue;
    games++;
    for (const p of players) {
      pts += Number(p.points) || 0;
      reb += Number(p.rebounds) || 0;
      ast += Number(p.assists) || 0;
      tov += Number(p.turnovers) || 0;
      fgm += Number(p.field_goals_made) || 0;
      fga += Number(p.field_goals_attempted) || 0;
      tpm += Number(p.three_pointers_made) || 0;
      tpa += Number(p.three_pointers_attempted) || 0;
    }
  }
  if (!games) return null;
  const r1 = (n: number) => Math.round(n * 10) / 10;
  return {
    computed_at: new Date().toISOString(),
    games,
    points_per_game: r1(pts / games),
    fg_pct: fga > 0 ? r1((fgm / fga) * 100) : null,
    three_pt_pct: tpa > 0 ? r1((tpm / tpa) * 100) : null,
    rebounds_pg: r1(reb / games),
    assists_pg: r1(ast / games),
    turnovers_pg: r1(tov / games),
  };
}

// Cache des top joueurs par équipe (la liste /players/ n'expose pas season_avg :
// il faut le détail /players/{id}/ — donc cache pour ne pas le refaire à chaque run).
type PlayersCacheFile = { teams: Record<string, { computed_at: string; players: TopPlayer[] }> };

function loadPlayersCache(): PlayersCacheFile {
  try {
    const j = JSON.parse(fs.readFileSync(PLAYERS_CACHE_PATH, "utf8"));
    if (j && typeof j === "object" && j.teams) return j as PlayersCacheFile;
  } catch { /* premier run */ }
  return { teams: {} };
}

function savePlayersCache(cache: PlayersCacheFile): void {
  fs.mkdirSync(path.dirname(PLAYERS_CACHE_PATH), { recursive: true });
  fs.writeFileSync(PLAYERS_CACHE_PATH, JSON.stringify(cache, null, 2) + "\n", "utf8");
}

/** Exécute fn sur items avec au plus `limit` appels concurrents (résultats ordonnés). */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (next < items.length) {
      const idx = next++;
      out[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return out;
}

async function topPlayers(teamId: number, cache: PlayersCacheFile): Promise<TopPlayer[]> {
  const key = String(teamId);
  const hit = cache.teams[key];
  if (hit) {
    const age = Date.now() - new Date(hit.computed_at).getTime();
    if (age < TEAM_STATS_TTL_MS) return hit.players;
  }

  // NB : sur /players/ seul `team=` filtre réellement (spec OpenAPI annonce
  // `team_id` mais l'API l'ignore → renvoie les 2986 joueurs). Garde-fou : on
  // re-filtre côté client sur p.team.id pour ne jamais mélanger les équipes.
  const roster = await bsdPaginate(`/players/?team=${teamId}&limit=200`, 1);
  const ids: number[] = roster
    .filter((p: any) => p?.team?.id === teamId || p?.team == null)
    .map((p: any) => p?.id)
    .filter((id: unknown): id is number => typeof id === "number");

  const details = await mapLimit(ids, 4, (id) => bsdJson(`/players/${id}/`));
  const top = details
    .filter((d): d is any => !!d?.season_avg)
    .filter((d) => Number(d.season_avg.games) >= 1 && d.season_avg.points != null)
    .map((d) => ({
      name: String(d.name),
      ppg: Number(d.season_avg.points),
      rpg: d.season_avg.rebounds ?? null,
      apg: d.season_avg.assists ?? null,
    }))
    .sort((a, b) => (b.ppg ?? -1) - (a.ppg ?? -1))
    .slice(0, 3);

  cache.teams[key] = { computed_at: new Date().toISOString(), players: top };
  savePlayersCache(cache);
  return top;
}

// ─── Assemblage sortie ────────────────────────────────────────────────────────
type OutTeam = {
  name: string;
  bsd_team_id: string | null;
  quarter_scores: number[] | null;
  stats: {
    points_per_game: number | null;
    fg_pct: number | null;
    three_pt_pct: number | null;
    rebounds_pg: number | null;
    assists_pg: number | null;
    turnovers_pg: number | null;
  };
  top_players: TopPlayer[];
};

function emptyStats(): OutTeam["stats"] {
  return {
    points_per_game: null, fg_pct: null, three_pt_pct: null,
    rebounds_pg: null, assists_pg: null, turnovers_pg: null,
  };
}

function quartersOf(detail: BsdEvent, side: "home" | "away"): number[] | null {
  const ps = detail.periods_score;
  if (!ps || typeof ps !== "object") return null;
  const keys = Object.keys(ps)
    .filter((k) => /^period\d+$/.test(k))
    .sort((a, b) => Number(a.slice(6)) - Number(b.slice(6)));
  if (!keys.length) return null;
  const idx = side === "home" ? 0 : 1;
  return keys.map((k) => {
    const pair = ps[k];
    return Array.isArray(pair) ? Number(pair[idx]) : null;
  }).map((v) => (Number.isFinite(v) ? v : null)) as number[] | null;
}

// ─── QA ───────────────────────────────────────────────────────────────────────
function qaLog(payload: any, bsdEvents: BsdEvent[], popupOk: number): void {
  const leagues: any[] = Array.isArray(payload.leagues) ? payload.leagues : [];
  let total = 0;
  let matched = 0;
  let matchedLeagues = 0;
  for (const lg of leagues) {
    const n: number = lg.matches.length;
    const k: number = lg.matches.filter((m: any) => m.bsd_enrichment?.matched).length;
    total += n;
    matched += k;
    if (lg.bsd_league_id !== null) {
      matchedLeagues++;
      const evCount = bsdEvents.filter((e) => String(e.league?.id) === lg.bsd_league_id).length;
      console.log(`[pipe] QA ligue « ${lg.league_name} » (BSD ${lg.bsd_league_id}) : ` +
        `${n} matchs, ${k} enrichis, ${evCount} événements BSD dans la fenêtre`);
      if (evCount > 0 && k === 0) {
        console.warn(`[pipe] QA : ligue appariée avec ${evCount} événements BSD mais 0 enrichi — bug de pairing équipes ?`);
      }
    }
  }
  console.log(`[pipe] QA : ${leagues.length} ligues Vitibet (${matchedLeagues} appariées BSD), ` +
    `${total} matchs, ${matched} enrichis, ${popupOk} pop-ups lus`);
  console.log(`[pipe] QA : sortie ${(JSON.stringify(payload).length / 1024).toFixed(0)} Ko → ${OUT_PATH}`);
  // Couverture globale normalement faible : Vitibet couvre ~14 ligues mondiales,
  // BSD 7 (NBA/WNBA hors saison en octobre) → on n'alerte que sur un bug.
  if (matchedLeagues > 0 && matched === 0 && total > 0) {
    console.warn("[pipe] QA : ligues appariées mais aucun match enrichi — vérifier fenêtres/filtres");
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log(`[pipe] démarrage — date=${DATE_ARG || `J→J+${WINDOW_DAYS - 1}`} limit=${LIMIT || "-"} ` +
    `dryRun=${DRY_RUN} popups=${NO_POPUPS ? "non" : "oui"} teamStats=${NO_TEAM_STATS ? "non" : "oui"}`);
  if (!BSD_KEY) console.warn("[pipe] BSD_API_KEY absente — enrichissement BSD désactivé (sortie Vitibet seule)");

  // 1) Hub Vitibet par date
  const dates = DATE_ARG ? [DATE_ARG] : [0, 1, 2, 3].map(todayPlus);
  const leaguesById = new Map<number, VitibetLeague>();
  const matchesById = new Map<string, VitibetMatch>();
  for (const date of dates) {
    const url = `${VITIBET_BASE}/index.php?clanek=quicktips&sekce=basket&lang=en&date=${date}`;
    const html = await fetchRetry(url, { "User-Agent": VITIBET_UA }, VITIBET_DELAY_MS);
    if (html === null) { console.warn(`[pipe] hub ${date} indisponible — skip`); continue; }
    const { leagues, matches } = parseHub(html);
    for (const l of leagues) leaguesById.set(l.league_id, l);
    for (const m of matches) {
      const key = `${m.fixture_id}/${m.league_id}`;
      const prev = matchesById.get(key);
      // Le listing du jour porte le statut FT de référence ; un tip explicite gagne.
      if (!prev || (prev.index === null && m.index !== null)) matchesById.set(key, m);
    }
    console.log(`[pipe] hub ${date} : ${matches.length} matchs, ${leagues.length} ligues`);
  }
  let vitibetMatches = [...matchesById.values()]
    .sort((a, b) => (a.date_match || "").localeCompare(b.date_match || "") || (a.heure || "").localeCompare(b.heure || ""));
  if (LIMIT > 0) vitibetMatches = vitibetMatches.slice(0, LIMIT);
  if (!vitibetMatches.length) {
    console.log("[pipe] aucun match Vitibet — rien à écrire.");
    return;
  }

  // 2) Pop-ups (H2H + forme + analytics) — 1 req/s
  let popupOk = 0;
  if (!NO_POPUPS) {
    for (let i = 0; i < vitibetMatches.length; i++) {
      const m = vitibetMatches[i];
      const url = `${VITIBET_BASE}/index.php?clanek=basket-match-detail&sekce=basket&lang=en` +
        `&fixture_id=${m.fixture_id}&league_id=${m.league_id}`;
      const html = await fetchRetry(url, { "User-Agent": VITIBET_UA }, VITIBET_DELAY_MS);
      if (html) {
        m.popup = parsePopup(html);
        popupOk++;
      }
      if ((i + 1) % 10 === 0) console.log(`[pipe] pop-ups ${i + 1}/${vitibetMatches.length}`);
    }
  }

  // 3) BSD : ligues + événements de la fenêtre (marge ±1 j pour les fuseaux)
  let bsdLeagues: BsdLeague[] = [];
  let bsdEvents: BsdEvent[] = [];
  if (BSD_KEY) {
    bsdLeagues = (await bsdPaginate("/leagues/?limit=50", 1)) as BsdLeague[];
    const from = dates[0];
    const to = dates[dates.length - 1];
    const minus = new Date(Date.parse(from) - 86_400_000).toISOString().slice(0, 10);
    const plus = new Date(Date.parse(to) + 86_400_000).toISOString().slice(0, 10);
    bsdEvents = await bsdPaginate(`/events/?date_from=${minus}&date_to=${plus}&limit=200`, 4);
    console.log(`[pipe] BSD : ${bsdLeagues.length} ligues, ${bsdEvents.length} événements sur ${minus}→${plus}`);
  }

  // 4) Matching ligue → événements candidates (scoreur strict : égalité ou
  //    couverture de tokens — voir leagueSimilarity, anti faux positifs)
  const LEAGUE_MIN_SCORE = 0.9;
  const leagueMatch = new Map<number, BsdLeague>();
  for (const vl of leaguesById.values()) {
    const stripped = stripLeagueCountry(vl.title);
    let best = matchBest<BsdLeague>(stripped, bsdLeagues, (l) => l.name, {
      minScore: LEAGUE_MIN_SCORE,
      scorer: leagueSimilarity,
    });
    if (!best.entity) {
      best = matchBest<BsdLeague>(vl.title, bsdLeagues, (l) => l.name, {
        minScore: LEAGUE_MIN_SCORE,
        scorer: leagueSimilarity,
      });
    }
    if (best.entity) {
      leagueMatch.set(vl.league_id, best.entity);
      console.log(`[pipe] ligue ✓ « ${vl.title} » → BSD « ${best.entity.name} » (score ${best.score.toFixed(3)})`);
    } else {
      console.log(`[pipe] ligue ✗ « ${vl.title} » (mieux: ${best.ranking.slice(0, 2).map((r) => `${r.entity.name} ${r.score.toFixed(2)}`).join(", ") || "aucun"})`);
    }
  }

  // 5) Matching match → événement (orientation domicile/extérieur + date ±1 j)
  type Pairing = { event: BsdEvent; score: number };
  const pairings = new Map<string, Pairing>();
  const usedEventIds = new Set<number>();
  const candidatesByLeague = new Map<number, BsdEvent[]>();
  for (const m of vitibetMatches) {
    const bl = leagueMatch.get(m.league_id);
    if (!bl) continue;
    let cands = candidatesByLeague.get(bl.id);
    if (!cands) {
      cands = bsdEvents.filter((e) => e.league && e.league.id === bl.id);
      candidatesByLeague.set(bl.id, cands);
    }
    const vDate = m.date_match;
    let best: Pairing | null = null;
    let bestAttempt: { score: number; h: string; a: string } | null = null;
    for (const ev of cands) {
      if (usedEventIds.has(ev.id)) continue;
      const evDate = ev.event_date ? isoToParisDate(ev.event_date) : null;
      if (vDate && evDate) {
        const delta = Math.abs(Date.parse(vDate) - Date.parse(evDate)) / 86_400_000;
        if (delta > 1) continue;
      }
      const hName = ev.home_team?.name || ev.home_team_name || "";
      const aName = ev.away_team?.name || ev.away_team_name || "";
      const hs = Math.max(
        similarity(m.home_name, hName),
        similarity(m.home_name, ev.home_team?.short_name || ""),
      );
      const as = Math.max(
        similarity(m.away_name, aName),
        similarity(m.away_name, ev.away_team?.short_name || ""),
      );
      const score = Math.min(hs, as);
      if (!bestAttempt || score > bestAttempt.score) {
        bestAttempt = { score, h: hName, a: aName };
      }
      if (score >= MIN_MATCH_SCORE && (!best || score > best.score)) best = { event: ev, score };
    }
    if (best) {
      pairings.set(`${m.fixture_id}/${m.league_id}`, best);
      usedEventIds.add(best.event.id);
    } else if (cands.length) {
      console.warn(`[pipe] pairing ✗ fixture ${m.fixture_id} « ${m.home_name} vs ${m.away_name} » — ` +
        `meilleur candidat ${bestAttempt ? bestAttempt.score.toFixed(3) : "n/a"}` +
        (bestAttempt ? ` (« ${bestAttempt.h} vs ${bestAttempt.a} »)` : "") +
        ` sur ${cands.length} événements BSD`);
    }
  }

  // 6) Agrégats d'équipe (box-scores, cache 24 h) + top joueurs, par équipe BSD
  const teamCache = loadTeamCache();
  const playersCache = loadPlayersCache();
  const aggMemo = new Map<number, TeamAgg | null>();
  const playersMemo = new Map<number, TopPlayer[]>();
  async function teamAgg(teamId: number): Promise<TeamAgg | null> {
    const memo = aggMemo.get(teamId);
    if (memo !== undefined) return memo;
    let agg = freshAgg(teamCache.teams[String(teamId)]) ?? null;
    if (!agg && !NO_TEAM_STATS) {
      agg = await boxTeamAgg(teamId);
      if (agg) { teamCache.teams[String(teamId)] = agg; saveTeamCache(teamCache); }
    }
    aggMemo.set(teamId, agg);
    return agg;
  }
  async function teamPlayers(teamId: number): Promise<TopPlayer[]> {
    const memo = playersMemo.get(teamId);
    if (memo) return memo;
    const players = await topPlayers(teamId, playersCache);
    playersMemo.set(teamId, players);
    return players;
  }

  // 7) Assemblage selon le schéma de sortie
  const outLeagues = new Map<number, any>();
  for (const m of vitibetMatches) {
    const vl = leaguesById.get(m.league_id);
    if (!vl) continue;
    let outLeague = outLeagues.get(m.league_id);
    if (!outLeague) {
      outLeague = {
        league_id: String(m.league_id),
        league_name: vl.name,
        country: vl.country,
        vitibet_url: vl.url,
        bsd_league_id: leagueMatch.get(m.league_id) ? String(leagueMatch.get(m.league_id)!.id) : null,
        matches: [],
      };
      outLeagues.set(m.league_id, outLeague);
    }

    const pairing = pairings.get(`${m.fixture_id}/${m.league_id}`);
    const ev = pairing ? pairing.event : null;
    let detail: BsdEvent | null = null;
    if (ev) detail = (await bsdJson(`/events/${ev.id}/`)) as BsdEvent | null;
    const status: string = ev && ev.status ? ev.status : m.status;

    const homeBsdId = ev?.home_team?.id ?? null;
    const awayBsdId = ev?.away_team?.id ?? null;

    const buildTeam = async (
      name: string,
      bsdId: number | null,
      side: "home" | "away",
    ): Promise<OutTeam> => {
      const agg = bsdId ? await teamAgg(bsdId) : null;
      const players = bsdId ? await teamPlayers(bsdId) : [];
      return {
        name,
        bsd_team_id: bsdId !== null ? String(bsdId) : null,
        quarter_scores: detail ? quartersOf(detail, side) : null,
        stats: agg
          ? {
              points_per_game: agg.points_per_game,
              fg_pct: agg.fg_pct,
              three_pt_pct: agg.three_pt_pct,
              rebounds_pg: agg.rebounds_pg,
              assists_pg: agg.assists_pg,
              turnovers_pg: agg.turnovers_pg,
            }
          : emptyStats(),
        top_players: players,
      };
    };
    const homeTeam = await buildTeam(m.home_name, homeBsdId, "home");
    const awayTeam = await buildTeam(m.away_name, awayBsdId, "away");

    // vitibet_data : popup fait foi (INDEX/probas/h2h/forme), listing en repli.
    const popup = m.popup;
    const index = popup?.index ?? m.index;
    const probHome = popup?.prob_home ?? m.prob_home;
    const probAway = popup?.prob_away ?? m.prob_away;
    const probDraw = popup?.prob_draw ?? m.prob_draw;
    const tip = m.tip ?? vitibetTip(probHome, probAway);
    const predicted = m.predicted_home !== null && m.predicted_away !== null
      ? `${m.predicted_home}:${m.predicted_away}`
      : null;

    const prediction = detail?.prediction;
    const bsdEnrichment = {
      matched: ev !== null,
      match_id_bsd: ev ? String(ev.id) : null,
      // Pas d'endpoint lineups côté basket BSD : on retient la composition
      // réelle issue du box-score (matchs terminés) — faute de mieux.
      lineups_available: detail !== null && status === "finished",
      box_score_available: detail !== null,
      elo_home: prediction?.elo_home ?? null,
      elo_away: prediction?.elo_away ?? null,
      prob_home_win: prediction?.prob_home_win ?? null,
      prob_away_win: prediction?.prob_away_win ?? null,
      model_version: prediction?.model_version ?? null,
      match_score: pairing ? Math.round(pairing.score * 1000) / 1000 : null,
    };
    outLeague.matches.push({
      match_id: String(m.fixture_id),
      datetime: (ev?.event_date ? new Date(ev.event_date).toISOString() : null) ??
        (m.date_match && m.heure ? parisLocalToUtcIso(`${m.date_match} ${m.heure}`) : null),
      status,
      home_team: homeTeam,
      away_team: awayTeam,
      vitibet_data: {
        vitisport_index: index,
        predicted_score: predicted,
        probabilities: {
          home: probHome,
          away: probAway,
        },
        probabilities_draw: probDraw, // extension : cellule « X » du hub (peu utile en basket)
        tip,
        h2h: popup?.h2h ?? [],
        form: {
          home: popup?.form_home ?? [],
          away: popup?.form_away ?? [],
        },
        calc_form: {
          home: popup?.calc_form_home ?? null,
          away: popup?.calc_form_away ?? null,
        },
        team_power: {
          home: popup?.team_power_home ?? null,
          away: popup?.team_power_away ?? null,
        },
      },
      bsd_enrichment: bsdEnrichment,
    });
  }

  const payload = {
    scraped_at: new Date().toISOString(),
    sport: "Basketball",
    leagues: [...outLeagues.values()],
  };
  qaLog(payload, bsdEvents, popupOk);

  if (DRY_RUN) {
    console.log(JSON.stringify(payload, null, 1).slice(0, 4000));
    console.log("[pipe] dry-run : aucune écriture.");
    return;
  }
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(payload, null, 2) + "\n", "utf8");
  console.log(`[pipe] écrit : ${OUT_PATH}`);
}

main().catch((err) => {
  console.error("[pipe] ERREUR FATALE :", err);
  process.exit(1);
});
