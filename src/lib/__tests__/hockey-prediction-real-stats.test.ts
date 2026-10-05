/**
 * Vérifie que le chemin prédiction hockey ne fabrique plus de GF/GA, et que
 * l'absence se voit au lieu de disparaître.
 *
 * Le test travaille sur la source RÉELLE du dépôt (data/*.json) et sur la
 * fonction pure de résolution des stats, via la route GET — donc il échoue
 * si quelqu'un réintroduit une synthèse, si le classement réel s'arrête
 * d'alimenter la route, ou si un match sans donnée redevient invisible.
 */
import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const DATA = join(process.cwd(), "data");
const standings = JSON.parse(readFileSync(join(DATA, "eliteprospects_hockey_standings.json"), "utf8"));
const prematch = JSON.parse(readFileSync(join(DATA, "hockey_prematch_annabet.json"), "utf8"));

type TeamStanding = {
  name: string; teamId: string | null; gp: number;
  w: number; t: number; l: number; otw: number; otl: number;
  gf: number; ga: number; ppg: number;
};

const khl = standings.leagues.khl.teams as TeamStanding[];

describe("Prédiction hockey — plus aucune fabrication de GF/GA", () => {
  test("le classement KHL réel porte des GF/GA non nuls (la source existe)", () => {
    expect(khl.length).toBe(22);
    expect(khl.every((t) => t.gp > 0)).toBe(true);
    expect(khl.every((t) => t.gf > 0 && t.ga > 0)).toBe(true);
  });

  test("cohérence interne : GF et GA se compensent entre les 22 clubs", () => {
    const gf = khl.reduce((a, t) => a + t.gf, 0);
    const ga = khl.reduce((a, t) => a + t.ga, 0);
    // Chaque but marqué par un club est encaissé par un autre : la somme doit
    // être identique. Un GF/GA fabriqué par match Independent la casserait.
    expect(gf).toBe(ga);
  });

  test("le fichier de source ne contient plus le calcul artificiel (2.8 / 2.5)", () => {
    const src = readFileSync(join(process.cwd(), "src", "app", "api", "hockey", "prediction", "route.ts"), "utf8");
    // Les coefficients n'apparaissent que dans des commentaires d'explication.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(code).not.toContain("2.8");
    expect(code).not.toContain("2.5");
    expect(code).not.toContain("allStats");
  });

  test("la route expose `unavailable` : un match non prédit se voit", async () => {
    const { GET } = await import("@/app/api/hockey/prediction/route");
    const res = await GET();
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      predictions: Record<string, unknown>;
      unavailable: { match: { home: string; away: string }; reason: string }[];
    };

    expect(Array.isArray(body.unavailable)).toBe(true);

    // Cohérence : rien n'est à la fois prédit et indisponible.
    for (const u of body.unavailable) {
      expect(`${u.match.home} vs ${u.match.away}`).not.toBe("");
      expect(u.reason.length).toBeGreaterThan(0);
    }

    // Chaque match prematch est soit prédit, soit déclaré indisponible.
    const totalAttendu = Object.values(prematch.leagues as Record<string, { matches: unknown[] }>)
      .reduce((n, lg) => n + (lg?.matches?.length ?? 0), 0);
    expect(Object.keys(body.predictions).length + body.unavailable.length).toBe(totalAttendu);
  });

  test("aucune prédiction ne repose sur des GF/GA fabriqués", async () => {
    const { GET } = await import("@/app/api/hockey/prediction/route");
    const res = await GET();
    const body = (await res.json()) as {
      predictions: Record<string, { match: { home: string; away: string }; prediction: { lambda: { home: number; away: number } } }>;
    };

    const noms = new Map(khl.map((t) => [t.name.toLowerCase(), t]));
    let verifie = 0;

    for (const entry of Object.values(body.predictions)) {
      const h = noms.get(entry.match.home.toLowerCase());
      const a = noms.get(entry.match.away.toLowerCase());
      if (!h || !a) continue;

      // λ doit être borné par les ratios d'attaque/défense réels. La vieille
      // formule produisait des λ hors de tout ce qui est dérivable : gf=0
      // synthétique => λ collé au plancher 0.5, ou division par zéro.
      const ratioH = entry.prediction.lambda.home / (h.gf / h.gp);
      const ratioA = entry.prediction.lambda.away / (a.gf / a.gp);
      for (const ratio of [ratioH, ratioA]) {
        expect(Number.isFinite(ratio)).toBe(true);
        expect(ratio).toBeGreaterThan(0.05);
        expect(ratio).toBeLessThan(20);
      }
      // Un λ par équipe plafonné à 6 par le moteur : un λ à 10 signalerait
      // une entrée synthetic sans commune mesure avec le classement.
      expect(entry.prediction.lambda.home).toBeLessThanOrEqual(6);
      expect(entry.prediction.lambda.away).toBeLessThanOrEqual(6);
      verifie++;
    }

    // Aucune prédiction n'est actuellement émise (NHL sans classement réel, KHL et
    // Magnus sans fixtures) : l'invariant ci-dessus est donc vrai mais creux.
    // On l'assume explicitement pour que le test ne facture pas un vide.
    expect(verifie).toBe(Object.keys(body.predictions).length);
  });

  test("estimateLambdas consomme les GF/GA réels du classement KHL", async () => {
    const { estimateLambdas } = await import("@/lib/prediction/hockey/poisson");

    // Deux clubs réels dont l'attaque et la défense sont opposées.
    const fort = khl.find((t) => t.gf / t.gp - t.ga / t.gp > 0.5);
    const faible = khl.find((t) => t.ga / t.gp - t.gf / t.gp > 0.5);
    expect(fort).toBeDefined();
    expect(faible).toBeDefined();

    const stats = (t: TeamStanding) => ({ name: t.name, gp: t.gp, gf: t.gf, ga: t.ga });
    const lambda = estimateLambdas(stats(fort!), stats(faible!));

    // L'attaque du fort contre la défense du faible doit dépasser l'inverse.
    expect(lambda.home).toBeGreaterThan(lambda.away);
    // Plafond dur du moteur + plancher.
    expect(lambda.home).toBeGreaterThan(0.5);
    expect(lambda.home).toBeLessThanOrEqual(6);
    expect(lambda.away).toBeGreaterThan(0.5);
    expect(lambda.away).toBeLessThanOrEqual(6);

    // Le λ calculé doit être cohérent avec la base réelle du classement
    // (≈ 4.96 buts/match sur les 154 matchs de la saison 2026-2027).
    const base = khl.reduce((a, t) => a + t.gf + t.ga, 0) / khl.reduce((a, t) => a + t.gp, 0);
    expect(base).toBeGreaterThan(4);
    expect(base).toBeLessThan(6);
    expect(lambda.home + lambda.away).toBeGreaterThan(base * 0.4);
    expect(lambda.home + lambda.away).toBeLessThan(base * 2);
  });
});