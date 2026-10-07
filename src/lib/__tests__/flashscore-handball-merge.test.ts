import { describe, expect, test } from "bun:test";
import { createRequire } from "node:module";

// Le scripteur est du CommonJS (scripts/legacy) : on le charge via createRequire.
const require_ = createRequire(import.meta.url);
const {
  hasFinalScore,
  mergeSnapshots,
  parseDay,
  pushUnique,
  repairMissingTimes,
  dropUnplaceable,
  snapshotKey,
}: {
  hasFinalScore: (m: unknown) => boolean;
  mergeSnapshots: (previous: unknown[], fresh: unknown[]) => unknown[];
  parseDay: (body: string) => { home: string; away: string; score: string | null }[];
  pushUnique: (all: unknown[], seen: Map<string, number>, m: unknown) => boolean;
  repairMissingTimes: (rows: unknown[]) => number;
  dropUnplaceable: (rows: unknown[]) => unknown[];
  snapshotKey: (m: unknown) => string;
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

// ─── Identité du match : clé COMPLÈTE, jamais `id` seul ───
//
// Deux bugs réels, tous deux mesurés sur le snapshot VPS (1408 matchs,
// 2026-10-08) et tous deux introduits par une clé d'identité trop laxes.
//
// Symptôme n°1 « Magdeburg – Kiel à 00:15 » : le feed omet la clé de kickoff
// `AD`, la ligne sort avec `time: ""` et `toHandballMatch` la horodate à
// l'instant du scrape. La clé complète ne peut pas fusionner cette ligne avec
// son jumeau horodaté (elles n'ont pas la même clé) — c'est le rôle de
// `repairMissingTimes` de lui rendre son heure, puis la re-fusion de collapsser
// les deux.
//
// Contre-épreuve (2026-10-08) : une clé `id` seule SUPPRIME des matchs réels.

describe("identité d'un match — clé complète", () => {
  const MAGDEBURG = "fs-ALuO8gMH";

  test("réparation : la copie sans heure récupère celle de son jumeau", () => {
    const rows = [
      { ...m("SC Magdeburg", "Kiel", ""), id: MAGDEBURG },
      { ...m("SC Magdeburg", "Kiel", "2026-09-30T17:00:00.000Z"), id: MAGDEBURG },
    ];
    expect(repairMissingTimes(rows)).toBe(1);
    expect(rows[0].time).toBe("2026-09-30T17:00:00.000Z");
    // Réparée, la copie redevient identique à son jumeau → une seule ligne.
    expect(mergeSnapshots(rows, [])).toHaveLength(1);
  });

  test("aller-retour : deux horaires candidats → on NE devine pas", () => {
    // Même événement, mêmes équipes, deux dates (mesuré : 50 paires réelles).
    // Attribuer l'une des deux au hasard placerait un match au mauvais jour.
    const rows = [
      { ...m("Dalmatinka W", "Zrinski W", ""), id: "fs-xhNzXglB" },
      { ...m("Dalmatinka W", "Zrinski W", "2026-09-30T16:00:00.000Z"), id: "fs-xhNzXglB" },
      { ...m("Dalmatinka W", "Zrinski W", "2026-10-14T17:30:00.000Z"), id: "fs-xhNzXglB" },
    ];
    expect(repairMissingTimes(rows)).toBe(0);
    expect(rows[0].time).toBe("");
    // La ligne sans heure est retirée : ni plaçable, ni comptabilisable.
    expect(dropUnplaceable(rows)).toHaveLength(2);
  });

  test("aller-retour SANS ligne sans heure : les deux rendez-vous survivent", () => {
    const rows = [
      { ...m("Dalmatinka W", "Zrinski W", "2026-09-30T16:00:00.000Z"), id: "fs-xhNzXglB" },
      { ...m("Dalmatinka W", "Zrinski W", "2026-10-14T17:30:00.000Z"), id: "fs-xhNzXglB" },
    ];
    expect(mergeSnapshots(rows, [])).toHaveLength(2);
  });

  test("collision d'id sur deux matchs DIFFÉRENTS → les deux survivent", () => {
    // Mesuré : `fs-AR0BBBdl` = Ramat Hasharon – MK Beer Sheva ET le match
    // retour, 1 h plus tard. Une clé `id` seule en aurait supprimé un.
    const rows = [
      { ...m("Ramat Hasharon", "MK Beer Sheva", "2026-10-02T12:00:00.000Z"), id: "fs-AR0BBBdl" },
      { ...m("MK Beer Sheva", "Ramat Hasharon", "2026-10-02T11:00:00.000Z"), id: "fs-AR0BBBdl" },
    ];
    expect(mergeSnapshots(rows, [])).toHaveLength(2);
  });

  test("même ligne rejouée par deux fichiers-jour → une seule ligne", () => {
    const row = { ...m("PSG", "Nantes", "2026-10-08T18:00:00.000Z"), id: "fs-abc" };
    expect(mergeSnapshots([row], [row])).toHaveLength(1);
    const all: M[] = [];
    const seen = new Map<string, number>();
    expect(pushUnique(all, seen, row)).toBe(true);
    expect(pushUnique(all, seen, row)).toBe(false);
    expect(all).toHaveLength(1);
  });

  test("doublons INTERNES à `previous` : résorbés (le fichier pollué se nettoie)", () => {
    // C'est ce cas qui manquait : le snapshot déjà écrit contient les deux
    // copies ; sansabsorption interne, la copie sans heure restait à jamais.
    const previous = [
      { ...m("SC Magdeburg", "Kiel", ""), id: MAGDEBURG },
      { ...m("SC Magdeburg", "Kiel", "2026-09-30T17:00:00.000Z"), id: MAGDEBURG },
      { ...m("PSG", "Nantes", "2026-10-08T18:00:00.000Z"), id: "fs-abc" },
    ];
    const merged = mergeSnapshots(previous, []) as M[];
    expect(merged.filter((x) => x.home === "SC Magdeburg")).toHaveLength(2);
    expect(merged).toHaveLength(3);
    // Une fois réparée puis re-fusionnée, il n'en reste qu'une.
    const repaired = merged.map((x) => ({ ...x }));
    expect(repairMissingTimes(repaired)).toBe(1);
    const final = mergeSnapshots(repaired, []) as M[];
    const mag = final.filter((x) => x.home === "SC Magdeburg");
    expect(mag).toHaveLength(1);
    expect(mag[0].time).toBe("2026-09-30T17:00:00.000Z");
    expect(final).toHaveLength(2);
  });

  test("un score final protège la ligne fantôme (elle reste dans l'historique)", () => {
    // Sans heure MAIS avec score : le match est terminé, il sert aux résultats
    // et son statut l'exclut du calendrier. Le retirer perdrait un résultat.
    const rows = [
      { ...m("Stjarnan W", "Haukar W", "", "28 - 32"), id: "fs-IXgKprxK" },
      { ...m("Stjarnan W", "Haukar W", "", ""), id: "fs-IXgKprxK" },
    ];
    expect(dropUnplaceable(rows)).toHaveLength(1);
    expect((dropUnplaceable(rows)[0] as M).score).toBe("28 - 32");
  });

  test("deux matchs HOMONYMES sans id (legacy) restent distincts", () => {
    const all: M[] = [];
    const seen = new Map<string, number>();
    pushUnique(all, seen, m("A", "B", "19:00"));
    pushUnique(all, seen, m("A", "B", "21:00"));
    expect(all).toHaveLength(2);
  });
});

// ─── parseDay : l'id ne doit pas swallow la clé de kickoff collée ───
//
// Mesuré sur le flux : `<id><2 octets invalides>AD÷<epoch>` sur la ligne `~AA÷`.
// Non traité, le suffixe entrait dans `id` → clé de fusion différente de celle
// du jumeau, donc jamais fusionnés (2 matchs/jour fantômes).

describe("parseDay — id d'événement nettoyé", () => {
  const junk = "\uFFFD\uFFFD";
  const feed = [
    "~ZA÷GERMANY: Bundesliga",
    `~AA÷zq9b1N4U${junk}AD÷1791633600`,
    "AE÷GOG W",
    "AF÷Aarhus Handbold W",
  ].join("¬");

  test("l'id ne contient que le tiret alphanumérique", () => {
    const parsed = parseDay(feed) as unknown as { id: string; time: string }[];
    expect(parsed).toHaveLength(1);
    expect(parsed[0].id).toBe("fs-zq9b1N4U");
  });

  test("sans nettoyage, l'id pollué ne peut pas rejoindre son jumeau", () => {
    const polluted = { id: `fs-zq9b1N4U${junk}AD÷1791633600`, home: "GOG W", away: "Aarhus Handbold W", time: "" };
    const clean = { id: "fs-zq9b1N4U", home: "GOG W", away: "Aarhus Handbold W", time: "2026-10-02T04:00:00.000Z" };
    expect(snapshotKey(polluted)).not.toBe(snapshotKey(clean));
    expect(snapshotKey(clean)).not.toBe(snapshotKey({ ...clean, time: "" }));
    // La clé ne dépend QUE de l'identité du match, pas de son heure manquante.
    expect(snapshotKey({ ...clean, time: "" })).not.toBe(snapshotKey(clean));
  });

  test("deux matchs différents ne partagent JAMAIS la clé complète", () => {
    const base = { id: "fs-x", home: "A", away: "B", time: "t" };
    expect(snapshotKey(base)).not.toBe(snapshotKey({ ...base, id: "fs-y" }));
    expect(snapshotKey(base)).not.toBe(snapshotKey({ ...base, home: "C" }));
    expect(snapshotKey(base)).toBe(snapshotKey({ ...base }));
  });
});
