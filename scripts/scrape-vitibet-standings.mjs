#!/usr/bin/env node
// scripts/scrape-vitibet-standings.mjs
//
// Extrait les CLASSEMENTS d'une page ligue Vitibet et les ecrit au format
// `VitibetStandingRow`, prete pour `buildLeagueFromFixture`.
//
// Nécessaire parce que `scrape-vitibet.js` ne fetch QUE la page tips : son
// en-tete le dit (« pages ligues : classement uniquement, aucun champ du
// schema -> non fetchees »). Or `buildLeagueFromFixture` derive la base de buts
// du classement Overall ; sans lui, une ligue retombe silencieusement sur
// CMP_NEUTRAL_LAMBDA (28.5 / equipe) alors que l'ecart reel entre ligues va de
// 25.6 a 31.8. C'est exactement le genre de faute invisible qu'on refuse.
//
// STRUCTURE MESUREE (2026-10-05, Superlig 120 et Liga NA Women 88) :
//   6 panneaux `div.lh-panel.lh-panel-<vue>` chacun contenant UN `<table>` :
//     lh-panel-total -> Overall   lh-panel-home -> Home     lh-panel-away -> Away
//     lh-panel-form  -> Form 6    lh-panel-p1   -> 1re MT   lh-panel-p2   -> 2e MT
//   Colonnes : c-rank | lh-team(title, img=teamId, lh-name, lh-sub) |
//              c-n P | c-n W | c-n D | c-n L | c-score | c-pts
//   Saison : `span.lh-season`. Forme : badges `i.lh-fb.lh-fb-{w,d,l}`.
//   Les panneaux sont LOCALISES PAR LEUR CLASSE, jamais par leur position : celle
//   -ci a change entre les deux pages (6 panneaux dans le meme ordre, mais on ne
//   s'en fie pas).
//
// USAGE
//   node scripts/scrape-vitibet-standings.mjs
//   node scripts/scrape-vitibet-standings.mjs --dry-run
//   node scripts/scrape-vitibet-standings.mjs --only=120
//
// SORTIE : data/vitibet-league-<id>.json

import https from "node:https";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";

const BASE = "https://www.vitibet.com";
const UA = "PariscoreBot (+https://pariscore.fr)";
const OUT_DIR = "data";

/** Ligues couvertes. `path` est un chemin PUR (conforme robots.txt). */
const LEAGUES = [
  {
    id: 120,
    key: "superlig",
    name: "Superlig",
    url: `${BASE}/handball/tips/superlig/turkey/120/`,
    country: "Turkey",
    gender: "M",
    level: 1,
  },
  {
    id: 88,
    key: "ligaNationalaWomen",
    name: "Liga Nationala Women",
    url: `${BASE}/handball/tips/liga-nationala-women/romania/88/`,
    country: "Romania",
    gender: "F",
    level: 1,
  },
];

/** Vues cherchees -> suffixe de classe du panneau. */
const VIEWS = {
  overall: "lh-panel-total",
  home: "lh-panel-home",
  away: "lh-panel-away",
  form: "lh-panel-form",
  firstHalf: "lh-panel-p1",
  secondHalf: "lh-panel-p2",
};

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const only = args.find((a) => a.startsWith("--only="))?.slice(7);

function fetchHtml(url, redirects = 4) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      { headers: { "User-Agent": UA, "Accept-Language": "en" }, timeout: 30000 },
      (res) => {
        const st = res.statusCode || 0;
        if (st >= 300 && st < 400 && res.headers.location && redirects > 0) {
          res.resume();
          resolve(fetchHtml(new URL(res.headers.location, url).toString(), redirects - 1));
          return;
        }
        if (st !== 200) {
          res.resume();
          reject(new Error(`HTTP ${st}`));
          return;
        }
        let b = "";
        res.setEncoding("utf8");
        res.on("data", (c) => (b += c));
        res.on("end", () => resolve(b));
      },
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
  });
}

