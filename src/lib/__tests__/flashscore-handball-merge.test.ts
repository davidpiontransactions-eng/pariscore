import { describe, expect, test } from "bun:test";
import { createRequire } from "node:module";

// Le scripteur est du CommonJS (scripts/legacy) : on le charge via createRequire.
const require_ = createRequire(import.meta.url);
const {
  hasFinalScore,
  mergeSnapshots,
  parseDay,
  pushUnique,
}: {
  hasFinalScore: (m: unknown) => boolean;
  mergeSnapshots: (previous: unknown[], fresh: unknown[]) => unknown[];
  parseDay: (body: string) => { home: string; away: string; score: string | null }[];
  pushUnique: (all: unknown[], seen: Map<string, number>, m: unknown) => boolean;
} = require_("../../../scripts/scrape-flashscore-handball.js");

type M = { home: string; away: string; time: string; score?: string; id?: string };

const m = (home: string, away: string, time: string, score?: string): M => ({
  home,
  away,
  time,
  ...(score != null ? { score } : {}),
});

// ─── hasFinalScore ───

describe("hasFinalScore — distinguer un final d'un « à venir »", () => {
  test("score numérique final → true", () => {
    expect(hasFinalScore(m("A", "B", "19:00", "32:28"))).toBe(true);
    expect(hasFinalScore(m("A", "B", "19:00", "7:7"))).toBe(true);
    expect(hasFinalScore(m("A", "B", "19:00", " 32 : 28 "))).toBe(true);
  });

  test("format RÉEL du scripteur « 32 - 28 » → true (fix fige 2026-09-28)", () => {
    // Régression du bead ParisScorebis-1gge : la regex n'acceptait que « : »,
    // donc freshFinished ≡ 0 et la garde de main() annulait toute écriture.
    expect(hasFinalScore(m("A", "B", "19:00", "32 - 28"))).toBe(true);
    expect(hasFinalScore(m("A", "B", "19:00", "42 - 29"))).toBe(true);
    expect(hasFinalScore(m("A", "B", "19:00", " 7 - 7 "))).toBe(true);
    // Un score vide ou non numérique reste refusé.
    expect(hasFinalScore(m("A", "B", "19:00", " - "))).toBe(false);
    expect(hasFinalScore(m("A", "B", "19:00", "-:-"))).toBe(false);
  });

  test("pas de score / score vide / non numérique → false", () => {
    expect(hasFinalScore(m("A", "B", "19:00"))).toBe(false);
    expect(hasFinalScore(m("A", "B", "19:00", ""))).toBe(false);
    expect(hasFinalScore(m("A", "B", "19:00", "?:?"))).toBe(false);
    expect(hasFinalScore(m("A", "B", "19:00", "-:-"))).toBe(false);
    expect(hasFinalScore(null)).toBe(false);
  });
});

// ─── parseDay ⟷ hasFinalScore : l'accord format (piège du 2026-09-28) ───
//
// Les deux fonctions vivent dans le même script mais ont divergé : parseDay
// écrivait « 32 - 28 », hasFinalScore attendait « 32:28 ». Les tests passaient
// parce qu'ils fabriquaient le score à la main au format attendu. Ce test
// construit le score par le VRAI parseur : il échoue si l'un des deux change
// sans l'autre.

describe("parseDay ⟷ hasFinalScore — le score produit est bien reconnu", () => {
  const FEED = [
    "~ZA÷FRANCE: StarLigue",
    "~AA÷mt1",
    "AD÷1760000000",
    "AE÷Nantes",
    "AF÷Montpellier",
    "AG÷32",
    "AH÷28",
    "BA÷16",
    "BB÷13",
    "AS÷2",
  ].join("¬");

  test("le match parsé porte un score final reconnu par la garde", () => {
    const parsed = parseDay(FEED);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].score).toBe("32 - 28");
    expect(hasFinalScore(parsed[0])).toBe(true);
  });

  test("un match à venir (sans AG/AH) n'est PAS un final", () => {
    const upcoming = ["~ZA÷FRANCE: StarLigue", "~AA÷mt2", "AD÷1760000000", "AE÷Lens", "AF÷Reims", "AS÷4"].join("¬");
    const parsed = parseDay(upcoming);
    expect(parsed).toHaveLength(1);
    expect(hasFinalScore(parsed[0])).toBe(false);
  });
});

