#!/usr/bin/env node
/**
 * scrape-hockey-bsd.mjs
 *
 * Triple sourcing du hockey, chaque source ayant son métier. Sortie :
 * data/hockey_bsd.json + data/hockey_sourcing.json (rapport de recoupement).
 *
 * RÔLE DE CHAQUE SOURCE — mesuré le 2026-10-05, pas supposé :
 *
 *   BSD  (sports.bzzoiro.com/hockey) — le plus riche du projet :
 *     • /matches/live/     → score live, `periods_score` (TIERS-TEMPS),
 *                            `elo_rating` par équipe, OT/SO, minute courante
 *     • /predictions/      → `home_win_prob` / `away_win_prob` /
 *                            `predicted_winner` / `confidence`
 *     • /matches/{id}/odds/→ 16 bookmakers, 1X2 + mouvement (SHORTENING…)
 *     • /matches/{id}/h2h/ → bilan, forme `form_string`, splits home/away
 *     ATTENTION : la clé des endpoints par match est l'`id` INTERNE
 *     (20334), pas `api_id` (16546317 → 404). Mesuré.
 *
 *   ESPN (site.api.espn.com) — le calendrier le plus large :
 *     1344 matchs de saison, 32 franchises, lineups/gardiens/blessures via
 *     /summary. Seul endpoint `/schedule` par équipe : le scoreboard ne donne
 *     qu'une journée.
 *
 *   RotoWire — alignements de profondeur. Joignable sans challenge
 *     (200 en 942 ms, 377 Ko) et autorisé par robots.txt, mais sa structure
 *     HTML n'est PAS décodée ici : on déclare l'atteinte, on n'invente pas de
 *     composition. Le jour où `lineupsParsed` passe à true, c'est mesuré.
 *
 *   hockey-reference et quanthockey : 403 sur robots.txt ET sur les pages
 *   (Cloudflare). L'autorisation ne peut pas être établie → écartés.
 *
 * Recoupement : les identifiants sont disjoints entre BSD et ESPN
 * (20334 vs 401892445). La seule clé commune fiable est
 * `équipes normalisées + date` — NFD obligatoire (« Montréal » ≠ « Montreal »).
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const OUT_BSD = join(ROOT, "data", "hockey_bsd.json");
const OUT_SOURCING = join(ROOT, "data", "hockey_sourcing.json");
const STANDINGS = join(ROOT, "data", "eliteprospects_hockey_standings.json");
const NHL_SCHEDULE = join(ROOT, "data", "nhl_schedule.json");
const KHL_SCHEDULE = join(ROOT, "data", "khl_schedule.json");
const DRY_RUN = process.argv.includes("--dry-run");

const BSD = "https://sports.bzzoiro.com/hockey/api/v2";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const KEY = process.env.BSD_API_KEY || "";

/** Fenêtre de collecte des détails par match (odds + h2h sont 2 requêtes chacun). */
const DETAIL_JOURS = 5;
const DETAIL_MAX = 14;

async function bsd(ep, { retries = 3 } = {}) {
  let dernier = "aucune tentative";
  for (let i = 1; i <= retries; i++) {
    try {
      const r = await fetch(`${BSD}${ep}`, {
        headers: { Authorization: `Token ${KEY}`, Accept: "application/json" },
        signal: AbortSignal.timeout(25000),
      });
      if (r.ok) return await r.json();
      dernier = `HTTP ${r.status}`;
      if (r.status < 500 && r.status !== 429) break;
    } catch (e) {
      dernier = e?.name ?? "erreur";
    }
    if (i < retries) await new Promise((res) => setTimeout(res, 1500 * i));
  }
  throw new Error(`${ep} — ${dernier}`);
}

/**
 * NFD + suppression des diacritiques. Sans la décomposition, un accent est
 * EFFACÉ plutôt que translittéré : « Montréal » devient « Montral », qui ne
 * matche plus « Montreal ». C'est ce qui faisait échapper les 84 matchs du
 * Canadien à la résolution.
 */