function strip(html) {
  return String(html)
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Découpe le HTML en PANneaux, chacun borné par l occurence suivante de
 * n'importe quelle classe `lh-panel-*`.
 *
 * ⚠️ 2026-10-05 — BUG CORRIGE. La premiere version faisait
 * `indexOf(panelClass)` puis `indexOf('<table', start)`. Ca echouait : le nom de
 * panneau apparait d'abord dans la BARRE D ONGLETS (`<label class='lh-k-main'>
 * Home Table`), donc le premier `<table` apres cette occurrence etait celui du
 * PANNEAU OVERALL. Resultat mesure : les trois vues renvoyaient le meme tableau,
 * chaque equipe affichant `Home 6 + Away 6 = 12` pour un `Overall 6`. Les noms
 * d equipes concordaient, les splits etaient faux — et le calcul de Team Power
 * par lieu aurait ete double sans aucun signe visible.
 *
 * Borner chaque panneau par l occurrence suivante evite la collision : le
 * contenu d un panneau lui appartient jusqu au panneau suivant.
 */
const PANEL_RE = /lh-panel-(total|home|away|form|p1|p2)/g;

/** Contenu de chaque panneau, indexe par suffixe de classe. */
function splitPanels(html) {
  const hits = [...html.matchAll(PANEL_RE)].map((m) => ({
    key: m[1],
    index: m.index,
  }));
  const panels = new Map();
  hits.forEach((h, i) => {
    const end = i + 1 < hits.length ? hits[i + 1].index : html.length;
    // Le panneau commence apres TOUTE la balise qui porte la classe : on cherche
    // le `>` de fin plutot que de matcher par prefixe.
    const gt = html.indexOf(">", h.index);
    const start = gt === -1 ? h.index : gt;
    if (!panels.has(h.key) || panels.get(h.key).length < end - start) {
      panels.set(h.key, html.slice(start, end));
    }
  });
  return panels;
}

/** Le `<table>` d'un panneau. */
function tableOfPanel(panels, suffix) {
  const chunk = panels.get(suffix.replace(/^lh-panel-/, ""));
  if (!chunk) return null;
  const open = chunk.indexOf("<table");
  if (open === -1) return null;
  const close = chunk.indexOf("</table>", open);
  if (close === -1) return null;
  return chunk.slice(open, close);
}

/** `<tr>` bruts d'un tableau. */
function rowsOf(table) {
  if (!table) return [];
  return [...table.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((m) => m[0]);
}

/**
 * Une ligne de classement -> VitibetStandingRow, ou null si la ligne est
 * incohérente.
 *
 * Les controles ne sont pas décoratifs, ils sont le seul moyen de distinguer
 * une ligne corrompue d'une ligne absente : on REJETTE plutot que de renvoyer
 * des zéros, sinon l'UI afficherait « 0 buts à domicile » sur une équipe dont on
 * n'a simplement pas la donnée.
 */
function parseRow(tr) {
  const rank = Number(strip((tr.match(/<td class=['"]c-rank['"][^>]*>([\s\S]*?)<\/td>/i) || [])[1]));
  if (!Number.isFinite(rank)) return null;

  const cell = (tr.match(/<td class=['"]lh-team['"][\s\S]*?<\/div><\/td>/i) || [])[0];
  if (!cell) return null;
  const team = strip((cell.match(/<span class=['"]lh-name['"][^>]*>([\s\S]*?)<\/span>/i) || [])[1]);
  if (!team) return null;

  // teamId : le src du logo (`.../handball/teams/1124.png`). Sert a la resolution
  // de logo via l'API Sports — un logo sans id serait un logo invente.
  const img = (cell.match(/<img[^>]+src=['"]([^'"]+)['"]/i) || [])[1] || "";
  const teamId = Number((img.match(/\/handball\/teams\/(\d+)\./i) || [])[1] || 0);

  const nums = [...tr.matchAll(/<td class=['"]c-n['"][^>]*>([\s\S]*?)<\/td>/gi)].map((m) =>
    Number(strip(m[1])),
  );
  if (nums.length < 4 || nums.slice(0, 4).some((n) => !Number.isFinite(n))) return null;

  const [played, wins, draws, losses] = nums;
  // Score GF:GA — le « +79 » qui suit est un DIFFERENTIEL, recalcule en interne
  // et jamais lu comme une donnee.
  const scoreM = (tr.match(/<td class=['"]c-score['"][^>]*>([\s\S]*?)<\/td>/i) || [])[1] || "";
  const sm = strip(scoreM).match(/^(\d{1,3})\s*:\s*(\d{1,3})/);
  const points = Number(
    strip((tr.match(/<td class=['"]c-pts['"][^>]*>([\s\S]*?)<\/td>/i) || [])[1]),
  );

  if (!sm || !Number.isFinite(points)) return null;
  // W + D + L doit valoir P : sinon la ligne est corrompue (et Vitibet laisse
  // passer des lignes a moitie rafraichies quand un match est en cours).
  if (wins + draws + losses !== played) return null;

  return {
    rank,
    team,
    teamId,
    played,
    wins,
    draws,
    losses,
    goalsFor: Number(sm[1]),
    goalsAgainst: Number(sm[2]),
    points,
  };
}

/** Forme « last 6 » depuis les badges i.lh-fb-{w,d,l}. */
function parseFormRow(tr) {
  const badges = [...tr.matchAll(/<i class=['"]lh-fb[^'"]*lh-fb-([wdl])['"]/gi)].map((m) =>
    m[1].toUpperCase(),
  );
  if (badges.length === 0) return null;
  const team = strip((tr.match(/<span class=['"]lh-name['"][^>]*>([\s\S]*?)<\/span>/i) || [])[1]);
  return team ? { team, form: badges.join("").slice(0, 6) } : null;
}

async function scrape(league) {
  const html = await fetchHtml(league.url);
  const season = strip((html.match(/<span class=['"]lh-season['"][^>]*>([\s\S]*?)<\/span>/i) || [])[1]);

  const out = { ...league, season: season || null, scrapedAt: new Date().toISOString() };

  const panels = splitPanels(html);

  for (const [view, suffix] of Object.entries(VIEWS)) {
    const rows = rowsOf(tableOfPanel(panels, suffix))
      .map(view === "form" ? parseFormRow : parseRow)
      .filter(Boolean);
    if (view === "form") {
      // Le panneau Form n'a pas les memes colonnes : on garde une table
      // equipe -> forme, alignee sur celle du Overall.
      const byTeam = new Map(rows.map((r) => [r.team, r.form]));
      out.form = Object.fromEntries(byTeam);
      out.formCount = byTeam.size;
      continue;
    }
    out[`standings${view[0].toUpperCase()}${view.slice(1)}`] = rows;
  }

  // Coherence : les deux moities du terrain doivent avoir le meme nombre de
  // matchs joues (chaque match compte pour une equipe dans chaque split).
  const o = out.standingsOverall || [];
  const h = out.standingsHome || [];
  const a = out.standingsAway || [];
  const sum = (rows, k) => rows.reduce((acc, r) => acc + r[k], 0);
  out.checks = {
    overallTeams: o.length,
    homeTeams: h.length,
    awayTeams: a.length,
    overallPlayed: sum(o, "played"),
    homePlayed: sum(h, "played"),
    awayPlayed: sum(a, "played"),
    splitsAgree: sum(h, "played") === sum(a, "played"),
    perTeamAgree: o.every(
      (r) =>
        (h.find((x) => x.team === r.team)?.played ?? 0) +
          (a.find((x) => x.team === r.team)?.played ?? 0) ===
        r.played,
    ),
    // Base de buts par equipe, derivee comme buildLeagueFromFixture le fera.
    derivedBaseline:
      sum(o, "played") > 0
        ? Math.round((sum(o, "goalsFor") / (sum(o, "played") / 2) / 2) * 10) / 10
        : null,
  };

  return out;
}

mkdirSync(OUT_DIR, { recursive: true });
const targets = only ? LEAGUES.filter((l) => String(l.id) === only) : LEAGUES;
if (targets.length === 0) {
  console.error(`--only inconnu. Ids : ${LEAGUES.map((l) => l.id).join(", ")}`);
  process.exit(1);
}

for (const league of targets) {
  console.log(`\n=== ${league.name} (${league.country}) — league_id ${league.id} ===`);
  let data;
  try {
    data = await scrape(league);
  } catch (e) {
    console.error(`  ECHEC : ${e.message}`);
    process.exitCode = 1;
    continue;
  }
  const c = data.checks;
  console.log(`  saison           : ${data.season ?? "?"}`);
  console.log(`  equipes Overall  : ${c.overallTeams}`);
  console.log(`  equipes Home/Away: ${c.homeTeams} / ${c.awayTeams}`);
  console.log(`  matchs joues     : Overall ${c.overallPlayed} | Home ${c.homePlayed} | Away ${c.awayPlayed}`);
  console.log(`  splits Home=Away : ${c.splitsAgree ? "OK" : "INCOHERENT"}`);
  console.log(`  Home+Away=Overall: ${c.perTeamAgree ? "OK" : "INCOHERENT"}`);
  console.log(`  forme last 6     : ${data.formCount} equipes`);
  console.log(`  base derivee     : ${c.derivedBaseline} buts/equipe`);

  if (c.overallTeams === 0) {
    console.log(`  !! AUCUN CLASSEMENT sur cette page — une base generique serait fausse`);
  }
  if (c.splitsAgree && c.perTeamAgree && c.overallTeams > 0) {
    const top = (data.standingsOverall || [])[0];
    console.log(`  tete : ${top.team} ${top.played}j ${top.points}pts ${top.goalsFor}:${top.goalsAgainst}`);
  }
  const sampleForm = Object.entries(data.form || {}).slice(0, 3);
  if (sampleForm.length) {
    console.log(`  formes echantillon: ${sampleForm.map(([t, f]) => `${t}=${f}`).join("  ")}`);
  }

  if (dryRun) {
    console.log("  (dry-run : rien ecrit)");
    continue;
  }
  const dest = `${OUT_DIR}/vitibet-league-${league.id}.json`;
  writeFileSync(dest, JSON.stringify(data, null, 1));
  console.log(`  ecrit : ${dest}`);
}

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });