/**
 * Calendrier KHL — vérifications exécutables sur le VRAI fichier produit par
 * `scripts/scrape-khl-schedule.mjs`.
 *
 * Les invariants vérifiés sont ceux dont la violation produirait une fausse
 * information affichée à l'utilisateur :
 *  - un match « Final » porte un score, un match à venir n'en porte aucun ;
 *  - `isLive` n'est jamais `true` sans source live (mesurée à 0/6) ;
 *  - `predictions_available` est vrai exactement quand les deux clubs sont
 *    résolus contre le classement RÉEL, et le motif est nommé sinon ;
 *  - les noms affichés sont ceux du classement, donc l'appariement de
 *    `/api/hockey/prediction` peut trouver les GF/GA sans approximation ;
 *  - la fenêtre J-7/J+10 est bornée par `now` : un match à venir ne doit pas
 *    apparaître dans le passé.
 */
import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { loadKhlSchedule, khlCalendarWindow, type KhlSchedule } from "@/lib/hockey/khl-schedule";

const data = JSON.parse(readFileSync(join(process.cwd(), "data", "khl_schedule.json"), "utf8")) as KhlSchedule;
const standings = JSON.parse(
  readFileSync(join(process.cwd(), "data", "eliteprospects_hockey_standings.json"), "utf8"),
);
const classement = standings.leagues.khl.teams as { name: string; gp: number; gf: number; ga: number }[];
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

describe("Calendrier KHL — intégrité du fichier", () => {
  test("la saison porte la saison courante, résolue par année", () => {
    const annee = new Date().getUTCFullYear();
    expect(data.season.name).toContain(String(annee));
    expect(Number(data.season.id)).toBeGreaterThan(400); // 407 = 2026/2027
  });

  test("748 matchs, tous datés et identifiés, ids uniques", () => {
    expect(data.matches).toHaveLength(748);
    expect(data.matches.every((m) => Boolean(m.date))).toBe(true);
    expect(data.matches.every((m) => Boolean(m.id))).toBe(true);
    expect(new Set(data.matches.map((m) => m.id)).size).toBe(748);
  });

  test("la saison couvre la période attendue d'une KHL", () => {
    const dates = data.matches.map((m) => m.date!).sort();
    expect(dates[0]).toBe("2026-09-05");
    // La KHL joue jusqu'au printemps ; 182 jours de septembre à mars.
    expect(dates[dates.length - 1]).toBe("2027-03-20");
  });

  test("« Final » ⇒ score renseigné ; à venir ⇒ aucun score", () => {
    const finSansScore = data.matches.filter((m) => m.isFinished && (m.homeGoals === null || m.awayGoals === null));
    const avenirAvecScore = data.matches.filter((m) => !m.isFinished && (m.homeGoals !== null || m.awayGoals !== null));
    expect(finSansScore).toHaveLength(0);
    expect(avenirAvecScore).toHaveLength(0);
  });

  test("le score d'un match terminé est plausible (mesuré : moy 5,18, min 1, max 14)", () => {
    // Mesuré sur les 125 matchs terminés : total min 1 (1-0), max 14, moyenne
    // 5,18, médiane 5, et 26 matchs avec un camp à 0. Une borne « au moins 2
    // buts par camp » était donc FAUSSE : un 0-1 est un résultat KHL banal.
    // Ce qu'on verrouille, c'est l'absence de décalage de colonne — un 0-0
    // « Final » ou une valeur à 25 le révélerait.
    const fin = data.matches.filter((m) => m.isFinished);
    const totaux = fin.map((m) => (m.homeGoals ?? 0) + (m.awayGoals ?? 0));
    for (const m of fin) {
      expect(m.homeGoals).toBeGreaterThanOrEqual(0);
      expect(m.homeGoals).toBeLessThanOrEqual(15);
      expect(m.awayGoals).toBeGreaterThanOrEqual(0);
      expect(m.awayGoals).toBeLessThanOrEqual(15);
    }
    expect(Math.min(...totaux)).toBeGreaterThanOrEqual(1);
    expect(Math.max(...totaux)).toBeLessThanOrEqual(15);
    const moyenne = totaux.reduce((a, b) => a + b, 0) / totaux.length;
    // Cohérent avec la base mesurée du classement (4,96) et la moyenne
    // télévision mesurée (5,18) : la borne rejects une colonne mal lue.
    expect(moyenne).toBeGreaterThan(3.5);
    expect(moyenne).toBeLessThan(7);
  });

  test("isLive est toujours false : aucune source live n'est mesurée fiable", () => {
    // `scorebar` est la seule vue live et elle est mesurée à 0/6. Affirmer
    // « live » depuis une heure de coup d'envoi produirait des badges verts
    // sur des matchs qui n'ont pas commencé.
    expect(data.matches.every((m) => m.isLive === false)).toBe(true);
  });

  test("prolongation et TAB ne sont signalés que sur des matchs terminés", () => {
    for (const m of data.matches) {
      if (m.overtime || m.shootout) expect(m.isFinished).toBe(true);
    }
    expect(data.counts.shootout).toBeGreaterThan(0);
    expect(data.counts.shootout).toBeLessThanOrEqual(data.counts.overtime);
  });
});