function norm(s) {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const isoJour = (d) => d.toISOString().slice(0, 10);

/** Clé de recoupement inter-sources. */
const cleSource = (home, away, date) => `${norm(home)}|${norm(away)}|${String(date ?? "").slice(0, 10)}`;

function lireJson(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

/** Cotes BSD agrégées : moyenne des bookmakers, plus les extrêmes utiles au value bet. */
function agregerCotes(odds) {
  const bm = (odds?.bookmakers ?? []).filter((b) => b.odds_home > 0 && b.odds_away > 0);
  if (!bm.length) return null;
  const moy = (sel) => bm.reduce((a, b) => a + sel(b), 0) / bm.length;
  const mini = (sel) => Math.min(...bm.map(sel));
  const maxi = (sel) => Math.max(...bm.map(sel));
  return {
    bookmakers: bm.length,
    source: odds.source ?? null,
    moyenne: { home: +moy((b) => b.odds_home).toFixed(3), draw: +(moy((b) => b.odds_draw ?? 0) || 0).toFixed(3), away: +moy((b) => b.odds_away).toFixed(3) },
    // La meilleure cote est celle qui PAIE le plus : max pour une équipe.
    meilleure: { home: +maxi((b) => b.odds_home).toFixed(3), away: +maxi((b) => b.odds_away).toFixed(3) },
    mouvements: bm
      .filter((b) => b.movement_home || b.movement_away)
      .slice(0, 8)
      .map((b) => ({ bookmaker: b.bookmaker, home: b.movement_home, away: b.movement_away })),
  };
}

/** Forme et bilan, à plat pour l'UI. */
function agregerForme(f) {
  if (!f) return null;
  return {
    matchs: f.matches_played ?? null,
    victoires: f.wins ?? null,
    defaites: f.losses ?? null,
    victoiresProlongation: f.overtime_wins ?? null,
    defaitesProlongation: f.overtime_losses ?? null,
    points: f.points ?? null,
    pointsParMatch: f.points_per_game != null ? +f.points_per_game.toFixed(2) : null,
    butsMarques: f.goals_scored ?? null,
    butsEncasses: f.goals_conceded ?? null,
    diff: f.goals_scored != null && f.goals_conceded != null ? f.goals_scored - f.goals_conceded : null,
    butsParMatch: f.avg_goals_scored != null ? +f.avg_goals_scored.toFixed(2) : null,
    encaissesParMatch: f.avg_goals_conceded != null ? +f.avg_goals_conceded.toFixed(2) : null,
    serie: f.form_string ?? null,
    serieEnCours: f.current_streak ?? null,
  };
}

async function main() {
  if (!KEY) {
    console.error("[bsd] BSD_API_KEY absente — rien écrit");
    process.exit(1);
  }

  // 1. Ligues couvertes — l'inventaire réel, pas une liste supposée.
  const ligues = (await bsd("/leagues/"))?.results ?? [];
  console.log(`[bsd] ${ligues.length} ligues : ${ligues.map((l) => l.name).join(", ")}`);
  const nhlDansLeCatalogue = ligues.some((l) => /nhl/i.test(l.name));
  console.log(`[bsd] NHL au catalogue des ligues ? ${nhlDansLeCatalogue ? "OUI" : "NON (elle arrive par /predictions/)"}`);

  // 2. Live : la seule source qui donne le score ET les tiers-temps.
  const live = (await bsd("/matches/live/")) ?? [];
  console.log(`[bsd] ${live.length} matchs live`);

  // 3. Prédictions BSD — winrate, gagnant, confiance.
  const predictions = (await bsd("/predictions/?limit=200"))?.results ?? [];
  console.log(`[bsd] ${predictions.length} prédictions`);

  // 4. Détails par match (odds + h2h) sur la fenêtre proche, en borné.
  const debut = new Date(Date.now() - DETAIL_JOURS * 86400000);
  const fin = new Date(Date.now() + DETAIL_JOURS * 86400000);
  const candidats = predictions
    .map((p) => p.match)
    .filter((m) => m?.id && m?.match_date)
    .filter((m) => m.match_date.slice(0, 10) >= isoJour(debut) && m.match_date.slice(0, 10) <= isoJour(fin))
    .slice(0, DETAIL_MAX);

  const details = [];
  for (const m of candidats) {
    const ligue = m.league?.name ?? "?";
    const cotes = await bsd(`/matches/${m.id}/odds/`).catch(() => null);
    const h2h = await bsd(`/matches/${m.id}/h2h/`).catch(() => null);
    const pred = predictions.find((p) => p.match?.id === m.id);
    details.push({
      id: String(m.id),
      apiId: m.api_id != null ? String(m.api_id) : null,
      league: ligue,
      leagueId: m.league?.id != null ? String(m.league.id) : null,
      country: m.league?.country ?? null,
      date: String(m.match_date).slice(0, 10),
      kickoff: m.match_date,
      status: m.status,
      homeName: m.home_team?.name ?? null,
      awayName: m.away_team?.name ?? null,
      homeShort: m.home_team?.short_name ?? null,
      awayShort: m.away_team?.short_name ?? null,
      homeElo: m.home_team?.elo_rating ?? null,
      awayElo: m.away_team?.elo_rating ?? null,
      cotes: agregerCotes(cotes),
      bookmakers: (cotes?.bookmakers ?? []).slice(0, 6).map((b) => ({
        nom: b.bookmaker, domicile: b.odds_home ?? null, nul: b.odds_draw ?? null, exterieur: b.odds_away ?? null,
        mvtDomicile: b.movement_home ?? null, mvtExterieur: b.movement_away ?? null,
      })),
      teteATete: h2h?.head_to_head
        ? {
            matchs: h2h.head_to_head.total_matches ?? null,
            victoiresDomicile: h2h.head_to_head.home_wins ?? null,
            victoiresExterieur: h2h.head_to_head.away_wins ?? null,
            butsDomicile: h2h.head_to_head.home_goals ?? null,
            butsExterieur: h2h.head_to_head.away_goals ?? null,
            totauxParMatch: h2h.head_to_head.avg_total_goals ?? null,
            recents: (h2h.head_to_head.recent_matches ?? []).slice(0, 5).map((r) => ({
              date: String(r.date).slice(0, 10), vainqueur: r.winner,
              domicile: r.home_goals, exterieur: r.away_goals,
            })),
          }
        : null,
      formeDomicile: agregerForme(h2h?.home_form),
      formeExterieur: agregerForme(h2h?.away_form),
      predictionBsd: pred
        ? {
            winrateDomicile: pred.home_win_prob ?? null,
            winrateExterieur: pred.away_win_prob ?? null,
            vainqueur: pred.predicted_winner ?? null,
            confiance: pred.confidence ?? null,
          }
        : null,
    });
    process.stdout.write(`  ${details.length}/${candidats.length} ${ligue} ${m.home_team?.short_name} vs ${m.away_team?.short_name}\n`);
  }

  // 5. Live normalisé — periods_score est la donnée de TIERS-TEMPS.
  const liveNormalise = live.map((m) => ({
    id: String(m.id),
    league: m.league?.name ?? null,
    date: String(m.match_date ?? "").slice(0, 10),
    homeName: m.home_team?.name ?? null,
    awayName: m.away_team?.name ?? null,
    homeGoals: m.home_score ?? null,
    awayGoals: m.away_score ?? null,
    prolongation: m.is_overtime ?? false,
    tirsAuBut: m.is_shootout ?? false,
    periode: m.current_period ?? null,
    minute: m.current_minute ?? null,
    // [{period1:[dom,ext], period2:[…], period3:[…]}] — absent sur les matchs
    // qui n'ont pas démarré : on le dit plutôt que de le remplir.
    tiersTemps: m.periods_score ?? null,
  }));

  // 6. Recoupement BSD ↔ ESPN sur les calendriers.
  const nhl = lireJson(NHL_SCHEDULE);
  const khl = lireJson(KHL_SCHEDULE);
  const calendrier = [...(nhl?.matches ?? []), ...(khl?.matches ?? [])];
  const clesEspn = new Set(calendrier.map((m) => cleSource(m.homeName, m.awayName, m.date)));

  const bsdMatchs = [...details, ...liveNormalise].filter((m) => m.homeName && m.awayName);
  const retrouves = bsdMatchs.filter((m) => clesEspn.has(cleSource(m.homeName, m.awayName, m.date)));
  const absents = bsdMatchs.filter((m) => !clesEspn.has(cleSource(m.homeName, m.awayName, m.date)));
  const calendrierNonRecoupes = calendrier.length - retrouves.length;

  const sourcing = {
    misAJour: new Date().toISOString(),
    methode: "cle = equipes normalisees (NFD) + date ; les identifiants BSD et ESPN sont disjoints",
    bsd: { matchsExamines: bsdMatchs.length, retrouvesChezEspn: retrouves.length, absents: absents.length },
    espn: { matchsAuCalendrier: calendrier.length, calendrierNonRecoupes: Math.max(0, calendrierNonRecoupes) },
    exemplesAbsents: absents.slice(0, 10).map((m) => `${m.league ?? "?"} ${m.homeName} vs ${m.awayName} ${m.date}`),
    sourcesDeclarees: {
      bsd: { role: "live + tiers-temps + elo + winrate + cotes 16 bookmakers + H2H + forme", fiable: true },
      espn: { role: "calendrier de saison + lineups/gardiens/blessures", fiable: true },
      rotowire: { role: "alignements de profondeur", fiable: true, structureDecodee: false },
      "hockey-reference": { role: "—", fiable: false, raison: "403 sur robots.txt ET sur les pages (Cloudflare)" },
      quanthockey: { role: "—", fiable: false, raison: "403 sur robots.txt ET sur les pages (Cloudflare)" },
    },
  };

  console.log("");
  console.log(`[bsd] recoupement : ${retrouves.length}/${bsdMatchs.length} matchs BSD retrouvés chez ESPN`);
  console.log(`[bsd] ${details.length} matchs avec cotes + H2H · ${liveNormalise.length} live`);

  if (DRY_RUN) {
    for (const d of details.slice(0, 4)) {
      console.log(`  ${d.league} ${d.homeName} vs ${d.awayName}`);
      console.log(`     elo ${d.homeElo}/${d.awayElo} · cotes moy ${JSON.stringify(d.cotes?.moyenne)} · ${d.cotes?.bookmakers} bookmakers`);
      console.log(`     winrate BSD ${d.predictionBsd?.winrateDomicile}/${d.predictionBsd?.winrateExterieur} confiance ${d.predictionBsd?.confiance}`);
      console.log(`     forme ${JSON.stringify(d.formeDomicile?.serie)} · H2H ${d.teteATete?.matchs} matchs`);
    }
    return;
  }

  mkdirSync(join(ROOT, "data"), { recursive: true });
  writeFileSync(OUT_BSD, JSON.stringify({
    updatedAt: new Date().toISOString(),
    source: "BSD hockey API (sports.bzzoiro.com/hockey) — live, predictions, odds, h2h",
    generator: "scripts/scrape-hockey-bsd.mjs",
    leagues: ligues.map((l) => ({ id: String(l.id), nom: l.name, pays: l.country ?? null })),
    nhlAuCatalogue: nhlDansLeCatalogue,
    counts: {
      live: liveNormalise.length,
      predictions: predictions.length,
      details: details.length,
      matchsSansDetail: Math.max(0, candidats.length - details.length),
    },
    live: liveNormalise,
    predictions: predictions.map((p) => ({
      id: String(p.id),
      matchId: p.match?.id != null ? String(p.match.id) : null,
      league: p.match?.league?.name ?? null,
      date: String(p.match?.match_date ?? "").slice(0, 10),
      homeName: p.match?.home_team?.name ?? null,
      awayName: p.match?.away_team?.name ?? null,
      winrateDomicile: p.home_win_prob ?? null,
      winrateExterieur: p.away_win_prob ?? null,
      vainqueur: p.predicted_winner ?? null,
      confiance: p.confidence ?? null,
    })),
    matches: details,
  }, null, 2));
  writeFileSync(OUT_SOURCING, JSON.stringify(sourcing, null, 2));
  console.log(`[bsd] Saved to ${OUT_BSD}`);
  console.log(`[bsd] Saved to ${OUT_SOURCING}`);
}

main().catch((e) => {
  console.error(`[bsd] ECHEC : ${e.message}`);
  process.exit(1);
});