#!/usr/bin/env node
// scripts/build-vitibet-league-fixtures.mjs
//
// Assemble le fixture JSON d'une ligue Vitibet a partir de DEUX sources reelles :
//   1. data/vitibet-league-<id>.json  -> classements Overall/Home/Away + forme
//      (produit par scrape-vitibet-standings.mjs)
//   2. la page tips Vitibet, balayee jour par jour -> calendrier des matchs
//
// Le resultat a la forme EXACTE du fixture danois (`_meta` + `leagues[]`), donc
// `buildLeagueFromFixture` le consomme sans modification.
//
// ⚠️ `predictions_available` : Vitibet ne publie PAS de modele predictif sur
// certaines ligues (mesure : Liga Nationala Women, 5 matchs sur 5 sans tip, sans
// index, sans probabilites, sans score predit). Le champ vaut alors false et les
// predictions restent a null. On ne comble JAMAIS avec du calcule : une
// prediction presente sous le nom de Vitibet qui n'en vient pas de Vitibet est
// un mensonge de provenance.
//
// USAGE
//   node scripts/build-vitibet-league-fixtures.mjs
//   node scripts/build-vitibet-league-fixtures.mjs --dry-run
//   node scripts/build-vitibet-league-fixtures.mjs --only=120

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

const OUT_DIR = "src/lib/fixtures";
const TODAY = new Date("2026-10-05T12:00:00Z");
const WINDOW = 10; // J-10 -> J+10, la fenetre mesuree comme suffisante

/** Ligues a assembler. `file` = sortie, `key` = identifiant interne. */
const TARGETS = [
  {
    id: 120,
    key: "superlig",
    file: "superlig-2026.json",
    label: "Superlig (Turquie)",
  },
  {
    id: 88,
    key: "ligaNationalaWomen",
    file: "liga-nationala-women-2026.json",
    label: "Liga Nationala Women (Roumanie)",
  },
];

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const only = args.find((a) => a.startsWith("--only="))?.slice(7);

const iso = (d) => d.toISOString().slice(0, 10);
const shift = (days) => new Date(TODAY.getTime() + days * 86400000);

/**
 * Collecte les matchs d'une ligue sur la fenetre, en interrogeant le scrapeur
 * tips jour par jour (il n'accepte qu'une date).
 *
 * On NE FABRIQUE AUCUN MATCH : une ligue sans donnee donne un tableau vide, et le
 * module aura alors `fixtures: []` — visible, plutot que rempli de-matchs
 * synthetiques (cf. `synthetic` sur les anciens fixtures danois).
 */
