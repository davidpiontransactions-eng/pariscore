#!/usr/bin/env node
/**
 * scrape-khl-schedule.mjs
 *
 * Calendrier KHL complet depuis HockeyTech `view=schedule` → data/khl_schedule.json
 *
 * Source mesurée le 2026-10-05 : `schedule season_id=407` répond en **700 ms**
 * avec **748 matchs**, 748/748 datés et 748/748 scorés. C'est la seule vue
 * fixtures exploitable : `scorebar` est **0/6** (tronqué par le proxy) et
 * `gamesperday`/`gamesbydate` répondent HTTP 500.
 *
 * Le fichier produit est indépendant de la fenêtre d'affichage : il porte la
 * saison entière, et le filtrage J-10/J+10 se fait à la lecture. Un cron
 * quotidien suffit donc.
 *
 * Noms d'équipes :首选 le libellé EliteProspects quand le classement est
 * présent, parce que c'est lui que consomme l'appariement de
 * `/api/hockey/prediction` (5 caractères minimum, cf. `findTeamStats`). À
 * défaut, on garde le libellé HockeyTech et le match est marqué sans
 * prédiction — jamais de nom deviné.
 *
 * Usage :
 *   node scripts/scrape-khl-schedule.mjs [--dry-run]
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { currentSeason, feed, vue } from "./lib/hockeytech.mjs";

// scripts/ → racine du dépôt. `scripts/lib/…` serait à deux niveaux, mais ce
// fichier est au premier : un `../..` pointait HORS du dépôt et le classement
// était donc lu comme absent (mesuré : « classement réel : ABSENT »).
const ROOT = join(import.meta.dirname, "..");
const OUT = join(ROOT, "data", "khl_schedule.json");
const STANDINGS = join(ROOT, "data", "eliteprospects_hockey_standings.json");
const DRY_RUN = process.argv.includes("--dry-run");
const KEY = "khl";

/** Renseigné par `main` avant `buildTeamDirectory` (une seule résolution). */
let SEASON_ID = null;

/**
 * Table code HockeyTech → nom EliteProspects, résolue UNE FOIS au démarrage.
 *
 * Le libellé affiché par l'onglet vient du classement EliteProspects, donc
 * c'est la seule source qui ne divergera pas de l'UI. Les noms HockeyTech
 * seuls (« Metallurg Mg », « SKA ») sont trop courts ou trop différents pour
 * l'appariement à 5 caractères de `findTeamStats`.
 *
 * Règle mesurée sur les 22 clubs : plus long fragment commun ≥ 4 caractères,
 * exigence d'unicité. Résultat : **21/22 résolus, 0 ambigu, 0 doublon**.
 * `SKA` échoue parce que son fragment commun fait exactement 3 caractères
 * (« ska » dans « skastpetersburg ») — sous le seuil, donc traité par
 * override explicite plutôt qu'en abaissant le seuil global : un
 * appariement à 3 caractères sur une chaîne qui touche l'argent serait
 * fragile pour un gain d'une seule ligne.
 */
const OVERRIDES = {
  // Fragment commun de 3 caractères seulement — mesuré, pas deviné.
  SKA: "SKA St. Petersburg",
};

/** Plus long fragment commun entre deux chaînes normalisées (longueur mini 3). */
function longestCommonFragment(a, b) {
  const fragments = new Set();
  for (let i = 0; i < a.length; i++) {
    for (let j = i + 3; j <= a.length; j++) fragments.add(a.slice(i, j));
  }
  let best = 0;
  for (const frag of fragments) if (frag.length > best && b.includes(frag)) best = frag.length;
  return best;
}

const SEUIL_FRAGMENT = 4;

/**
 * Construit `Map<codeHockeyTech, nomEliteProspects>` et **vérifie qu'elle est
 * une bijection 22↔22**. En cas d'ambiguïté ou de club orphelin, on lève :
 * mieux vaut un fichier non écrit qu'un nom de club deviné, qui afficherait le
 * classement (et donc les GF/GA) de la mauvaise équipe.
 */