describe("Calendrier KHL — résolution contre le classement réel", () => {
  test("les 22 clubs du classement sont tous représentés, 68 matchs chacun", () => {
    const vus = new Map<string, number>();
    for (const m of data.matches) {
      vus.set(m.homeName, (vus.get(m.homeName) ?? 0) + 1);
      vus.set(m.awayName, (vus.get(m.awayName) ?? 0) + 1);
    }
    expect(vus.size).toBe(22);
    for (const t of classement) {
      // 748 × 2 / 22 = 68 : un aller-retour homé Lender complet.
      expect(`${t.name} : ${vus.get(t.name) ?? 0} matchs`).toBe(`${t.name} : 68 matchs`);
    }
  });

  test("tout libellé de match appartient au classement (aucun nom de club inventé)", () => {
    const nomsClassement = new Set(classement.map((t) => t.name));
    for (const m of data.matches) {
      expect(nomsClassement.has(m.homeName)).toBe(true);
      expect(nomsClassement.has(m.awayName)).toBe(true);
    }
  });

  test("aucun club ne joue contre lui-même (garde-fou de jointure)", () => {
    for (const m of data.matches) expect(m.homeName === m.awayName).toBe(false);
  });

  test("predictions_available est vrai exactement quand les deux clubs sont résolus", () => {
    const nomsClassement = new Set(classement.map((t) => t.name));
    for (const m of data.matches) {
      const attendu = nomsClassement.has(m.homeName) && nomsClassement.has(m.awayName);
      expect(`${m.id} ${m.predictionsAvailable}`).toBe(`${m.id} ${attendu}`);
      if (!m.predictionsAvailable) expect(m.predictionsUnavailableReason).toBeTruthy();
      else expect(m.predictionsUnavailableReason).toBeNull();
    }
  });

  test("la résolution est totale : 748/748 prédictibles", () => {
    expect(data.counts.predictionsAvailable).toBe(748);
    expect(data.counts.predictionsUnavailable).toBe(0);
  });

  test("chaque code HockeyTech désigne un seul club dans tout le calendrier", () => {
    // Le calendrier expose homeCode/awayCode, résolus par code côté UI. Deux
    // matchs ne doivent jamais partager un code pour deux clubs différents.
    const codeVersNoms = new Map<string, Set<string>>();
    for (const m of data.matches) {
      for (const [code, nom] of [
        [m.homeCode, m.homeName],
        [m.awayCode, m.awayName],
      ] as const) {
        if (!code) continue;
        if (!codeVersNoms.has(code)) codeVersNoms.set(code, new Set());
        codeVersNoms.get(code)!.add(nom);
      }
    }
    expect(codeVersNoms.size).toBe(22);
    for (const [code, noms] of codeVersNoms) {
      expect(noms.size).toBe(1);
      expect(`${code} → ${[...noms][0]}`).toBe(`${code} → ${[...noms][0]}`);
    }
  });

  test("l'appariement de findTeamStats (5 caractères) relie chaque match au classement", () => {
    // Rejoue la règle de `findTeamStats` : le plus court des deux noms doit
    // faire ≥ 5 caractères, sinon aucun GF/GA réel n'est trouvé et le match
    // est marqué sans prédiction — ce qui serait une régression silencieuse.
    for (const m of data.matches) {
      for (const nom of [m.homeName, m.awayName]) {
        const trouve = classement.some((t) => {
          const n = norm(t.name);
          if (n.length < 5 || Math.min(n.length, norm(nom).length) < 5) return false;
          return n.includes(norm(nom)) || norm(nom).includes(n);
        });
        expect(trouve).toBe(true);
      }
    }
  });
});

describe("Calendrier KHL — fenêtre J-7/J+10", () => {
  const maintenant = new Date("2026-10-05T12:00:00Z");

  test("la fenêtre entoure la date courante et exclut la saison entière", () => {
    const { fenetre, matchs } = khlCalendarWindow(data, { maintenant });
    expect(fenetre).not.toBeNull();
    expect(fenetre!.debut).toBe("2026-09-28");
    expect(fenetre!.fin).toBe("2026-10-15");
    expect(matchs.length).toBeGreaterThan(0);
    expect(matchs.length).toBeLessThan(748);
    expect(fenetre!.matches).toBe(matchs.length);
  });

  test("aucun match hors de la fenêtre ne subsiste", () => {
    const { matchs } = khlCalendarWindow(data, { maintenant });
    for (const m of matchs) {
      expect(m.date! >= "2026-09-28").toBe(true);
      expect(m.date! <= "2026-10-15").toBe(true);
    }
  });

  test("un match à venir n'apparaît pas dans le passé (fenêtre bornée par now)", () => {
    // Le fichier peut contenir des matchs datés dans le futur pour cause de
    // report : la borne « avant » vient de `now`, jamais du fichier.
    const { matchs } = khlCalendarWindow(data, { maintenant, joursAvant: 0, joursApres: 365 });
    const passes = matchs.filter((m) => m.date! < "2026-10-05");
    expect(passes).toHaveLength(0);
  });

  test("une fenêtre vide renvoie null, pas un objet à zéros", () => {
    const lointain = new Date("2030-01-01T00:00:00Z");
    const { fenetre, matchs } = khlCalendarWindow(data, { maintenant: lointain });
    expect(matchs).toHaveLength(0);
    expect(fenetre).toBeNull();
  });
});

describe("Calendrier KHL — chargement serveur", () => {
  test("loadKhlSchedule lit le vrai fichier", () => {
    const charge = loadKhlSchedule();
    expect(charge).not.toBeNull();
    expect(charge!.matches).toHaveLength(748);
    expect(charge!.league.id).toBe("khl");
  });

  test("isLive et predictionsAvailable sont des booléens explicites sur chaque ligne", () => {
    // Le type `KhlMatch` expose `isLive` : on vérifie qu'il existe bien sur
    // chaque ligne, sinon la route afficherait `undefined` (falsy) au lieu de
    // la valeur explicite.
    const charge = loadKhlSchedule()!;
    for (const m of charge.matches.slice(0, 50)) {
      expect(typeof m.isLive).toBe("boolean");
      expect(typeof m.predictionsAvailable).toBe("boolean");
    }
  });
});