// ─── mergeSnapshots — la correction de la cause racine ───

describe("mergeSnapshots — ne plus perdre les scores acquis", () => {
  test("le frais remplace l'ancien DÈS qu'il apporte un score", () => {
    // Scénario du bug : le match était « à venir » au run précédent, le feed le
    // rejoue aujourd'hui avec son score final. L'ancien doit être upgradzé.
    const previous = [m("A", "B", "19:00")];
    const fresh = [m("A", "B", "19:00", "32:28")];
    const merged = mergeSnapshots(previous, fresh);
    expect(merged).toHaveLength(1);
    expect((merged[0] as M).score).toBe("32:28");
  });

  test("le frais SANS score ne dégrade PAS une entrée déjà scorée", () => {
    const previous = [m("A", "B", "19:00", "32:28")];
    const fresh = [m("A", "B", "19:00")];
    const merged = mergeSnapshots(previous, fresh);
    expect(merged).toHaveLength(1);
    expect((merged[0] as M).score).toBe("32:28");
  });

  test("les deux scorés : le plus ancien NE l'emporte pas (le frais est plus à jour)", () => {
    // L'implémentation ne remplace l'ancien que si l'ancien n'a pas de score
    // (garde anti-régression). Deux scores existants ⇒ l'ancien reste.
    // C'est volontaire : le score final d'un match terminé est immuable, donc
    // garder le premier score connu évite qu'un feed qui rejoue un match en
    // cours (score provisoire) n'écrase le définitif.
    const previous = [m("A", "B", "19:00", "30:28")];
    const fresh = [m("A", "B", "19:00", "32:28")];
    expect((mergeSnapshots(previous, fresh)[0] as M).score).toBe("30:28");
  });

  test("les entrées disjointes s'additionnent (fenêtre qui s'élargit)", () => {
    const previous = [m("A", "B", "19:00", "32:28")];
    const fresh = [m("C", "D", "20:00", "25:30")];
    const merged = mergeSnapshots(previous, fresh) as M[];
    expect(merged).toHaveLength(2);
    expect(merged.map((x) => x.home).sort()).toEqual(["A", "C"]);
  });

  test("déterminisme : même entrée → même sortie", () => {
    const p = [m("A", "B", "19:00"), m("C", "D", "20:00", "25:30")];
    const f = [m("A", "B", "19:00", "32:28"), m("E", "F", "21:00")];
    expect(JSON.stringify(mergeSnapshots(p, f))).toBe(JSON.stringify(mergeSnapshots(p, f)));
  });

  test("cas limites : entrées vides ou absentes → jamais de throw", () => {
    expect(mergeSnapshots([], [])).toEqual([]);
    expect(mergeSnapshots(undefined as never, undefined as never)).toEqual([]);
    expect(mergeSnapshots([], [m("A", "B", "19:00")])).toHaveLength(1);
    expect(mergeSnapshots([m("A", "B", "19:00")], [])).toHaveLength(1);
  });

  test("cas du run en échec : le frais est vide → l'historique est conservé", () => {
    // C'est ce qui rend le garde-fou de main() utile : sans ça, 6 jours de
    // résultats disparaissent au premier 403.
    const previous = [
      m("A", "B", "19:00", "32:28"),
      m("C", "D", "20:00", "25:30"),
    ];
    expect(mergeSnapshots(previous, [])).toHaveLength(2);
    expect(previous.some(hasFinalScore)).toBe(true);
  });

  test("la fusion préserve les scores des matchs J-2..J-7 réinjectés", () => {
    // Reconstruction du scénario complet : J-1/J+0 frais + 3 matchs terminés
    // revenus de l'historique, avec un doublon volontairement présent.
    const previous = [m("A", "B", "19:00"), m("X", "Y", "18:00", "20:20")];
    const fresh = [
      m("A", "B", "19:00", "32:28"),
      m("P", "Q", "17:00", "30:25"),
      m("R", "S", "16:00", "28:31"),
      m("T", "U", "15:00", "22:22"),
    ];
    const merged = mergeSnapshots(previous, fresh) as M[];
    // 1 orphelin (X-Y, déjà scoré) + 4 frais, dont A-B upgradzé en place.
    expect(merged).toHaveLength(5);
    expect(merged.filter(hasFinalScore)).toHaveLength(5);
    // Le doublon a été fusionné, pas dupliqué.
    expect(merged.filter((x) => x.home === "A")).toHaveLength(1);
    expect(merged.find((x) => x.home === "A")?.score).toBe("32:28");
  });
});