function collectFixtures(leagueId, label) {
  const found = new Map();
  for (let d = -WINDOW; d <= WINDOW; d++) {
    const date = iso(shift(d));
    const r = spawnSync(
      "node",
      ["scripts/scrape-vitibet.js", `--only=league/${leagueId}`, `--date=${date}`, "--dry-run"],
      { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
    );
    const body = r.stdout ?? "";
    // Journal par date : sans lui, un run qui rend 0 match est INDISTINGUABLE
    // d'une date reellement vide. C'est ce qui a fait perdre un cycle de debug.
    const spawnNote =
      r.status === 0 ? "" : ` [spawn status=${r.status}${r.error ? ` err=${r.error.code ?? r.error.message}` : ""}]`;
    const listed = (body.match(/: (\d+) matchs/) || [])[1] ?? "?";
    const kept = (body.match(/"league_id":/g) || []).length;
    // Le tableau JSON est encadre par `[\n  {` ... `\n]`.
    //
    // ⚠️ 2026-10-05 — 4e instance de la meme famille de bug (voir
    // scrape-vitibet-standings.mjs et scrape-handball-history.mjs). Une regex
    // `\[\s*\{[\s\S]*\]` est GLOUTONNE : `[\s\S]*` va jusqu'au DERNIER `]` de la
    // sortie, c'est-a-dire celui du libelle `[vitibet] dry-run : ...` qui suit le
    // tableau. Le slice contenait alors le JSON suivi de texte, et le parse
    // echouait sur « Unexpected non-whitespace character after JSON ». Symptome
    // trompeur : 0 match sur les deux ligues alors que la page en contient.
    //
    // On borne donc sur la fermeture REELLE du tableau : un `]` en debut de ligne.
    // `\n]` et non `]`, sinon le meme piege recommence.
    const m = /\[\s*\{[\s\S]*?\n\]/.exec(body);
    if (!m) {
      console.log(`     ${date} : page ${listed} matchs, 0 pour cette ligue${spawnNote}`);
      continue;
    }
    let rows;
    try {
      rows = JSON.parse(m[0]);
    } catch (e) {
      console.log(`     ${date} : JSON illisible (${e.message.slice(0, 60)})`);
      continue;
    }
    let added = 0;
    for (const row of rows) {
      if (row.league_id !== leagueId) continue;
      // Deduplication sur le triplet equipes/date : le meme match peut apparaitre
      // deux fois si la page tips le repete.
      const key = `${row.equipe_dom}|${row.equipe_ext}|${row.date_match}`;
      if (found.has(key)) continue;
      // `statut` : la source marque les matchs termines par un score reel.
      const hasScore = row.score_reel_d != null && row.score_reel_e != null;
      // Une prediction existe si au moins un de ces champs est renseigne :
      // `score_predit_*` sans `tip` reste une prediction (Vitibet peut donner le
      // score sans conseiller de pari).
      const predictionsAvailable =
        row.tip != null ||
        row.index_value != null ||
        row.prob_home != null ||
        row.score_predit_d != null;
      found.set(key, {
        fixtureId: row.fixture_id,
        date: row.date_match,
        time: row.heure,
        home: row.equipe_dom,
        away: row.equipe_ext,
        predictedHome: row.score_predit_d ?? null,
        predictedAway: row.score_predit_e ?? null,
        predictionsAvailable,
        // Tip + probabilites quand la source les publie, sinon null. Jamais de
        // substitution.
        tip: row.tip ?? null,
        indexValue: row.index_value ?? null,
        probHome: row.prob_home ?? null,
        probDraw: row.prob_draw ?? null,
        probAway: row.prob_away ?? null,
        live: row.statut === "live" || row.statut === "1H" || row.statut === "2H",
        // Score REEL quand le match est joue : c'est de l'historique, pas de la
        // prediction, et le champ reste distinct.
        finalHome: row.score_reel_d ?? null,
        finalAway: row.score_reel_e ?? null,
        hasFinalScore: hasScore,
      });
      added++;
    }
    if (added > 0) {
      console.log(`     ${date} : page ${listed} matchs, ${kept} apres filtre, ${added} ajoutes${spawnNote}`);
    }
  }
  return [...found.values()].sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
}

for (const t of TARGETS) {
  if (only && String(t.id) !== only) continue;
  const src = `data/vitibet-league-${t.id}.json`;
  if (!existsSync(src)) {
    console.error(`  !! ${src} absent — lancer d'abord scrape-vitibet-standings.mjs --only=${t.id}`);
    process.exitCode = 1;
    continue;
  }
  const standings = JSON.parse(readFileSync(src, "utf8"));

  console.log(`\n=== ${t.label} — league_id ${t.id} ===`);
  console.log(`  classements : ${standings.standingsOverall.length} équipes (Overall/Home/Away)`);
  console.log(`  forme : ${standings.formCount} équipes`);
  console.log(`  base derivee : ${standings.checks.derivedBaseline} buts/équipe`);
  if (!standings.checks.splitsAgree || !standings.checks.perTeamAgree) {
    console.error("  !! splits incoherents — fixture REFUSEe (base derivee serait fausse)");
    process.exitCode = 1;
    continue;
  }

  const fixtures = collectFixtures(t.id);
  const withPred = fixtures.filter((f) => f.predictionsAvailable);
  console.log(`  matchs collectes : ${fixtures.length}`);
  console.log(`  avec prediction  : ${withPred.length}`);
  console.log(`  sans prediction  : ${fixtures.length - withPred.length}`);

  const fixture = {
    _meta: {
      scrapedAt: new Date().toISOString(),
      source: "vitibet",
      standingsSource: "page ligue Vitibet (panneaux lh-panel-total/home/away)",
      tipsSource: `page tips, fenetre J-${WINDOW} -> J+${WINDOW}`,
      leagueId: t.id,
      // Les deux faits qui conditionnent l'usage de ce fixture, ecrits dans le
      // fichier plutot que dans un commentaire que personne ne lira.
      predictionsAvailable: withPred.length > 0,
      note:
        withPred.length === 0
          ? "Vitibet ne publie AUCUNE prediction sur cette ligue : tip, index et probabilites sont nuls par construction. Les fixtures restent valables (calendrier + resultats), mais aucun pari ne peut s'appuyer sur un modele."
          : fixtures.length - withPred.length > 0
            ? `${fixtures.length - withPred.length} matchs sur ${fixtures.length} n'ont pas de prediction (absente de la source sur ces rencontres).`
            : "Prediction Vitibet presente sur tous les matchs collectes.",
    },
    leagues: [
      {
        key: t.key,
        vitibetLeagueId: standings.id,
        name: standings.name,
        url: standings.url,
        country: standings.country,
        gender: standings.gender,
        level: standings.level,
        fixtures,
        standingsOverall: standings.standingsOverall,
        standingsHome: standings.standingsHome,
        standingsAway: standings.standingsAway,
        form: standings.form,
      },
    ],
  };

  if (dryRun) {
    console.log("  (dry-run : rien ecrit)");
    continue;
  }
  const dest = `${OUT_DIR}/${t.file}`;
  writeFileSync(dest, JSON.stringify(fixture, null, 1));
  console.log(`  ecrit : ${dest}`);
}