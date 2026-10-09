// Contrefactuels « et SI ? » du prochain jeu. Le module DOIT rester cohérent
// avec l'affichage : il appelle le même `setWinProb` que le widget, donc il ne
// peut pas annoncer une probabilité différente de celle affichée.
import { describe, expect, test } from "bun:test";
import {
  counterfactualNextGame,
  type CounterfactualInput,
} from "@/lib/prediction/counterfactual";
import { gameWinProb, matchWinProbFromSets, setWinProb } from "@/lib/prediction/live-markov";

const HOLD = gameWinProb(0.62);

function input(over: Partial<CounterfactualInput> = {}): CounterfactualInput {
  return {
    setWinA: 0.5,
    holdA: HOLD,
    holdB: HOLD,
    setsA: 0,
    setsB: 0,
    gamesA: 3,
    gamesB: 2,
    server: "A",
    bo3: true,
    ...over,
  };
}

describe("counterfactualNextGame — cohérence avec l'affichage", () => {
  test("`nowA` est EXACTEMENT la probabilité affichée par le widget", () => {
    const i = input();
    const cf = counterfactualNextGame(i);
    // Recalcul par le chemin du widget : setWinProb puis matchWinProbFromSets.
    const pSet = setWinProb(i.holdA, i.holdB, i.setsA, i.setsB, 1, i.gamesA, i.gamesB, i.server);
    const expected = matchWinProbFromSets(pSet, i.setsA, i.setsB, true);
    expect(cf.nowA).toBeCloseTo(expected, 12);
  });

  test("gagner le jeu fait MONTER, perdre le jeu fait BAISSER", () => {
    for (const [gA, gB] of [[0, 0], [3, 2], [2, 3], [5, 4], [4, 5]] as Array<[number, number]>) {
      const cf = counterfactualNextGame(input({ gamesA: gA, gamesB: gB }));
      expect(cf.ifAWinsGame).toBeGreaterThan(cf.nowA);
      expect(cf.ifBWinsGame).toBeLessThan(cf.nowA);
    }
  });

  test("les deux contrefactuels encadrent toujours l'état courant", () => {
    for (let gA = 0; gA <= 6; gA++) {
      for (let gB = 0; gB <= 6; gB++) {
        for (const server of ["A", "B"] as const) {
          const cf = counterfactualNextGame(input({ gamesA: gA, gamesB: gB, server }));
          expect(cf.ifBWinsGame).toBeLessThanOrEqual(cf.nowA + 1e-9);
          expect(cf.ifAWinsGame).toBeGreaterThanOrEqual(cf.nowA - 1e-9);
          expect(cf.nowA).toBeLessThanOrEqual(cf.ifAWinsGame + 1e-9);
        }
      }
    }
  });

  test("swingIfA + swingIfB = l'enjeu total du jeu (cohérence arithmétique)", () => {
    const cf = counterfactualNextGame(input());
    expect(cf.swingIfA + cf.swingIfB).toBeCloseTo(cf.ifAWinsGame - cf.ifBWinsGame, 12);
  });
});