async function buildTeamDirectory() {
  const { siteKit } = await feed(KEY, { view: "teamsbyseason", season_id: SEASON_ID });
  const teams = vue(siteKit, "Teamsbyseason") ?? [];
  if (!teams.length) throw new Error("teamsbyseason vide — annuaire des clubs indisponible");

  const resolving = loadStandingNames();
  if (!resolving.parNom.size) {
    console.log("[khl-schedule] ⚠️ classement réel absent — tous les matchs seront marqués sans prédiction");
    return new Map();
  }

  const ep = [...resolving.parNom.values()].map((name) => ({ name, n: normKey(name) }));
  const repertoire = new Map();
  const details = [];

  for (const t of teams) {
    const code = t.code;
    if (!code) continue;

    const override = OVERRIDES[code];
    let nom = null;
    let methode = "override";

    if (!override) {
      const htNorm = normKey(t.name);
      const scores = ep
        .map((e) => ({ nom: e.name, score: longestCommonFragment(htNorm, e.n) }))
        .filter((x) => x.score >= SEUIL_FRAGMENT)
        .sort((a, b) => b.score - a.score);
      const exAequo = scores.filter((x) => x.score === (scores[0]?.score ?? 0));
      // Unicité exigée : deux clubs à égalité, c'est une ambiguïté, pas un match.
      if (scores[0] && exAequo.length === 1) {
        nom = scores[0].nom;
        methode = `fragment=${scores[0].score}`;
      }
      methode = nom ? methode : "non résolu";
    } else {
      nom = override;
    }

    details.push({ code, hockeyTech: t.name, ep: nom, methode });
    if (nom) repertoire.set(code, nom);
  }

  // Assertion de bijection : c'est elle qui garantit qu'aucun nom n'est
  // réutilisé par deux clubs.
  const nomsAtteints = new Set(repertoire.values());
  const nonResolus = details.filter((d) => !d.ep);
  if (repertoire.size !== teams.length || nomsAtteints.size !== teams.length) {
    throw new Error(
      `annuaire incomplet : ${repertoire.size}/${teams.length} clubs résolus, ` +
        `${nomsAtteints.size} noms distincts — nonrésolus : ${nonResolus.map((d) => `${d.code}(${d.hockeyTech})`).join(", ")}`,
    );
  }
  const jamaisAtteints = ep.filter((e) => !nomsAtteints.has(e.name)).map((e) => e.name);
  if (jamaisAtteints.length) {
    throw new Error(`clubs du classement jamais atteints par l'annuaire : ${jamaisAtteints.join(", ")}`);
  }

  const parMethode = {};
  for (const d of details) {
    const cle = d.methode.startsWith("fragment") ? "fragment" : d.methode;
    parMethode[cle] = (parMethode[cle] ?? 0) + 1;
  }
  console.log(`[khl-schedule] annuaire vérifié : bijection ${repertoire.size}↔${nomsAtteints.size} (${JSON.stringify(parMethode)})`);
  return repertoire;
}

/** Noms normalisés du classement EliteProspects (`nom normalisé → nom affiché`). */
function loadStandingNames() {
  if (!existsSync(STANDINGS)) return { parNom: new Map() };
  try {
    const json = JSON.parse(readFileSync(STANDINGS, "utf8"));
    const teams = json?.leagues?.khl?.teams ?? [];
    return { parNom: new Map(teams.map((t) => [normKey(t.name), t.name])) };
  } catch {
    return { parNom: new Map() };
  }
}

const normKey = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");