// ─── Clé d'identité : `id` d'événement, PAS `home|away|time` ───
//
// Régression du 2026-10-08 : le feed Flashscore omet parfois la clé de kickoff
// `AD`. L'entrée sortait avec `time: ""`, donc la clé composite ne la
// fusionnait pas avec son jumeau horodaté du MÊME événement (`fs-ALuO8gMH` =
// SC Magdeburg – Kiel, vu deux fois dans le snapshot). `toHandballMatch`
// remplaçait alors le temps vide par `new Date().toISOString()` : la ligne
// tombait dans la mauvaise journée et s'affichait à l'heure du scrape
// (00:15 au lieu de 19:00). La clé doit être l'identifiant d'événement.

describe("déduplication par identifiant d'événement", () => {
  const MAGDEBURG = "fs-ALuO8gMH";

  test("mergeSnapshots fusionne le jumeau sans heure avec son jumeau horodaté", () => {
    const previous = [{ ...m("SC Magdeburg", "Kiel", ""), id: MAGDEBURG }];
    const fresh = [{ ...m("SC Magdeburg", "Kiel", "2026-09-30T17:00:00.000Z"), id: MAGDEBURG }];
    const merged = mergeSnapshots(previous, fresh) as M[];
    expect(merged).toHaveLength(1);
    expect(merged[0].time).toBe("2026-09-30T17:00:00.000Z");
  });

  test("l'ordre inverse (frais sans heure) NE perd pas le kickoff connu", () => {
    // Snapshot accumulatif : une heure vue une fois ne doit jamais se dégrader.
    const previous = [{ ...m("SC Magdeburg", "Kiel", "2026-09-30T17:00:00.000Z"), id: MAGDEBURG }];
    const fresh = [{ ...m("SC Magdeburg", "Kiel", ""), id: MAGDEBURG }];
    const merged = mergeSnapshots(previous, fresh) as M[];
    expect(merged).toHaveLength(1);
    expect(merged[0].time).toBe("2026-09-30T17:00:00.000Z");
  });

  test("pushUnique ne garde qu'une ligne et récupère le kickoff tardif", () => {
    const all: M[] = [];
    const seen = new Map<string, number>();
    expect(pushUnique(all, seen, { ...m("SC Magdeburg", "Kiel", ""), id: MAGDEBURG })).toBe(true);
    // Même événement rejoué avec le kickoff : pas de doublon, l'heure est récupérée.
    expect(pushUnique(all, seen, { ...m("SC Magdeburg", "Kiel", "2026-09-30T17:00:00.000Z"), id: MAGDEBURG })).toBe(false);
    expect(all).toHaveLength(1);
    expect(all[0].time).toBe("2026-09-30T17:00:00.000Z");
  });

  test("deux événements distincts restent deux lignes", () => {
    const all: M[] = [];
    const seen = new Map<string, number>();
    pushUnique(all, seen, { ...m("A", "B", "19:00"), id: "fs-1" });
    pushUnique(all, seen, { ...m("C", "D", "19:00"), id: "fs-2" });
    expect(all).toHaveLength(2);
  });

  test("deux matchs HOMONYMES sans id (legacy) restent distincts", () => {
    // Repli sur la clé composite : ne pas fusionner à l'aveugle des matchs
    // différents qui porteraient le même couple d'équipes.
    const all: M[] = [];
    const seen = new Map<string, number>();
    pushUnique(all, seen, m("A", "B", "19:00"));
    pushUnique(all, seen, m("A", "B", "21:00"));
    expect(all).toHaveLength(2);
  });
});
