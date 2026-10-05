/**
 * Vérification exécutable de la résolution des blasons KHL.
 *
 * Cible lachaîne complète, pas seulement la table :
 *  1. chacun des 22 noms de clubs affichés par l'onglet doit résoudre ;
 *  2. chaque fichier désigné doit EXISTER sur le disque et être un vrai PNG ;
 *  3. aucun club Magnus/NHL ne doit être capté par une clé KHL (le scan est
 *     par `includes`, donc une clé trop courte volerait le blason d'autrui) ;
 *  4. le manifeste doit rester cohérent avec ce que la table désigne.
 */
import { describe, test, expect } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { teamLogoUrl } from "@/components/hockey/hockey-team-logo";

const DATA = join(process.cwd(), "data");
const PUBLIC = join(process.cwd(), "public");

const standings = JSON.parse(readFileSync(join(DATA, "eliteprospects_hockey_standings.json"), "utf8"));
const manifest = JSON.parse(readFileSync(join(PUBLIC, "logos", "hockey", "manifest.json"), "utf8"));

const khlTeams = standings.leagues.khl.teams as { name: string }[];
const khlManifest = manifest.khl as { code: string; name: string; file: string; sha256: string; width: number; height: number; bytes: number }[];

describe("Logos KHL — résolution bout en bout", () => {
  test("le manifeste couvre les 22 clubs avec des empreintes distinctes", () => {
    expect(khlManifest).toHaveLength(22);
    expect(new Set(khlManifest.map((m) => m.sha256)).size).toBe(22);
    expect(khlManifest.every((m) => m.bytes > 1024)).toBe(true);
    expect(khlManifest.every((m) => m.width >= 100 && m.height >= 100)).toBe(true);
  });

  test("le classement EliteProspects expose 22 clubs KHL", () => {
    expect(khlTeams).toHaveLength(22);
  });

  test.each(khlTeams.map((t) => t.name))("%s résout vers un blason KHL présent sur le disque", (name) => {
    const url = teamLogoUrl(name);
    expect(url).not.toBeNull();
    expect(url!.startsWith("/logos/hockey/khl/")).toBe(true);

    const fichier = join(PUBLIC, url!.replace(/^\//, ""));
    expect(existsSync(fichier)).toBe(true);

    const entete = readFileSync(fichier).subarray(0, 8);
    expect([...entete]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  });

  test("aucun club Magnus ni NHL n'est capté par une clé KHL", () => {
    const clubs = [
      ...["Aigles de Nice", "HC Briancon", "Dragons de Rouen", "Rapaces de Gap", "Pionniers de Chamonix Mont-Blanc", "HC Cergy-Pontoise", "Boxers de Bordeaux", "HDJ Marseille", "Brûleurs de Loups de Grenoble", "HC Amiens", "Ducs d'Angers", "Anglet Hormadi"],
      ...["Anaheim Ducks", "Boston Bruins", "Buffalo Sabres", "Calgary Flames", "Carolina Hurricanes", "Chicago Blackhawks", "Colorado Avalanche", "Columbus Blue Jackets", "Dallas Stars", "Detroit Red Wings", "Edmonton Oilers", "Florida Panthers", "LA Kings", "Minnesota Wild", "Montreal Canadiens", "Nashville Predators", "New Jersey Devils", "New York Islanders", "New York Rangers", "Ottawa Senators", "Philadelphia Flyers", "Pittsburgh Penguins", "San Jose Sharks", "Seattle Kraken", "St. Louis Blues", "Tampa Bay Lightning", "Toronto Maple Leafs", "Utah Mammoth", "Vancouver Canucks", "Vegas Golden Knights", "Washington Capitals", "Winnipeg Jets"],
    ];
    for (const club of clubs) {
      const url = teamLogoUrl(club);
      expect(`${club} → ${url}`).not.toContain("/logos/hockey/khl/");
    }
  });

  test("les deux noms d'origine de chaque club KHL (EliteProspects et HockeyTech) convergent", () => {
    for (const m of khlManifest) {
      const attendu = `/logos/hockey/khl/${m.code}.png`;
      // L'alias HockeyTech doit résoudre vers le même fichier que le nom EliteProspects.
      expect(`${m.name} → ${teamLogoUrl(m.name)}`).toBe(`${m.name} → ${attendu}`);
      const epName = khlTeams.find((t) => teamLogoUrl(t.name) === attendu)?.name;
      expect(epName).toBeDefined();
    }
  });

  test("une clé courte contenue dans une autre ne vole pas le blason (SKA ⊂ CSKA)", () => {
    expect(teamLogoUrl("SKA")).toBe("/logos/hockey/khl/SKA.png");
    expect(teamLogoUrl("CSKA")).toBe("/logos/hockey/khl/CSK.png");
    expect(teamLogoUrl("CSKA Moskva")).toBe("/logos/hockey/khl/CSK.png");
    expect(teamLogoUrl("SKA St. Petersburg")).toBe("/logos/hockey/khl/SKA.png");
    // La résolution ne doit pas dépendre de l'ordre du tableur : la clé la
    // plus longue gagne, donc les quatre alias ci-dessus ont un sens unique.
    expect(teamLogoUrl("cska")).toBe(teamLogoUrl("CSKA"));
    expect(teamLogoUrl("SKA")).not.toBe(teamLogoUrl("CSKA"));
  });
});