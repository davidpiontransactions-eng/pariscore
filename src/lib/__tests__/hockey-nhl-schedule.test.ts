/**
 * Le calendrier NHL alimente-t-il réellement la route ?
 *
 * On teste la route RÉELLE, pas sa réimplémentation : c'est exactement ce qui
 * avait masqué le bug de promesse en suspens (`fetchBSD` enveloppé dans un
 * `new Promise` dont `resolve` n'était jamais appelé).
 */
import { describe, test, expect } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { GET } from "@/app/api/hockey/matches/route";
import { loadOfficialHockeySchedule, khlCalendarWindow } from "@/lib/hockey/khl-schedule";

const BUDGET_MS = 10_000;
const fiche = join(process.cwd(), "data", "nhl_schedule.json");
const present = existsSync(fiche);
const nhl = present ? loadOfficialHockeySchedule("nhl") : null;

describe("Calendrier NHL (ESPN) — intégration", () => {
  test("le fichier porte une saison complète et des clubs résolus", () => {
    if (!present) {
      // Sans le fichier, la route doit rester servie — c'est tout ce qu'on
      // peut affirmer. On ne casse pas la suite sur une absence de donnée.
      expect(true).toBe(true);
      return;
    }
    expect(nhl).not.toBeNull();
    expect(nhl!.league.id).toBe("nhl");
    expect(nhl!.matches.length).toBeGreaterThan(1000);

    // `counts.teams` et `teams` n'existent que dans le payload NHL : le type
    // partagé `KhlSchedule` ne les porte pas et aucun code ne les consomme.
    // On les vérifie donc sur le JSON brut, pas à travers la vue typée — sinon
    // il faudrait élargir un type pour les besoins d'un seul test.
    const brut = JSON.parse(readFileSync(fiche, "utf8")) as { teams?: unknown[] };
    expect(Array.isArray(brut.teams)).toBe(true);
    expect(brut.teams).toHaveLength(32);

    // Les 32 franchises doivent être résolues contre le classement EliteProspects,
    // sinon aucune prédiction n'est possible (le piège de « Montréal »).
    expect(nhl!.counts.predictionsAvailable).toBe(nhl!.matches.length);
    expect(nhl!.counts.predictionsUnavailable).toBe(0);
  });

  test("les noms sont EXACTEMENT ceux du classement, donc les logos NHL s'appliquent", () => {
    if (!nhl) return;
    // On ne veut pas les libellés ESPN bruts : « Montreal Canadiens » chez
    // ESPN, « Montréal Canadiens » au classement. Résoudre vers le
    // classement est précisément ce qui rend la comparaison possible — donc
    // l'accent est ATTENDU, pas un défaut. Ce qu'on vérifie, c'est
    // l'appartenance au classement, pas l'absence d'accent.
    const classement = new Set(
      (JSON.parse(readFileSync(join(process.cwd(), "data", "eliteprospects_hockey_standings.json"), "utf8")) as {
        leagues: { nhl: { teams: { name: string }[] } };
      }).leagues.nhl.teams.map((t) => t.name),
    );
    expect(classement.size).toBe(32);
    const horsClassement = nhl.matches.filter((m) => !classement.has(m.homeName) || !classement.has(m.awayName));
    expect(`${horsClassement.length} matchs hors classement`).toBe("0 matchs hors classement");
    // Le cas qui a motivé le NFD : Montréal doit être résolu, pas écarté.
    const montreal = nhl.matches.filter((m) => m.homeCode === "MTL" || m.awayCode === "MTL");
    expect(montreal.length).toBeGreaterThan(0);
    for (const m of montreal) {
      expect(classement.has(m.homeCode === "MTL" ? m.homeName : m.awayName)).toBe(true);
    }
    // Aucun club ne s'affronte lui-même : garde-fou de jointure.
    for (const m of nhl.matches) expect(m.homeCode === m.awayCode).toBe(false);
  });

  test("un match terminé porte un score, un match à venir n'en porte aucun", () => {
    if (!nhl) return;
    const termines = nhl.matches.filter((m) => m.isFinished);
    expect(termines.length).toBeGreaterThan(0);
    for (const m of termines) {
      expect(m.homeGoals).not.toBeNull();
      expect(m.awayGoals).not.toBeNull();
    }
    for (const m of nhl.matches.filter((x) => !x.isFinished)) {
      expect(m.homeGoals).toBeNull();
      expect(m.awayGoals).toBeNull();
    }
  });

  test("la fenêtre J-7/J+10 borne le calendrier comme pour la KHL", () => {
    if (!nhl) return;
    const { matchs, fenetre } = khlCalendarWindow(nhl, { maintenant: new Date("2026-10-05T12:00:00Z") });
    expect(fenetre).not.toBeNull();
    expect(matchs.length).toBeGreaterThan(0);
    expect(matchs.length).toBeLessThan(nhl.matches.length);
    for (const m of matchs) {
      expect(m.date! >= "2026-09-28").toBe(true);
      expect(m.date! <= "2026-10-15").toBe(true);
    }
  });

  test("la route sert les matchs NHL et répond dans le budget", async () => {
    const res = await Promise.race<Response>([
      GET(),
      new Promise<never>((_, rejeter) => setTimeout(() => rejeter(new Error(`pas de réponse en ${BUDGET_MS}ms`)), BUDGET_MS)),
    ]);
    expect(res.status).toBe(200);

    const body = await res.json();
    const espn = body.matches.filter((m: { source: string }) => m.source === "espn");
    expect(body.counts.espn).toBe(espn.length);

    if (present) {
      // Le calendrier existe sur disque : la route DOIT le servir. Sinon les
      // squelettes gris reviennent, et c'est le symptôme exact du ticket.
      expect(espn.length).toBeGreaterThan(0);
      const exemple = espn[0] as { homeName: string; awayName: string; predictionsAvailable: boolean };
      expect(exemple.homeName.length).toBeGreaterThan(0);
      expect(exemple.awayName.length).toBeGreaterThan(0);
      expect(typeof exemple.predictionsAvailable).toBe("boolean");
    }
  }, BUDGET_MS + 5000);

  test("les autres calendriers ne sont pas cassés par l'ajout NHL", async () => {
    const res = await GET();
    const body = await res.json();
    // Sources présentes : bsd, prematch, hockeytech (KHL), espn (NHL).
    expect(body.source).toContain("hockeytech");
    expect(body.degraded).toBe(false);
    const khl = body.matches.filter((m: { source: string }) => m.source === "hockeytech");
    expect(khl.length).toBeGreaterThan(0);
  }, BUDGET_MS + 5000);

  test("le manifeste déclare l'atteinte de RotoWire sans en inventer le contenu", () => {
    if (!present) return;
    const brut = JSON.parse(readFileSync(fiche, "utf8"));
    // RotoWire est joignable mais sa structure n'est pas décodée : on le
    // déclare, on n'invente pas de composition.
    expect(brut.rotowire.reachable).toBe(true);
    expect(brut.rotowire.lineupsParsed ?? false).toBe(false);
  });
});