function normalizeMatch(m, repertoire) {
  // Cartographie mesurée sur 748 matchs (2026-10-05) :
  //   status=4 + final=1 → "Final"        (125 matchs : 98 rég., 16 OT, 11 OT+TAB)
  //   status=1 + final=0 → heure de coup d'envoi, non joué (623 matchs)
  // `started` vaut "1" dans les DEUX cas → inutilisable comme indicateur
  // (c'était la cause d'un `live 623` sur 623 matchs à venir).
  // `game_status` porte "Final" ou l'heure ("5:00 PM") : c'est le seul champ
  // qui distingue les deux d'un coup d'œil.
  const final = m.final === "1" || m.status === "4" || m.game_status === "Final";
  const iso = m.GameDateISO8601 || m.date_time_played || null;
  const date = m.date_played || iso?.slice(0, 10) || null;

  // Résolution par CODE, pas par nom : le code HockeyTech est la clé natively
  // unique (`SKA`, `KRS`, `SCH`…) et l'annuaire a été asserté bijectif.
  const homeStanding = m.home_team_code ? repertoire.get(m.home_team_code) ?? null : null;
  const awayStanding = m.visiting_team_code ? repertoire.get(m.visiting_team_code) ?? null : null;

  const buts = (v) => {
    const n = Number.parseInt(v ?? "", 10);
    return Number.isFinite(n) ? n : null;
  };

  return {
    id: String(m.id ?? m.game_id ?? ""),
    seasonId: String(m.season_id ?? ""),
    date,
    scheduledAt: iso,
    // Libellé affiché : EliteProspects s'il est résolu (c'est la source du
    // classement que le modèle consomme), sinon le libellé HockeyTech.
    homeName: homeStanding ?? m.home_team_name ?? "",
    awayName: awayStanding ?? m.visiting_team_name ?? "",
    homeCode: m.home_team_code ?? null,
    awayCode: m.visiting_team_code ?? null,
    homeId: m.home_team ?? null,
    awayId: m.visiting_team ?? null,
    homeCity: m.home_team_city ?? null,
    awayCity: m.visiting_team_city ?? null,
    venue: m.venue_location || m.location || null,
    status: m.game_status ?? null,
    isFinished: final,
    /**
     * `false` par construction, et c'est délibéré : une source fixtures ne
     * prouve pas qu'un match est EN COURS. `scorebar`, seule vue live, est
     * mesurée à 0/6 (tronquée par le proxy). Affirmer « live » sur la seule
     * heure de coup d'envoi passée produirait des badges verts sur des matchs
     * qui n'ont pas commencé — l'erreur inverse de « aucune donnée », et
     * plus grave pour l'utilisateur. `scheduledAt` est exposé pour qu'une
     * future source live pilote ce champ.
     */
    isLive: false,
    homeGoals: final ? buts(m.home_goal_count) : null,
    awayGoals: final ? buts(m.visiting_goal_count) : null,
    overtime: m.overtime === "1",
    shootout: m.shootout === "1",
    useShootouts: m.use_shootouts === "1",
    /**
     * `predictions_available` porte la VRAIE raison, par match : sans les deux
     * clubs résolus contre le classement, `/api/hockey/prediction` ne peut pas
     * trouver les GF/GA réels et ne doit rien inventer.
     */
    predictionsAvailable: Boolean(homeStanding && awayStanding),
    predictionsUnavailableReason:
      homeStanding && awayStanding
        ? null
        : repertoire.size === 0
          ? "aucun classement réel disponible"
          : `club absent de l'annuaire vérifié (${homeStanding ? m.visiting_team_code : m.home_team_code})`,
  };
}