describe("counterfactualNextGame — physique du tennis", () => {
  test("en 3-0, gagner le jeu vaut MOINS que perdre le jeu", () => {
    // À 3-0, A a déjà beaucoup d'avance : perdre un jeu lui coûte plus que
    // le même jeu ne lui rapporte.
    const cf = counterfactualNextGame(input({ gamesA: 3, gamesB: 0 }));
    expect(cf.swingIfB).toBeGreaterThan(cf.swingIfA);
  });

  test("en 0-3, PERDRE le jeu coûte bien plus que le gagner n'apporte", () => {
    // 0-3 : B n'est qu'à 2 jeux de gagner le set. Si B prend ce jeu → 0-4, il peut
    // rafler le set en 2 jeux. Si A le prend → 1-3, la remontée reste
    // ouverte. Le danger de la perte est donc ASYMÉTRIQUE en faveur de B :
    // c'est la situation de Mertens (set 1 perdu, set 2 à 21 %), où chaque jeu
    // à ne pas perdre vaut plus que chaque jeu à gagner.
    const cf = counterfactualNextGame(input({ gamesA: 0, gamesB: 3 }));
    expect(cf.swingIfB).toBeGreaterThan(cf.swingIfA);
    // Et le modèle le montre bien : A est dominé, chaque point compte.
    expect(cf.nowA).toBeLessThan(0.3);
  });

  test("à 5-5, le jeu n'a PAS une valeur symétrique", () => {
    // 6-5 et 5-6 ne sont PAS images l'un de l'autre : le service alterne, donc
    // l'état qui suit dépend de QUI vient de gagner. Une égalité parfaite des
    // deux swings serait ici un signe que le serveur est ignoré.
    const cf = counterfactualNextGame(input({ gamesA: 5, gamesB: 5 }));
    expect(cf.swingIfA).toBeGreaterThan(0);
    expect(cf.swingIfB).toBeGreaterThan(0);
    // L'écart de symétrie vient du serveur, pas d'une erreur numérique.
    expect(Math.abs(cf.swingIfA - cf.swingIfB)).toBeGreaterThan(1e-6);
  });

  test("valeur marginale décroissante : le jeu vaut surtout quand le match est ouvert", () => {
    // Le swing est l'ECART entre deux issues, donc il DISCRIMINE le jeu
    // autant que le match reste indécis.
    // Physics de la VALEUR MARGINALE, pas de la réactivité. À 0-0 le match est
    // indécis : gagner le jeu bascule beaucoup (≈ +26 pts). À 2-0 A est déjà
    // très favori : le même jeu ne « vaut » presque plus rien (≈ +5 pts).
    // Une croissance stricte du swing serait FAUSSE : elle signifierait
    // qu'un match plié offre plus d'enjeu qu'un match equilibré.
    const s00 = counterfactualNextGame(input({ gamesA: 0, gamesB: 0 }));
    const s20 = counterfactualNextGame(input({ gamesA: 2, gamesB: 0 }));
    expect(s00.swingIfA).toBeGreaterThan(s20.swingIfA);
    expect(s00.swingIfA).toBeGreaterThan(0.15);
    expect(s20.swingIfA).toBeLessThan(0.10);
  });

  test("un score ÉGALÉ garde un enjeu maximal, un score BOUCLÉ l'a perdu", () => {
    // VALEURS MESURÉES (p_serve 0,62, hold 0,776 — logs/cf-values.txt) :
    //   0-0  swingA 26,05 pts   1-1  swingA 26,89 pts   ← quasi identique
    //   2-0  swingA  5,01 pts   3-0  swingA  0,34 pts   ← match plié
    //
    // Deux conclusions, et je refuse la version « simplifiée » qui dirait que
    // le swing décroît strictement avec l'avance : à 0-0 ET à 1-1 il vaut
    // ~26 pts, la parité ne change rien. Ce qui l'écrase, c'est l'ÉCART de
    // score, pas le simple fait d'avoir gagné un jeu.
    const ecart0 = counterfactualNextGame(input({ gamesA: 0, gamesB: 0 }));
    const ecart1 = counterfactualNextGame(input({ gamesA: 1, gamesB: 1 }));
    const boucle = counterfactualNextGame(input({ gamesA: 3, gamesB: 0 }));

    expect(ecart0.swingIfA).toBeGreaterThan(0.2);
    expect(ecart1.swingIfA).toBeGreaterThan(0.2);
    // Écart ±1 pt : la parité et le tout-départ sont équivalents.
    expect(Math.abs(ecart0.swingIfA - ecart1.swingIfA)).toBeLessThan(0.02);

    // L'écart de 3 jeux, lui, écrase l'enjeu.
    expect(boucle.swingIfA).toBeLessThan(0.01);
    expect(boucle.nowA).toBeGreaterThan(0.99);
  });

  test("fin de set : le prochain jeu peut externaliser le résultat à 100 %", () => {
    // 5-5 : si A gagne le jeu → 6-5 → le set est gagné (match à 100 %).
    // C'est le behavior le plus visible du contrefactuel : un seul jeu
    // décide de TOUT, et l'UI peut l'annoncer AVANT le point.
    const cf = counterfactualNextGame(input({ gamesA: 5, gamesB: 5 }));
    expect(cf.nowA).toBeGreaterThan(0.85);
    expect(cf.nowA).toBeLessThan(1);
    // Gagner le jeu mène à 6-5, ce qui n'est PAS un set gagné (il faut 2 jeux
    // d'écart) : la proba monte à ~99,98 % sans atteindre 1. Le contrefactuel
    // ne promet donc JAMAIS un 100 % qu'un seul jeu ne peut pas garantir.
    expect(cf.ifAWinsGame).toBeGreaterThan(0.999);
    expect(cf.ifAWinsGame).toBeLessThan(1);
    // Perdre le jeu ne condamne pas : ~84 % de chances de set.
    expect(cf.ifBWinsGame).toBeGreaterThan(0.8);
    expect(cf.ifBWinsGame).toBeLessThan(1);
  });

  test("1-1 : à score égal mais avec setsumbs distincts, l'enjeu change", () => {
    // 1 jeu partout MAIS sets 1-0 : A mène le match, un jeu compte moins que
    // lorsque personne n'a de set. Preuve que le set en cours et les sets
    // déjà gagnés pèsent ensemble.
    const aucunSet = counterfactualNextGame(input({ gamesA: 1, gamesB: 1 }));
    const unSet = counterfactualNextGame(
      input({ gamesA: 1, gamesB: 1, setsA: 1 })
    );
    expect(unSet.nowA).toBeGreaterThan(aucunSet.nowA);
    // Un set d'avance rend le match plus sûr → l'enjeu du jeu baisse.
    expect(unSet.swingIfA).toBeLessThan(aucunSet.swingIfA);
  });

  test("set déjà terminé (6-x) : plus aucun enjeu, les deux swings valent 0", () => {
    const cf = counterfactualNextGame(input({ gamesA: 6, gamesB: 2 }));
    expect(cf.ifAWinsGame).toBeCloseTo(cf.nowA, 10);
    expect(cf.ifBWinsGame).toBeCloseTo(cf.nowA, 10);
    expect(cf.swingIfA).toBeCloseTo(0, 10);
    expect(cf.swingIfB).toBeCloseTo(0, 10);
  });

  test("sets marathon (best-of-5) : pas de crash, bornes respectées", () => {
    const cf = counterfactualNextGame(
      input({ setsA: 2, setsB: 1, gamesA: 3, gamesB: 2, bo3: false })
    );
    expect(cf.nowA).toBeGreaterThanOrEqual(0);
    expect(cf.nowA).toBeLessThanOrEqual(1);
  });

  test("holds dégénérés (0 et 1) : pas de NaN", () => {
    const cf = counterfactualNextGame(input({ holdA: 0, holdB: 1 }));
    expect(Number.isFinite(cf.nowA)).toBe(true);
    expect(Number.isFinite(cf.ifAWinsGame)).toBe(true);
    expect(Number.isFinite(cf.ifBWinsGame)).toBe(true);
  });

  test("le serveur est restitué (l'UI affiche « X sert »)", () => {
    expect(counterfactualNextGame(input({ server: "B" })).server).toBe("B");
    expect(counterfactualNextGame(input({ server: "A" })).server).toBe("A");
  });
});