#!/usr/bin/env bun
/**
 * fetch-basketball-bsd.ts — pré-charge le cache 1xBet BSD Basketball.
 *
 * ÉCRIT `data/basketball_bsd_cache.json`, seulread par
 * `src/app/api/basketball/bsd/route.ts`. La route ne contacte JAMAIS BSD : ce
 * script est le SEUL point de sortie réseau, donc le seul à détenir le quota.
 *
 * Usage :
 *   bun run scripts/fetch-basketball-bsd.ts                # aujourd'hui + 7 j
 *   bun run scripts/fetch-basketball-bsd.ts --days=14      # fenêtre élargie
 *   bun run scripts/fetch-basketball-bsd.ts --leagues=6,2  # sous-ensemble
 *   bun run scripts/fetch-basketball-bsd.ts --no-odds      # skip les cotes
 *   bun run scripts/fetch-basketball-bsd.ts --dry-run      # n'écrit rien
 *
 * ⚠️ POLITESSE : 1 requête / seconde, logos compris. Le backend est un Django
 * partagé (confirmé par OSINT : DRF + Cloudflare) et les images passent par un
 * proxy à cache 30 j. On ne martèle rien.
 */

import fs from "node:fs";
import path from "node:path";

import {
  getBasketballEvents,
  getBasketballOdds,
  getBasketballPredictions,
  getBasketballPregame,
  probeBasketballImage,
  sanitizeBasketballPrediction,
} from "../src/lib/api/bzzoiro-client";
import { devigTwoWay, type BsdCache, type CachedOdds } from "../src/lib/basketball-bsd-cache";