async function main() {
  console.log("[khl-schedule] Résolution de la saison courante…");
  const { seasonId, seasonName } = await currentSeason(KEY);
  SEASON_ID = seasonId;
  console.log(`[khl-schedule] season_id=${seasonId} (${seasonName})`);

  console.log("[khl-schedule] Annuaire des clubs (jointure vérifiée)…");
  const repertoire = await buildTeamDirectory();

  console.log("[khl-schedule] Fetch schedule…");
  const { siteKit, tentative } = await feed(KEY, { view: "schedule", season_id: seasonId });
  const rows = vue(siteKit, "Schedule");
  if (!rows || rows.length === 0) throw new Error("Schedule vide");

  const matches = rows.map((m) => normalizeMatch(m, repertoire));

  // Contrôles de cohérence — ils lèvent, pas d'avertissement silencieux.
  const sansDate = matches.filter((m) => !m.date);
  if (sansDate.length) throw new Error(`${sansDate.length} matchs sans date — fichier refusé`);

  const sansId = matches.filter((m) => !m.id);
  if (sansId.length) throw new Error(`${sansId.length} matchs sans id — fichier refusé`);

  const ids = new Set(matches.map((m) => m.id));
  if (ids.size !== matches.length) throw new Error(`ids dupliqués dans le schedule (${ids.size}/${matches.length})`);

  // Un match « Final » sans score serait une donnée fausse affichée comme un
  // résultat : on refuse le fichier plutôt que de le publier.
  const finSansScore = matches.filter((m) => m.isFinished && (m.homeGoals === null || m.awayGoals === null));
  if (finSansScore.length) throw new Error(`${finSansScore.length} matchs « Final » sans score — fichier refusé`);

  // Un match à venir ne doit PAS porter de score : ce serait un résultat qui
  // n'a pas eu lieu.
  const avenirAvecScore = matches.filter((m) => !m.isFinished && (m.homeGoals !== null || m.awayGoals !== null));
  if (avenirAvecScore.length) throw new Error(`${avenirAvecScore.length} matchs à venir portent un score — fichier refusé`);

  console.log(`[khl-schedule] ${matches.length} matchs (tentative ${tentative})`);

  const prevus = matches.filter((m) => !m.isFinished);
  const termines = matches.filter((m) => m.isFinished);
  const prevusPredictibles = prevus.filter((m) => m.predictionsAvailable);
  const predicteurs = matches.filter((m) => m.predictionsAvailable);

  const parDate = [...new Set(matches.map((m) => m.date))].sort();
  console.log(`[khl-schedule] période ${parDate[0]} → ${parDate.at(-1)} (${parDate.length} jours)`);
  console.log(`[khl-schedule] terminés ${termines.length} · à venir ${prevus.length}`);
  console.log(`[khl-schedule] dont prolongation ${termines.filter((m) => m.overtime).length} · TAB ${termines.filter((m) => m.shootout).length}`);
  console.log(`[khl-schedule] prédictibles ${prevusPredictibles.length}/${prevus.length} à venir, ${predicteurs.length}/${matches.length} total`);

  if (DRY_RUN) {
    for (const m of matches.slice(0, 6)) {
      console.log(
        `  ${m.date} ${m.isFinished ? `FIN ${m.homeGoals}-${m.awayGoals}` : "AVR"} ` +
          `${(m.homeName || "?").padEnd(26)} vs ${(m.awayName || "?").padEnd(26)} ` +
          `[${m.homeCode}/${m.awayCode}] pred=${m.predictionsAvailable}`,
      );
    }
    const nonPred = matches.filter((m) => !m.predictionsAvailable);
    if (nonPred.length) {
      console.log(`  ${nonPred.length} sans prédiction, motifs :`);
      for (const motif of [...new Set(nonPred.map((m) => m.predictionsUnavailableReason))]) {
        console.log(`    - ${motif} (${nonPred.filter((m) => m.predictionsUnavailableReason === motif).length})`);
      }
    }
    return;
  }

  const payload = {
    updatedAt: new Date().toISOString(),
    source: "HockeyTech modulekit view=schedule (proxy khl.shayy.workers.dev)",
    generator: "scripts/scrape-khl-schedule.mjs",
    league: { id: "khl", name: "KHL", country: "Russia" },
    season: { id: seasonId, name: seasonName },
    counts: {
      matches: matches.length,
      finished: termines.length,
      upcoming: prevus.length,
      overtime: termines.filter((m) => m.overtime).length,
      shootout: termines.filter((m) => m.shootout).length,
      predictionsAvailable: predicteurs.length,
      predictionsUnavailable: matches.length - predicteurs.length,
    },
    // Fenêtre conseillée pour l'onglet calendrier, dérivée et non codée en dur.
    window: buildWindow(prevus),
    matches,
  };

  mkdirSync(join(ROOT, "data"), { recursive: true });
  writeFileSync(OUT, JSON.stringify(payload, null, 2));
  console.log(`[khl-schedule] Saved to ${OUT}`);
}

/** J-7 / J+10 sur les matchs à venir, bornes réelles et non nulles. */
function buildWindow(prevus) {
  const dates = prevus.map((m) => m.date).filter(Boolean).sort();
  if (!dates.length) return null;
  const debut = dates[0];
  const fin = dates[dates.length - 1];
  return { firstUpcoming: debut, lastUpcoming: fin, upcomingDays: new Set(dates).size };
}

main().catch((e) => {
  // Stack en plus du message : `repertoire.get is not a function` sans sa stack
  // ne dit pas QUEL appel. Un diagnostic qui oblige à deviner n'est pas un
  // diagnostic.
  console.error(`[khl-schedule] ECHEC : ${e.message}`);
  if (e.stack) console.error(e.stack);
  process.exit(1);
});
