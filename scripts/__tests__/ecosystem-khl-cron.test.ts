/**
 * Vérifie l'entrée cron du calendrier KHL : unique, syntaxe valide, et
 * chronologie cohérente avec les dépendances réelles.
 *
 * Un créneau 04:15 passerait APRÈS `hockey-restart` (04:10) — le cache
 * in-memory serait vidé avant que le dernier scraper n'écrive. C'est un
 * sous-ensemble de l'ordre du fichier ; on vérifie donc l'ordre réel.
 */
import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(join(process.cwd(), "ecosystem.config.js"), "utf8");

/** Extrait le bloc d'une entrée pm2 à partir de son `name`. */
function block(name: string): string {
  const i = src.indexOf(`name: '${name}'`);
  if (i === -1) throw new Error(`${name} introuvable`);
  const debut = src.lastIndexOf("{", i);
  let depth = 0;
  for (let j = debut; j < src.length; j++) {
    if (src[j] === "{") depth++;
    else if (src[j] === "}") {
      depth--;
      if (depth === 0) return src.slice(debut, j + 1);
    }
  }
  throw new Error(`${name} : accolades non équilibrées`);
}

/** Minute → numéro de minutes depuis minuit (ordre chronologique). */
const minutes = (cron: string) => {
  const [m, h] = cron.split(" ");
  return Number(h) * 60 + Number(m);
};

describe("Cron calendrier KHL", () => {
  test("l'entrée existe et n'est pas dupliquée", () => {
    const occurrences = src.split("pariscore-cron-hockey-khl").length - 1;
    expect(occurrences).toBe(1);
    expect(src).toContain("args: 'scripts/scrape-khl-schedule.mjs'");
  });

  test("le bloc est syntaxiquement valide et suit le schéma du fichier", () => {
    const b = block("pariscore-cron-hockey-khl");
    for (const cle of ["script:", "args:", "cwd:", "cron_restart:", "autorestart: false", "instances: 1", "exec_mode:", "max_memory_restart:", "error_file:", "out_file:", "log_date_format:", "time: true"]) {
      // Le message d'échec est le 2ᵉ ARGUMENT de expect, jamais une partie de
      // la valeur comparée — sinon on écrit `expect("x manquant").toBe("x")`,
      // qui échoue toujours.
      expect(b, `clé absente du bloc : ${cle}`).toContain(cle);
    }
    // Même interprète que les autres crons .mjs du fichier.
    expect(b).toContain("script: 'node'");
    expect(b).toContain("cwd: '/home/ubuntu/pariscore'");
  });

  test("l'ordre chronologique respecte les dépendances réelles", () => {
    const ep = block("pariscore-cron-hockey-eliteprospects");
    const khl = block("pariscore-cron-hockey-khl");
    const restart = block("pariscore-cron-hockey-restart");

    const cronEp = ep.match(/cron_restart: '([^']+)'/)![1];
    const cronKhl = khl.match(/cron_restart: '([^']+)'/)![1];
    const cronRestart = restart.match(/cron_restart: '([^']+)'/)![1];

    // 1. Le calendrier lit le classement : il doit passer APRÈS son refresh.
    expect(minutes(cronKhl)).toBeGreaterThan(minutes(cronEp));
    // 2. Le restart vide le cache : il doit passer APRÈS le dernier scraper.
    expect(minutes(cronRestart)).toBeGreaterThan(minutes(cronKhl));
    // 3. Et le créneau proposé (04:15) serait FAUX : après le restart.
    expect(minutes("15 4 * * *")).toBeGreaterThan(minutes(cronRestart));
  });

  test("le créneau retenu est bien 03:45 et il est justifié dans le source", () => {
    const khl = block("pariscore-cron-hockey-khl");
    expect(khl).toContain("45 3 * * *");
    // La raison du choix doit être écrite, sinon le prochain qui « corrige »
    // le créneau en 04:15 casserait silencieusement le cache.
    expect(khl).toContain("bijection 22↔22");
    expect(khl).toContain("hockey-restart");
  });
});