// .env chargé à la main (bun ne lit pas .env dans un script arbitraire)
const envPath = path.join(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  for (const raw of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = raw.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.+?)\s*$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

const arg = (name: string, fallback: string | null = null): string | null => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const flag = (name: string) => process.argv.includes(`--${name}`);

const DAYS = Number(arg("days", "7"));
const LEAGUES = arg("leagues")?.split(",").map(Number).filter(Number.isFinite) ?? null;
const WITH_ODDS = !flag("no-odds");
const DRY = flag("dry-run");
const OUT_FILE = path.join(process.cwd(), "data", "basketball_bsd_cache.json");
const STALE_AFTER_MIN = 30;

if (!process.env.BSD_API_KEY) {
  console.error("BSD_API_KEY absent — rien à écrire.");
  process.exit(1);
}

/** 1 req/s : le backend est un Django partagé, on ne le martèle pas. */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

async function main() {
  const dateFrom = new Date().toISOString().slice(0, 10);
  const dateTo = new Date(Date.now() + DAYS * 86_400_000).toISOString().slice(0, 10);

  console.log(`fenêtre ${dateFrom} → ${dateTo}${LEAGUES ? ` · ligues ${LEAGUES}` : ""}`);
  // Sans ce try/catch, un échec réseau ici terminait le process en exception :
  // aucun fichier n'était écrit, l'ancien cache restait (bon) mais RIEN ne
  // signalait l'échec au cron. On échoue explicitement, avec une trace, et on
  // garde l'ancien cache intact — jamais d'écriture partielle.
  let listing: Awaited<ReturnType<typeof getBasketballEvents>>;
  try {
    listing = await getBasketballEvents({
      date_from: dateFrom,
      date_to: dateTo,
      limit: 200,
    });
  } catch (err) {
    console.error(`[FATAL] liste des matchs impossible : ${(err as Error).message}`);
    console.error("[FATAL] ancien cache conservé, rien n'est écrit.");
    process.exitCode = 1;
    return;
  }
  let events = listing.results;
  if (LEAGUES) events = events.filter((e) => LEAGUES.includes(e.league.id));
  console.log(`${listing.count} matchs dans la fenêtre, ${events.length} retenus`);

  // Prédiction : UN appel par ligue (le listing /events/ ne porte pas le
  // champ). Construit un index event_id → prédiction.
  const predsById = new Map<number, Awaited<ReturnType<typeof sanitizeBasketballPrediction>>>();
  const leaguesInView = [...new Set(events.map((e) => e.league.id))];
  for (const lg of leaguesInView) {
    await sleep(1000);
    try {
      const preds = await getBasketballPredictions({ league: lg, days: DAYS, limit: 200 });
      for (const row of preds.results) {
        predsById.set(row.event_id, sanitizeBasketballPrediction(row));
      }
      console.log(`prédiction ligue ${lg} : ${preds.count} lignes, index ${predsById.size}`);
    } catch (e) {
      console.warn(`prédiction ligue ${lg} échouée : ${(e as Error).message}`);
    }
  }

  const fixtures: BsdCache["fixtures"] = [];
  let sansPre = 0;
  let sansOdds = 0;

  for (const ev of events) {
    await sleep(1000);

    // ── pregame ──
    let pregame: Awaited<ReturnType<typeof getBasketballPregame>> | null = null;
    try {
      pregame = await getBasketballPregame(ev.id);
    } catch {
      sansPre++;
    }

    // ── odds ──
    let odds: CachedOdds[] = [];
    if (WITH_ODDS) {
      await sleep(1000);
      const raw = await getBasketballOdds(ev.id);
      if (!raw || !Array.isArray(raw.bookmakers)) {
        sansOdds++;
      } else {
        odds = raw.bookmakers
          .map((b) => {
            const oh = num(b.odds_home);
            const oa = num(b.odds_away);
            const devig = oh !== null && oa !== null ? devigTwoWay(oh, oa) : null;
            return {
              bookmaker: b.bookmaker ?? "?",
              slug: b.bookmaker_slug ?? "?",
              oddsHome: oh,
              oddsAway: oa,
              fairHome: devig ? Number(devig.fairHome.toFixed(4)) : null,
              fairAway: devig ? Number(devig.fairAway.toFixed(4)) : null,
              vigPct: devig ? Number(devig.vigPct.toFixed(2)) : null,
              updatedAt: b.updated_at ?? null,
            } satisfies CachedOdds;
          })
          .filter((o) => o.oddsHome !== null && o.oddsAway !== null);
      }
    }

    // ── logos ── sans auth, 204 = absent. Une tête par équipe seulement :
    // le blason de ligue n'est pas encore consommé par l'UI, donc on n'en fait
    // pas la requête (le quota cron est le nôtre).
    const [logoHome, logoAway] = await Promise.all([
      probeBasketballImage("team", ev.home_team?.id),
      probeBasketballImage("team", ev.away_team?.id),
    ]);

    fixtures.push({
      bsdEventId: ev.id,
      leagueBsdId: ev.league.id,
      leagueName: ev.league.name,
      scheduledAt: ev.event_date,
      status: ev.status,
      homeScore: ev.home_score ?? null,
      awayScore: ev.away_score ?? null,
      home: {
        bsdId: ev.home_team?.id ?? 0,
        name: ev.home_team?.name ?? "?",
        shortName: ev.home_team?.short_name || ev.home_team?.name || "?",
        countryCode: ev.home_team?.country_code ?? "",
        logo: {
          url: logoHome.status === "available" ? logoHome.url : null,
          available: logoHome.status === "available",
        },
      },
      away: {
        bsdId: ev.away_team?.id ?? 0,
        name: ev.away_team?.name ?? "?",
        shortName: ev.away_team?.short_name || ev.away_team?.name || "?",
        countryCode: ev.away_team?.country_code ?? "",
        logo: {
          url: logoAway.status === "available" ? logoAway.url : null,
          available: logoAway.status === "available",
        },
      },
      // ⚠️ FILTRE : prob_over_205/215/225 écartés ici, une fois pour toutes.
      prediction: predsById.get(ev.id) ?? null,
      predictionSource: predsById.has(ev.id) ? "bsd" : null,
      pregame: pregame
        ? {
            homeStanding: pregame.home_standing ?? null,
            awayStanding: pregame.away_standing ?? null,
            last10ScoredHome: streakValue(pregame, "Scored points average (Last 10)", "home"),
            last10ScoredAway: streakValue(pregame, "Scored points average (Last 10)", "away"),
            last10TotalHome: streakValue(pregame, "Game points average (Last 10)", "home"),
            last10TotalAway: streakValue(pregame, "Game points average (Last 10)", "away"),
            venue: pregame.venue ?? null,
            homeCoach: pregame.home_coach?.name ?? null,
            awayCoach: pregame.away_coach?.name ?? null,
          }
        : null,
      odds,
      oddsSource: odds.length > 0 ? "bsd" : null,
    });

    process.stdout.write(
      `. ${fixtures.length}/${events.length} ${ev.home_team?.short_name || ev.home_team?.name} vs ${ev.away_team?.short_name || ev.away_team?.name}\n`,
    );
  }

  const cache: BsdCache = {
    fetchedAt: new Date().toISOString(),
    staleAfterMinutes: STALE_AFTER_MIN,
    fixtures,
  };

  console.log("");
  console.log(`sans pregame : ${sansPre} · sans cotes : ${sansOdds}`);
  console.log(
    `logos dispo : ${fixtures.filter((f) => f.home.logo.available).length}/${fixtures.length} dom, ` +
      `${fixtures.filter((f) => f.away.logo.available).length}/${fixtures.length} ext`,
  );
  console.log(
    `prédictions (filtrées) : ${fixtures.filter((f) => f.prediction).length}/${fixtures.length}`,
  );

  if (DRY) {
    console.log("--dry-run : rien n'est écrit.");
    return;
  }

  // ⚠️ Écriture ATOMIQUE : temp + rename.
  //
  // `writeFileSync` direct réécrit le fichier à plat. La route lit ce même
  // fichier en cours de route : elle peut donc intercepter un JSON TRONQUÉ,
  // échouer sur `JSON.parse` et répondre 503 — un « cache absent » fantôme
  // pendant la fraction de seconde de l'écriture. `rename` est atomique au
  // sein d'un même système de fichiers : le lecteur voit l'ancien OU le
  // nouveau fichier, jamais un à moitié écrit.
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  const tmp = `${OUT_FILE}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(cache, null, 1), "utf8");
  fs.renameSync(tmp, OUT_FILE);
  console.log(`écrit ${OUT_FILE} (atomique, ${cache.fixtures.length} fixtures)`);
}

/**
 * Lit une série de BSD : `[{name, team: "home"|"away", value: "77"}]`.
 * Les valeurs sont des STRING (`"77"`), pas des nombres — `num` les convertit
 * et rend `null` si ce n'est pas convertible, jamais 0.
 */
function streakValue(
  pregame: { streaks?: { general?: Array<{ name: string; team: string; value: string }> } },
  name: string,
  team: "home" | "away",
): number | null {
  const hit = pregame.streaks?.general?.find((s) => s.name === name && s.team === team);
  return hit ? num(Number(hit.value)) : null;
}

await main();
