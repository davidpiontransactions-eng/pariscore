import { describe, expect, test } from "bun:test";
import path from "node:path";
import fs from "node:fs";

import {
  matchEuroLeagueFixture,
  matchEuroLeagueTeam,
} from "../basketball-vitibet-euro-join";

/**
 * Régression de l'annuaire d'alias sur le DUMP RÉEL.
 *
 * ⚠️ Le test dépend de `data/basketball_vitibet_bsd.json`, fichier versionné
 * (absent de `.gitignore`, contrairement à `data/tennis/` ou
 * `data/rugby-backtest.json` qui sont des artefacts runtime). Il est régénéré par
 * `scripts/pipeline-basketball-vitibet-bsd.ts`.
 *
 * Ce que le test PREND en charge : une équipe déjà résolue qui redevient
 * non résoluble parce que Vitibet a changé un libellé de sponsor. C'est la
 * panne silencieuse à éviter — le taux d'appariement chuterait sans la moindre
 * erreur visible en prod.
 *
 * Ce que le test NE fait PAS : exiger un compte exact. Le dump se renouvelle
 * (nouvelles journées, nouvelles équipes qui montent en EuroLeague), donc un
 * seuil en pourcentage alarmafterait à chaque rotation de série sans signaler
 * de régression. Le contrôle porte sur les RENCONTRES CONNUES, pas sur le
 * total.
 */

/**
 * Noms d'équipes EuroLeague tels que l'API les rend (MAJUSCULES, sponsors
 * inclus). Relevé sur `GET /api/v1/euroleague/matches?league=euroleague` le
 * 2026-10-05 : 402 matchs, 20 clubs.
 */
const API_TEAM_NAMES = [
  "ANADOLU EFES ISTANBUL",
  "AS MONACO",
  "CRVENA ZVEZDA MERIDIANBET BELGRADE",
  "DUBAI BASKETBALL",
  "EA7 EMPORIO ARMANI MILAN",
  "FC BARCELONA",
  "FC BAYERN MUNICH",
  "FENERBAHCE BEKO ISTANBUL",
  "HAPOEL IBI TEL AVIV",
  "KOSNER BASKONIA VITORIA-GASTEIZ",
  "LDLC ASVEL VILLEURBANNE",
  "MACCABI RAPYD TEL AVIV",
  "OLYMPIACOS PIRAEUS",
  "PANATHINAIKOS AKTOR ATHENS",
  "PARIS BASKETBALL",
  "PARTIZAN MOZZART BET BELGRADE",
  "REAL MADRID",
  "VALENCIA BASKET",
  "VIRTUS BOLOGNA",
  "ZALGIRIS KAUNAS",
];

/**
 * Les 7 rencontres EuroLeague portant une prédiction le 2026-10-05, avec le
 * couple (nom Vitibet → nom API) que l'annuaire doit savoir résoudre.
 *
 * Ce sont des CAS MESURÉS, pas des exemples : chacun a échoué à
 * `normalizeName` seul (0/7) et exige soit le sous-ensemble de tokens, soit un
 * alias de marque.
 */
const KNOWN_PAIRS: Array<{ vitibet: string; api: string }> = [
  // sponsor en suffixe
  { vitibet: "Partizan Mozzart Bet", api: "PARTIZAN MOZZART BET BELGRADE" },
  { vitibet: "Crvena Zvezda Meridianbet", api: "CRVENA ZVEZDA MERIDIANBET BELGRADE" },
  // sponsor intercalé
  { vitibet: "Maccabi Tel Aviv", api: "MACCABI RAPYD TEL AVIV" },
  // suffixe « Basketball »
  { vitibet: "Dubai", api: "DUBAI BASKETBALL" },
  { vitibet: "Paris", api: "PARIS BASKETBALL" },
  { vitibet: "Valencia", api: "VALENCIA BASKET" },
  // ville + marque
  { vitibet: "Bayern", api: "FC BAYERN MUNICH" },
  { vitibet: "Panathinaikos", api: "PANATHINAIKOS AKTOR ATHENS" },
  { vitibet: "Fenerbahce", api: "FENERBAHCE BEKO ISTANBUL" },
  { vitibet: "Hapoel Tel Aviv", api: "HAPOEL IBI TEL AVIV" },
  { vitibet: "Virtus Segafredo Bologna", api: "VIRTUS BOLOGNA" },
  { vitibet: "Real Madrid", api: "REAL MADRID" },
  // alias de marque explicite — aucun token commun
  { vitibet: "Lyon-Villeurbanne", api: "LDLC ASVEL VILLEURBANNE" },
  { vitibet: "Olimpia Milano", api: "EA7 EMPORIO ARMANI MILAN" },
];