/**
 * Inscription PM2 de la chaîne hockey dans les scripts de déploiement.
 *
 * C'est le bug réellement réparé le 2026-10-05 : les 6 crons étaient déclarés
 * dans ecosystem.config.js mais inscrits À LA MAIN sur le VPS. Aucun chemin de
 * déploiement ne les inscrivait, donc un VPS reconstruit les perdait — SANS
 * ERREUR (un cron non inscrit est un cron absent, pas un cron en erreur).
 *
 * Ces tests verrouillent les deux propriétés qui ne se verraient pas : la
 * couverture exhaustive des noms, et le fait que la boucle est HORS du garde-fou
 * `$BUILD_RAN` (les scrapers hockey sont des `node scripts/*.mjs` autonomes).
 */
const DEPLOY = ["scripts/update_vps.sh", "scripts/deploy-v2.sh"] as const;

describe("inscription PM2 de la chaîne hockey (scripts de deploy)", () => {
  for (const chemin of DEPLOY) {
    test(`${chemin} : la boucle couvre les 6 crons, hors du garde-fou $BUILD_RAN`, () => {
      const src = readFileSync(join(process.cwd(), chemin), "utf8");

      const boucle = src.match(/for HC in ([a-z ]+); do/);
      expect(boucle, "boucle `for HC in` absente").not.toBeNull();
      const suffixes = (boucle![1] ?? "").trim().split(/\s+/).filter(Boolean);

      // 1. Couverture exhaustive : les 6 suffixes, dans les deux sens.
      const attendus = ["annabet", "prematch", "eliteprospects", "khl", "projections", "restart"];
      for (const s of attendus) {
        expect(suffixes, `${chemin}: ${s} manquant dans la boucle`).toContain(s);
      }
      // Rien de superflu : un suffixe dans la boucle sans entrée pm2 = cron mort.
      // (On ne cherche PAS les noms littéraux dans le script : ils y sont
      // construits par interpolation `"pariscore-cron-hockey-$HC"`. La parité
      // avec ecosystem.config.js est vérifiée par le test dédié plus bas.)
      for (const s of suffixes) {
        expect(attendus, `${chemin}: ${s} inscrit mais non déclaré`).toContain(s);
      }

      // 2. La boucle est AVANT le `if $BUILD_RAN` qui garde les 4 crons système :
      //    c'est ce placement qui la rend inconditionnelle.
      const iBoucle = src.indexOf("for HC in");
      const iRg = src.indexOf("pariscore-cron-rg");
      expect(iBoucle, "boucle introuvable").toBeGreaterThan(-1);
      expect(iRg, "cron rg introuvable").toBeGreaterThan(-1);
      const iGarde = src.lastIndexOf('if [ "$BUILD_RAN" = "1" ]', iRg);
      expect(iGarde, "garde-fou BUILD_RAN introuvable avant le cron rg").toBeGreaterThan(-1);
      expect(
        iBoucle,
        `${chemin}: la boucle est DANS le garde-fou $BUILD_RAN — un deploy sans build ne l'inscrirait plus`,
      ).toBeLessThan(iGarde);
    });
  }

  test("ecosystem et scripts de deploy Declare exactement les memes crons hockey", () => {
    const eco = readFileSync(join(process.cwd(), "ecosystem.config.js"), "utf8");
    const ecoNames = [...eco.matchAll(/name: '(pariscore-cron-hockey-[a-z]+)'/g)].map((m) => m[1]);
    expect(ecoNames.length).toBe(6);
    for (const chemin of DEPLOY) {
      const src = readFileSync(join(process.cwd(), chemin), "utf8");
      const boucle = src.match(/for HC in ([a-z ]+); do/)!;
      const inscrits = (boucle[1] ?? "")
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((s) => `pariscore-cron-hockey-${s}`);
      expect(inscrits.sort(), `${chemin} vs ecosystem`).toEqual(ecoNames.sort());
    }
  });
});