type RawDump = {
  scraped_at?: string;
  leagues?: Array<{ league_name?: string; matches?: unknown[] }>;
};

const DUMP = path.join(process.cwd(), "data", "basketball_vitibet_bsd.json");
const dumpExists = fs.existsSync(DUMP);

describe("annuaire d'alias — régression sur le dump réel", () => {
  test("le dump versionné est présent (sinon les tests ci-dessous ne prouvent rien)", () => {
    expect(dumpExists).toBe(true);
  });

  test("chaque rencontre connue reste résoluble vers le bon club", () => {
    // Le cœur du test : si Vitibet ou l'API EuroLeague change un libellé, ce
    // cas tombe en `null` et le test lève avant tout déploiement.
    const echecs: string[] = [];
    for (const { vitibet, api } of KNOWN_PAIRS) {
      const resolu = matchEuroLeagueTeam(vitibet, API_TEAM_NAMES);
      if (resolu !== api) echecs.push(`${vitibet} → ${resolu ?? "null"} (attendu ${api})`);
    }
    expect(echecs).toEqual([]);
  });

  test("les 7 matchs EuroLeague prédits du dump s'apparient tous (2 équipes)", () => {
    if (!dumpExists) return;
    const raw = JSON.parse(fs.readFileSync(DUMP, "utf8")) as RawDump;

    // Matchs avec proba publiées, quels que soient leurs noms.
    const predits = (raw.leagues ?? [])
      .filter((l) => l.league_name === "Euroleague")
      .flatMap((l) => l.matches ?? [])
      .filter((m) => {
        const p = (m as { vitibet_data?: { probabilities?: { home?: number | null; away?: number | null } } })
          .vitibet_data?.probabilities;
        return (p?.home ?? 0) > 0 && (p?.away ?? 0) > 0;
      });

    expect(predits.length).toBeGreaterThan(0);

    // Chaque équipe du dump doit se résoudre vers UN club de l'API. On ne fixe
    // pas le compte de matchs : le dump tourne (nouvelles journées), on vérifie
    // que rien de résolu hier ne cassera silencieusement.
    const nonResolus: string[] = [];
    for (const m of predits as Array<{ home_team?: { name?: string }; away_team?: { name?: string } }>) {
      for (const team of [m.home_team?.name, m.away_team?.name]) {
        if (!team) continue;
        if (matchEuroLeagueTeam(team, API_TEAM_NAMES) === null) nonResolus.push(team);
      }
    }
    expect(nonResolus).toEqual([]);
  });

  test("aucun appariement ne renvoie le club d'un autre", () => {
    // Un alias qui pointerait vers un club présent mais faux passerait le test
    // précédent. On vérifie qu'un nom hors liste ne tombe jamais sur un club.
    const horsListe = ["Paris Saint-Germain", "Lyon Basket", "Milan Basket", "ZZZ Inconnu"];
    for (const nom of horsListe) {
      expect(matchEuroLeagueTeam(nom, API_TEAM_NAMES), `${nom} apparié à tort`).toBeNull();
    }
  });

  test("matchEuroLeagueFixture exige les DEUX équipes", () => {
    const api = API_TEAM_NAMES.map((name) => ({
      home: { name: name === "REAL MADRID" ? "REAL MADRID" : "X" },
      away: { name },
    }));
    // Vitibet connaît un club, l'autre est inconnu → aucun appariement.
    const partiel = { home: { name: "Real Madrid" }, away: { name: "Club Inconnu" } };
    expect(matchEuroLeagueFixture(partiel, api)).toBeNull();
  });
});