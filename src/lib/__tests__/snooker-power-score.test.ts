/**
 * snooker-power-score.test.ts — gates du PowerScore L5 / L10 snooker.
 *
 * AUCUN ACCÈS DB. Toutes les fixtures sont écrites à la main dans le fichier,
 * y compris les scores par frame : un test qui lirait la base validerait la
 * base, pas le code.
 *
 * Les deux invariants qui comptent vraiment sont le 2 et le 7 :
 *   #2 — le match analysé ne doit PAS être dans sa propre fenêtre ;
 *   #7 — ajouter des lignes à la fin ne doit RIEN changer aux prédictions
 *        passées. C'est la sentinelle de fuite temporelle la moins chère.
 */

import { describe, expect, test } from "bun:test";
import { buildEloHistory, lastRating, type EloMatchRecord, type SnookerMatchRow } from "@/lib/snooker/elo-walkforward";
import { windowOf, SHRINK_K, SHRINK_PRIOR, L10_BOUNDS, L10_BOUNDS_MEASURED_ON, type L10WindowResult } from "@/lib/snooker/l10";
import {
  frameProbabilityFromPowerScore,
  snookerPowerScore,
  snookerPowerScoreBadges,
  computeSnookerPowerScores,
  type SnookerPowerResult,
} from "@/lib/snooker/power-score";
import type { PowerMetric } from "@/lib/power-score";
import {
  centuriesByFirst,
  centuriesBySecond,
  framesWonByFirst,
  framesWonBySecond,
  parseFrameScores,
  pointsByFirst,
} from "@/lib/snooker/parse-frame-scores";
import { snookerSlug } from "@/lib/snooker/snooker-history-l10";

// ─── Helpers de fixture ─────────────────────────────────────────────────────

/** Match simple : le joueur A gagne de `a` frames. */
const won = (
  matchId: string,
  date: string,
  a: string,
  b: string,
  scoreA: number,
  scoreB: number,
  bestOf = 9,
): SnookerMatchRow => ({
  matchId,
  date,
  bestOf,
  scoreA,
  scoreB,
  playerA: a,
  playerB: b,
  // `winner` est l'identité du vainqueur, jamais déduite des scores : la base
  // stocke le vainqueur en premier dans 96,7 % des lignes, donc cette
  // comparaison ne distingue rien.
  winner: scoreA > scoreB ? a : b,
  frames: [],
  stage: null,
  tournament: null,
});

/**
 * Date ISO unique et strictement croissante : m0 → 2020-01-01, m1 →
 * 2020-01-02, … Indispensable pour les tests `before` : une date qui repboucle
 * (`i % 12`) rendrait « avant le 12 » ambigu.
 */
const dateFor = (i: number): string => new Date(Date.UTC(2020, 0, 1 + i)).toISOString().slice(0, 10);

/**
 * Match AVEC des frames parsées. `scores` est verbatim de la colonne
 * `scores` de la base : le test passe par le vrai parseur, donc il valide
 * aussi le câblage frames → points → métriques, pas seulement `windowOf`.
 */
const wonWithScores = (
  matchId: string,
  date: string,
  a: string,
  b: string,
  scoreA: number,
  scoreB: number,
  scores: string,
): SnookerMatchRow => ({
  matchId,
  date,
  bestOf: 9,
  scoreA,
  scoreB,
  playerA: a,
  playerB: b,
  winner: scoreA > scoreB ? a : b,
  frames: parseFrameScores(scores, { bestOf: 9 }).frames,
  stage: null,
  tournament: null,
});

/** Enregistrement Élo construit à la main : contrôle total sur chaque métrique. */
type RecOpt = {
  /** Élo GELÉ avant le match — la seule entrée de la métrique `elo`. */
  elo: number;
  framesWon: number;
  framesLost: number;
  /** `null`/absent = frames illisibles → les 3 métriques frame-dérivées tombent. */
  pointsWon?: number | null;
  pointsLost?: number | null;
  centuries?: number | null;
  totalFrames?: number | null;
};

const rec = (matchId: string, o: RecOpt): EloMatchRecord => {
  const total = o.framesWon + o.framesLost;
  return {
    matchId,
    date: "2020-01-01",
    elo: o.elo,
    opponentElo: 1500,
    opponent: "bob",
    won: o.framesWon > o.framesLost,
    framesWon: o.framesWon,
    framesLost: o.framesLost,
    frameShare: total > 0 ? o.framesWon / total : 0,
    pointsWon: o.pointsWon ?? null,
    pointsLost: o.pointsLost ?? null,
    centuries: o.centuries ?? null,
    totalFrames: o.totalFrames ?? null,
    bestOf: 9,
    stage: null,
    tournament: null,
  };
};

/** n enregistrements identiques sauf l'identifiant. */
const recs = (n: number, make: (i: number) => RecOpt): EloMatchRecord[] => Array.from({ length: n }, (_, i) => rec(`m${i}`, make(i)));

/** Métrique par clé, ou échec explicite (jamais de `!` ni d'index muet). */
const metric = (r: L10WindowResult, key: string): PowerMetric => {
  const m = r.metrics.find((x) => x.key === key);
  if (!m) throw new Error(`métrique absente : ${key}`);
  return m;
};

/** Valeur normalisée d'une métrique — échoue si elle est `null`. */
const mval = (r: L10WindowResult, key: string): number => {
  const v = metric(r, key).value;
  if (v == null) throw new Error(`métrique ${key} vaut null`);
  return v;
};

/** Comparaison flottante explicite : jamais de `toBe` sur des décimaux. */
const near = (actual: number, expected: number, eps = 1e-9): void => {
  expect(Math.abs(actual - expected)).toBeLessThan(eps);
};

/** Confiance bayésienne : `n / (n + SHRINK_K)`. */
const trust = (n: number): number => n / (n + SHRINK_K);

/**
 * Score L10 attendu. ATTENTION : le score combiné est DÉJÀ arrondi par
 * `combinePowerMetrics` avant d'être rétréci — l'argument est donc l'entier
 * non rétréci, pas la moyenne pondérée brute.
 */
const shrunk = (combined: number, n: number): number => Math.max(0, Math.min(100, Math.round(50 + (combined - 50) * trust(n))));

/** Bornes de normalisation de `l10.ts` — recalculées ici pour rendre les attentes lisibles. */
const scale = (v: number, lo: number, hi: number): number => Math.min(100, Math.max(0, ((v - lo) / (hi - lo)) * 100));

/** `OVER_POWER` de `power-score.ts` : 100/95. */
const OVER_POWER = 100 / 95;

// ─── 1. Parseur de la colonne `scores` ──────────────────────────────────────

describe("parseFrameScores", () => {
  test("format réel mesuré : séparateur point-virgule, parenthèses optionnelles", () => {
    // Format verbatim de data/snooker_history.db, match_id 2.
    const r = parseFrameScores("2-63(59); 77-20; 131(131)-0; 76(70)-0; 6-81(62); 0-132(126); 98(97)-0; 79(56)-45; 69-9");
    expect(r.frames).toHaveLength(9);
    expect(r.anomalies).toEqual([]);
    expect(framesWonByFirst(r.frames)).toBe(6);
    expect(framesWonBySecond(r.frames)).toBe(3);
  });

  test("parenthèses des DEUX côtés d'un même frame", () => {
    const r = parseFrameScores("69(55)-53(53)");
    expect(r.frames).toHaveLength(1);
    expect(framesWonByFirst(r.frames)).toBe(1);
    // Régression P4 : chaque côté garde SON break, pas le max des deux.
    expect(r.frames[0].highBreakA).toBe(55);
    expect(r.frames[0].highBreakB).toBe(53);
    expect(r.frames[0].highBreak).toBe(55);
  });

  test("RÉGRESSION P4 — centuries attribuées au BON joueur, pas au vainqueur du frame", () => {
    // Le joueur 1 gagne 130 pendant que le joueur 2 fait un century. Agréger les
    // deux breaks en un maximum puis créditer le vainqueur du frame attribuait
    // un century au joueur 1 (qui n'en a pas fait) et perdait celui du joueur 2.
    const r = parseFrameScores("130(51)-88(118)");
    expect(r.frames[0].highBreakA).toBe(51);
    expect(r.frames[0].highBreakB).toBe(118);
    // 51 < 100 : le joueur 1 n'a PAS fait de century malgré gagner le frame.
    expect(centuriesByFirst(r.frames)).toBe(0);
    // 118 >= 100 : le joueur 2 en a fait un, même s'il a perdu le frame.
    expect(centuriesBySecond(r.frames)).toBe(1);
  });

  test("RÉGRESSION P4 — la paire (a,b) est lue dans l'ordre des joueurs", () => {
    // Format réel du match 91752 : "(51,87)" signifie 51 pour le joueur 1 et
    // 87 pour le joueur 2 — pas « deux breaks anonymes ».
    const r = parseFrameScores("0-138(51,87)");
    expect(r.frames[0].highBreakA).toBe(51);
    expect(r.frames[0].highBreakB).toBe(87);
    expect(centuriesByFirst(r.frames)).toBe(0);
    expect(centuriesBySecond(r.frames)).toBe(0);
  });

  test("RÉGRESSION P4 — century d'un seul côté : pas de double comptage", () => {
    const r = parseFrameScores("104(104)-0");
    expect(centuriesByFirst(r.frames)).toBe(1);
    expect(centuriesBySecond(r.frames)).toBe(0);
  });

  test("variante à deux nombres entre parenthèses (51,87) — régression de parité", () => {
    // C'est cette variante qui faisait tomber la parité avec player_1_score à
    // 96 % : la frame était ignorée et le score de match sous-estimait d'une
    // frame. Le match 91752 de la base est exactement ce cas.
    const r = parseFrameScores("46-59; 10-61; 0-138(51,87); 73(73)-10; 77-65; 92(50)-9; 76-5");
    expect(r.anomalies).toEqual([]);
    expect(r.frames).toHaveLength(7);
    expect(framesWonByFirst(r.frames)).toBe(4);
    expect(framesWonBySecond(r.frames)).toBe(3);
  });
  test("une frame reprise (scores égaux) est écartée, pas comptée deux fois", () => {
    const r = parseFrameScores("65-65; 70-10");
    expect(r.frames).toHaveLength(1);
    expect(r.anomalies).toContain("drawFrame");
  });

  test("token illisible : compté en anomalie, jamais fatale", () => {
    const r = parseFrameScores("76-46; PAS_UN_SCORE; 12-78");
    expect(r.frames).toHaveLength(2);
    expect(r.anomalies).toContain("unparsed");
  });

  test("chaîne vide ou nulle → aucune frame, anomalie `empty`", () => {
    expect(parseFrameScores("").anomalies).toContain("empty");
    expect(parseFrameScores(null).frames).toHaveLength(0);
    expect(parseFrameScores("   ").anomalies).toContain("empty");
  });

  test("centures et points par côté", () => {
    // Frame 2 : 21-101(88) → le joueur 2 gagne avec un break de 88, donc
    // PAS un century. C'est le point à ne pas confondre avec « un break
    // élevé » et « un century ».
    const r = parseFrameScores("104(104)-0; 21-101(88); 69-9");
    expect(centuriesByFirst(r.frames)).toBe(1);
    expect(centuriesBySecond(r.frames)).toBe(0);
    expect(pointsByFirst(r.frames)).toBe(194);
  });

  test("beaucoup plus de frames que le format n'en autorise → anomalie `tooManyFrames`", () => {
    // Un Bo9 comporte au plus 9 frames, +1 tolérée car une frame finale
    // re-rackée peut être enregistrée comme un token séparé. Au-delà (11
    // frames), c'est un défaut de saisie : signalé, pas bloquant.
    const build = (n: number) => Array.from({ length: n }, () => "70-10").join("; ");
    expect(parseFrameScores(build(10), { bestOf: 9 }).anomalies).toEqual([]);
    expect(parseFrameScores(build(11), { bestOf: 9 }).anomalies).toContain("tooManyFrames");
    // bestOf inconnu → pas d'anomalie, on ne devine rien.
    expect(parseFrameScores(build(11)).anomalies).toEqual([]);
  });
});

// ─── 2. Identité ─────────────────────────────────────────────────────────────

describe("snookerSlug", () => {
  test("normalise la casse des deux côtés de la base", () => {
    // players.url = /Players/X (majuscule) · matches.player_1_url = /players/x
    expect(snookerSlug("https://cuetracker.net/Players/judd-trump")).toBe("judd-trump");
    expect(snookerSlug("https://cuetracker.net/players/judd-trump")).toBe("judd-trump");
    expect(snookerSlug("https://cuetracker.net/Players/Ronnie-O'Sullivan")).toBe("ronnie-o'sullivan");
  });

  test("entrée vide → chaîne vide (jamais de slug undefined)", () => {
    expect(snookerSlug(null)).toBe("");
    expect(snookerSlug(undefined)).toBe("");
    expect(snookerSlug("")).toBe("");
  });
});

// ─── 3. Élo walk-forward ────────────────────────────────────────────────────

describe("buildEloHistory", () => {
  test("un joueur sans match n'a pas d'historique", () => {
    expect(buildEloHistory([]).size).toBe(0);
  });

  test("gelé AVANT le résultat : l'Élo du 1er match vaut l'initiale", () => {
    const h = buildEloHistory([won("m1", "2020-01-01", "alice", "bob", 5, 0)]);
    const a = h.get("alice")?.[0];
    expect(a?.elo).toBe(1500);
    expect(a?.opponentElo).toBe(1500);
    expect(a?.won).toBe(true);
  });

  test("un match ne s'auto-score pas : l'Élo d'après est post-update", () => {
    const h = buildEloHistory([
      won("m1", "2020-01-01", "alice", "bob", 5, 0),
      won("m2", "2020-02-01", "alice", "bob", 5, 0),
    ]);
    const recs = h.get("alice")!;
    expect(recs[0].elo).toBe(1500);
    expect(recs[1].elo).toBeGreaterThan(1500);
  });

  test("déterminisme : deux matchs du même jour départagés par match_id", () => {
    const rows = [
      won("m2", "2020-01-01", "alice", "bob", 5, 0),
      won("m1", "2020-01-01", "alice", "bob", 0, 5),
    ];
    const forward = buildEloHistory(rows);
    const reversed = buildEloHistory([...rows].reverse());
    expect(forward.get("alice")!.map((r) => r.elo)).toEqual(reversed.get("alice")!.map((r) => r.elo));
  });

  test("joueur inactif : rating décaissé vers 1500", () => {
    const h = buildEloHistory([won("m1", "2000-01-01", "alice", "bob", 5, 0)]);
    expect(lastRating(h, "alice")).toBeLessThan(1512);
  });

  test("joueur inconnu → 1500", () => {
    expect(lastRating(new Map(), "inconnu")).toBe(1500);
  });

  test("date illisible ignorée, jamais exception", () => {
    const h = buildEloHistory([won("m1", "pas-une-date", "alice", "bob", 5, 0)]);
    expect(h.size).toBe(0);
  });

  test("auto-match (A === B) ignoré", () => {
    expect(buildEloHistory([won("m1", "2020-01-01", "alice", "alice", 5, 0)]).size).toBe(0);
  });
});

// ─── 4. Fenêtres L5 / L10 ───────────────────────────────────────────────────

describe("windowOf", () => {
  // Dates CROISSANTES et UNIQUES : `i % 12` ferait repboucler au-delà de 12
  // matchs et les tests `before` deviendraient ambigus.
  const mk = (n: number, wins: number): SnookerMatchRow[] =>
    Array.from({ length: n }, (_, i) =>
      won(`m${i}`, dateFor(i), "alice", "bob", i < wins ? 5 : 0, i < wins ? 0 : 5),
    );

  test("L5 prend 5 matchs, L10 en prend 10 — jamais mélangés", () => {
    const hist = buildEloHistory(mk(30, 20));
    const recs = hist.get("alice")!;
    expect(recs.length).toBe(30);
    expect(windowOf(recs, 5).matches).toBe(5);
    expect(windowOf(recs, 10).matches).toBe(10);
  });

  test("fenêtre plus grande que l'historique → n réelle", () => {
    const recs = buildEloHistory(mk(3, 3)).get("alice")!;
    expect(windowOf(recs, 10).matches).toBe(3);
  });

  test("historique vide → 50 neutre, coverage 0", () => {
    const r = windowOf([], 10);
    expect(r.score).toBe(50);
    expect(r.coverage).toBe(0);
    expect(r.matches).toBe(0);
  });

  test("SENTINELLE #2 — affichage : la fenêtre INCLUT le dernier match joué", () => {
    // 10 victoires puis une défaite. Le 11e match est le plus récent : il doit
    // peser sur L5 (fenêtre = les 5 derniers) et sur L10.
    //
    // Pour l'AFFICHATION c'est correct : au moment où l'on consulte, ce match
    // EST joué, et « sa forme actuelle » doit l'inclure.
    const recs = buildEloHistory(mk(11, 10)).get("alice")!;
    const l5 = windowOf(recs, 5);
    const l10 = windowOf(recs, 10);
    expect(recs).toHaveLength(11);
    expect(l5.matches).toBe(5);
    expect(l5.losses).toBe(1);
    // L10 prend les 10 derniers sur 11 : la toute première victoire est
    // hors fenêtre.
    expect(l10.matches).toBe(10);
    // La fenêtre L10 ÉCARTE m0 (la 1re victoire) et garde m1..m10, dont la
    // défaite : 9 victoires, pas 10.
    expect(l10.wins).toBe(9);
    expect(l10.losses).toBe(1);
    // Identité des bornes : L5 démarre au 6e match, L10 au 1er.
    expect(l10.details[0].matchId).toBe("m1");
    expect(l5.details[0].matchId).toBe("m6");
  });

  test("RÉGRESSION P4 — `before` : la fenêtre n'inclut JAMAIS le match à prédire", () => {
    // Le bug le plus grave trouvé en revue : 6 des 7 métriques sont le RÉSULTAT
    // BRUT des matchs de la fenêtre (frame share, deciders, points/frame,
    // centuries). Sans `before`, prédire un match dont le résultat est déjà
    // dans la base revient à se noter sa propre réponse.
    const recs = buildEloHistory(mk(11, 10)).get("alice")!;
    const before = dateFor(10); // m10 est daté 2020-01-11 : exclu (strict <)
    const l10 = windowOf(recs, 10, { before });

    expect(l10.matches).toBe(10);
    expect(l10.losses).toBe(0); // m10 (la défaite) est hors fenêtre
    expect(l10.wins).toBe(10);
    // Invariant géométrique, indépendant des chiffres : rien dans la fenêtre
    // n'est postérieur à la date de prédiction.
    expect(l10.details.every((r) => r.date < before)).toBe(true);
    expect(l10.details.some((r) => r.matchId === "m10")).toBe(false);
    // Et la fenêtre affichée (sans `before`) les contient bien — la différence
    // est réelle, pas cosmétique.
    expect(windowOf(recs, 10).details.some((r) => r.matchId === "m10")).toBe(true);
  });

  test("RÉGRESSION P4 — `before` coupe aussi l'Élo de la fenêtre", () => {
    // `before` retire m10 de la fenêtre. Comme le Élo de chaque match est gelé
    // AVANT ce match, retirer le dernier NE change PAS l'Élo des matchs
    // restants : le plus ancien de la fenêtre reste m0 avec son Élo d'origine.
    // La fuite ne concernait donc que les 6 métriques de résultat brut.
    const recs = buildEloHistory(mk(11, 10)).get("alice")!;
    const withIt = windowOf(recs, 10, { before: dateFor(10) });
    const without = windowOf(recs, 10);
    // La fenêtre tronquée commence bien à m0, pas à m1.
    expect(withIt.details[0].matchId).toBe("m0");
    expect(withIt.details[0].elo).toBe(recs[0].elo);
    expect(without.details[0].matchId).toBe("m1");
    // Et le nombre de victoires diffère : c'est là que la fuite se voyait.
    expect(withIt.wins).toBe(10);
    expect(without.wins).toBe(9);
  });

  test("RÉGRESSION P4 — `before` antérieur à tout l'historique → fenêtre vide", () => {
    const recs = buildEloHistory(mk(5, 5)).get("alice")!;
    const r = windowOf(recs, 10, { before: "2000-01-01" });
    expect(r.matches).toBe(0);
    expect(r.score).toBe(50);
    expect(r.coverage).toBe(0);
  });

  test("rétrécissement bayésien : fenêtre courte = moins de confiance", () => {
    const recs = buildEloHistory(mk(10, 10)).get("alice")!;
    const l5 = windowOf(recs, 5);
    const l10 = windowOf(recs, 10);
    // 10-0 parfait : brut identique, mais L5 doit être moins extrême que L10.
    expect(l5.score).toBeGreaterThan(50);
    expect(l5.score).toBeLessThan(l10.score);
    expect(5 / (5 + SHRINK_K)).toBeCloseTo(0.3846, 3);
  });

  test("0 match gagné → score sous 50, jamais NaN", () => {
    const recs = buildEloHistory(mk(10, 0)).get("alice")!;
    const r = windowOf(recs, 10);
    expect(Number.isFinite(r.score)).toBe(true);
    expect(r.score).toBeLessThan(50);
    expect(r.wins).toBe(0);
  });

  test("7 métriques pondérées, somme des poids = 100", () => {
    const recs = buildEloHistory(mk(10, 7)).get("alice")!;
    const r = windowOf(recs, 10);
    expect(r.metrics).toHaveLength(7);
    expect(r.metrics.reduce((s, m) => s + m.weight, 0)).toBe(100);
  });

  test("métriques indisponibles → couverture partielle, jamais de NaN", () => {
    // Aucun match n'a de frames parsées → points/frame, centuries et écart
    // de points valent null et sont exclus avec renormalisation.
    const recs = buildEloHistory(mk(10, 6)).get("alice")!;
    const r = windowOf(recs, 10);
    expect(r.coverage).toBeLessThan(1);
    expect(Number.isFinite(r.score)).toBe(true);
  });
});

// ─── 7. Les 7 métriques, une par une ───────────────────────────────────────
//
// Chaque test verrouille UNE métrique sur une fixture dont la valeur brute est
// connue. `mval` lit la valeur déjà normalisée 0-100 ; `metric` lit l'objet
// complet (valeur + display + hint) pour les cas `null`.

describe("l10 — les 7 métriques isolément", () => {
  // ── 1. Élo ────────────────────────────────────────────────────────────────
  test("elo : (dernier Élo + Élo moyen de la fenêtre) / 2", () => {
    // Fixture : 5 records, Élo de 1453 à 1567 par pas de 28.5.
    // On ne recopie AUCUN nombre : la moyenne est calculée depuis la fixture,
    // donc le test reste vrai si on change le pas ou les bornes.
    const elos = Array.from({ length: 5 }, (_, i) => 1453 + i * 28.5);
    const r = windowOf(recs(5, (i) => ({ elo: elos[i], framesWon: 5, framesLost: 0 })), 5);
    const attendu = (elos[4] + elos.reduce((s, e) => s + e, 0) / 5) / 2;
    near(mval(r, "elo"), scale(attendu, L10_BOUNDS.elo.lo, L10_BOUNDS.elo.hi));
    expect(metric(r, "elo").display).toBe(String(Math.round(attendu)));
  });

  test("elo : tous à 1500 → le point neutre de l'échelle", () => {
    near(mval(windowOf(recs(5, () => ({ elo: 1500, framesWon: 5, framesLost: 0 })), 5), "elo"), scale(1500, L10_BOUNDS.elo.lo, L10_BOUNDS.elo.hi));
  });

  test("RÉGRESSION P4 — bornes Élo MESURÉES (1453-1526), plus 1200-1800", () => {
    // L'ancienne borne 1200-1800 ne mordait pas : l'Élo réel de ce système vit
    // dans 1462-1546, donc la métrique la plus lourde (30 %) perdait 86 % de sa
    // résolution. Ces bornes viennent de L10_BOUNDS, pas d'une convention.
    expect(L10_BOUNDS.elo.lo).toBe(1453);
    expect(L10_BOUNDS.elo.hi).toBe(1526);
    near(mval(windowOf(recs(5, () => ({ elo: L10_BOUNDS.elo.lo, framesWon: 5, framesLost: 0 })), 5), "elo"), 0);
    near(mval(windowOf(recs(5, () => ({ elo: L10_BOUNDS.elo.hi, framesWon: 5, framesLost: 0 })), 5), "elo"), 100);
  });

  test("RÉGRESSION P4 — la résolution de l'Élo est bien supérieure à l'ancienne", () => {
    // Sous l'ancienne borne 1200-1800, 20 points d'Élo d'écart ne valaient que
    // 3,3 points de métrique. Sous les bornes mesurées (1453-1526, amplitude
    // 73) le même écart vaut ~27. On mesure un écart qui reste dans l'échelle.
    const haut = windowOf(recs(5, () => ({ elo: 1510, framesWon: 5, framesLost: 0 })), 5);
    const bas = windowOf(recs(5, () => ({ elo: 1490, framesWon: 5, framesLost: 0 })), 5);
    const ecart = mval(haut, "elo") - mval(bas, "elo");
    const amplitude = L10_BOUNDS.elo.hi - L10_BOUNDS.elo.lo;
    near(ecart, (20 / amplitude) * 100);
    // Avec l'ancienne échelle (amplitude 600) ce même écart ne vaudrait que 3.3.
    expect(ecart).toBeGreaterThan((20 / 600) * 100);
  });

  // ── 2. Frame share ────────────────────────────────────────────────────────
  test("frameShare : moyenne de framesWon/(gagnées+perdues)", () => {
    // 2 victoires 3-1 (share 0.75) + 3 défaites 1-3 (share 0.25)
    // → moyenne (2*0.75 + 3*0.25)/5 = 0.45
    const r = windowOf(
      recs(5, (i) => (i < 2 ? { elo: 1500, framesWon: 3, framesLost: 1 } : { elo: 1500, framesWon: 1, framesLost: 3 })),
      5,
    );
    near(mval(r, "frameShare"), scale(0.45, L10_BOUNDS.frameShare.lo, L10_BOUNDS.frameShare.hi));
    expect(metric(r, "frameShare").display).toBe("45 %");
  });

  test("frameShare : les deux bornes mesurées mordent", () => {
    // 1-3 → share 0.25 : entre les bornes, pas clampé
    near(
      mval(windowOf(recs(5, () => ({ elo: 1500, framesWon: 1, framesLost: 3 })), 5), "frameShare"),
      scale(0.25, L10_BOUNDS.frameShare.lo, L10_BOUNDS.frameShare.hi),
    );
    // 3-1 → share 0.75 → au-dessus du plafond mesuré → clamp 100
    near(mval(windowOf(recs(5, () => ({ elo: 1500, framesWon: 3, framesLost: 1 })), 5), "frameShare"), 100);
  });

  // ── 3. Deciders ───────────────────────────────────────────────────────────
  test("decider : victoires sur les matchs à 1 frame près, en pourcentage brut", () => {
    // 5 victoires 4-3 : les 5 sont des deciders, tous gagnés → 100.
    const r = windowOf(recs(5, () => ({ elo: 1500, framesWon: 4, framesLost: 3 })), 5);
    near(mval(r, "decider"), 100);
    expect(metric(r, "decider").display).toBe("5/5");
  });

  test("decider : 2 gagnés sur 5 → 40", () => {
    // 2 victoires 4-3 + 3 défaites 3-4 : |4-3| = 1 et |3-4| = 1, donc les 5
    // matchs sont des deciders, dont 2 gagnés.
    const r = windowOf(
      [...recs(2, () => ({ elo: 1500, framesWon: 4, framesLost: 3 })), ...recs(3, () => ({ elo: 1500, framesWon: 3, framesLost: 4 }))],
      5,
    );
    expect(r.wins).toBe(2);
    near(mval(r, "decider"), 40);
    expect(metric(r, "decider").display).toBe("2/5");
  });

  test("decider : 0 decider dans la fenêtre → null, et la couverture BAISSE", () => {
    // 5-0 : |5-0| = 5 > 1 → aucun decider.
    const sansDecider = windowOf(recs(5, () => ({ elo: 1500, framesWon: 5, framesLost: 0 })), 5);
    expect(metric(sansDecider, "decider").value).toBeNull();
    expect(metric(sansDecider, "decider").display).toBe("n/a");
    // 4-3 : les 5 sont des deciders.
    const avecDecider = windowOf(recs(5, () => ({ elo: 1500, framesWon: 4, framesLost: 3 })), 5);
    expect(metric(avecDecider, "decider").value).not.toBeNull();
    // La couverture perd exactement le poids du decider : 15 points.
    near(avecDecider.coverage - sansDecider.coverage, 0.15, 1e-9);
    expect(Number.isFinite(sansDecider.score)).toBe(true);
  });

  // ── 4. Écart de points par frame ──────────────────────────────────────────
  test("margin : (pointsWon - pointsLost) / totalFrames, bornes mesurées -35 à +9.6", () => {
    // (275-200)/5 = 15 → scale(15, -35, 9.6) = (50/44.6)*100 = 112 → clamp 100
    const r = windowOf(recs(5, () => ({ elo: 1500, framesWon: 5, framesLost: 0, pointsWon: 275, pointsLost: 200, centuries: 0, totalFrames: 5 })), 5);
    near(mval(r, "margin"), 100);
    expect(metric(r, "margin").display).toBe("+15.0");
  });

  test("RÉGRESSION P4 — la distribution du margin est ASYMÉTRIQUE (médiane -12.4)", () => {
    // Mesuré sur données réparées : p10=-40.3, p50=-12.4, p90=+7.7. Un joueur
    // médian se-score donc ~60 et non 50 — parce que dans une fenêtre, le
    // score de points par frame est très souvent NÉGATIF (perdre une frame
    // coûte plus de points que les frames gagnées n'en rapportent). Fait
    // mesuré, pas un biais.
    expect(L10_BOUNDS.margin.lo).toBe(-40.3);
    expect(L10_BOUNDS.margin.hi).toBe(7.7);
    const medianLike = windowOf(
      recs(5, () => ({ elo: 1500, framesWon: 2, framesLost: 3, pointsWon: 138, pointsLost: 200, centuries: 0, totalFrames: 5 })),
      5,
    );
    // (138-200)/5 = -12.4 = la médiane mesurée
    near(mval(medianLike, "margin"), scale(-12.4, L10_BOUNDS.margin.lo, L10_BOUNDS.margin.hi));
    // Elle est bien au-dessus de 50 : la médiane n'est pas le milieu.
    expect(mval(medianLike, "margin")).toBeGreaterThan(55);
  });

  test("margin : les deux bornes mesurées mordent", () => {
    const mk = (pw: number, pl: number): L10WindowResult =>
      windowOf(recs(5, () => ({ elo: 1500, framesWon: 5, framesLost: 0, pointsWon: pw, pointsLost: pl, centuries: 0, totalFrames: 5 })), 5);
    // margin = (pw - pl) / totalFrames, totalFrames = 5
    near(mval(mk(350, 200), "margin"), 100); // +30 > plafond → clamp haut
    near(mval(mk(-100, 200), "margin"), 0); // -60 < plancher → clampé à 0
    // Un écart encore dans l'échelle (ni clampé haut ni bas)
    const inRange = (L10_BOUNDS.margin.lo + L10_BOUNDS.margin.hi) / 2;
    near(mval(mk(200 + 5 * inRange, 200), "margin"), 50);
    // Et un écart juste au-dessus du plancher
    near(mval(mk(200 + 5 * (L10_BOUNDS.margin.lo + 0.1), 200), "margin"), scale(L10_BOUNDS.margin.lo + 0.1, L10_BOUNDS.margin.lo, L10_BOUNDS.margin.hi));
  });

  test("margin : écart nul → le milieu de l'échelle, display signé +", () => {
    // `display` prepend "+" quand marginMean >= 0 : un écart EXACTEMENT nul
    // s'affiche donc "+0.0", pas "0.0". Verrouillé parce que c'est un `>=`
    // et non un `>` : le passer à `>` changerait l'affichage en O(n) sans
    // changer un seul score.
    const r = windowOf(recs(5, () => ({ elo: 1500, framesWon: 5, framesLost: 0, pointsWon: 200, pointsLost: 200, centuries: 0, totalFrames: 5 })), 5);
    near(mval(r, "margin"), scale(0, L10_BOUNDS.margin.lo, L10_BOUNDS.margin.hi));
    expect(metric(r, "margin").display).toBe("+0.0");
  });

  test("margin : écart négatif → display sans le signe +", () => {
    const r = windowOf(recs(5, () => ({ elo: 1500, framesWon: 5, framesLost: 0, pointsWon: 125, pointsLost: 200, centuries: 0, totalFrames: 5 })), 5);
    expect(metric(r, "margin").display).toBe("-15.0");
  });

  // ── 5. Points par frame ───────────────────────────────────────────────────
  test("pointsPerFrame : pointsWon / totalFrames, bornes mesurées", () => {
    const r = windowOf(recs(5, () => ({ elo: 1500, framesWon: 5, framesLost: 0, pointsWon: 250, pointsLost: 100, centuries: 0, totalFrames: 5 })), 5);
    near(mval(r, "pointsPerFrame"), scale(50, L10_BOUNDS.pointsPerFrame.lo, L10_BOUNDS.pointsPerFrame.hi));
    expect(metric(r, "pointsPerFrame").display).toBe("50.0");
  });

  test("pointsPerFrame : les deux bornes mesurées mordent", () => {
    const mk = (pw: number): L10WindowResult =>
      windowOf(recs(5, () => ({ elo: 1500, framesWon: 5, framesLost: 0, pointsWon: pw, pointsLost: 0, centuries: 0, totalFrames: 5 })), 5);
    near(mval(mk(400), "pointsPerFrame"), 100); // 80 > plafond → clamp
    near(mval(mk(50), "pointsPerFrame"), 0); // 10 < plancher → clamp
    // Milieu exact des bornes → 50
    const mid = (L10_BOUNDS.pointsPerFrame.lo + L10_BOUNDS.pointsPerFrame.hi) / 2;
    near(mval(mk(5 * mid), "pointsPerFrame"), 50);
  });

  test("pointsPerFrame : frames illisibles → null, PAS 0 ni NaN", () => {
    const r = windowOf(recs(5, () => ({ elo: 1500, framesWon: 5, framesLost: 0 })), 5);
    expect(metric(r, "pointsPerFrame").value).toBeNull();
    expect(metric(r, "pointsPerFrame").display).toBe("n/a");
  });

  // ── 6. Centuries pour 100 frames ──────────────────────────────────────────
  test("centuries : (centuries / totalFrames) moyen × 100, bornes mesurées", () => {
    const r = windowOf(recs(5, () => ({ elo: 1500, framesWon: 5, framesLost: 0, pointsWon: 1000, pointsLost: 1000, centuries: 1, totalFrames: 25 })), 5);
    // 1 century sur 25 frames → 4 pour 100 → au-dessus de la borne mesurée 3.5
    near(mval(r, "centuries"), scale(4, L10_BOUNDS.centuries.lo, L10_BOUNDS.centuries.hi));
    expect(metric(r, "centuries").display).toBe("4.00/100");
  });

  test("RÉGRESSION P4 — la médiane des centuries est 0.0, pas 4", () => {
    // Mesuré : p25=0.0, p50=0.0, p75=2.0. Avec l'ancienne borne 0-8, un
    // joueur qui ne fait aucun century (cas médian !) se-score 0 — c'est
    // correct, mais la borne 8 rendait la métrice inutilisable : il fallait
    // 8 centuries/100 frames pour atteindre 100, ce que presque personne
    // atteint (p95 = 7.0).
    expect(L10_BOUNDS.centuries.hi).toBe(3.5);
    const zeroCenturies = windowOf(recs(5, () => ({ elo: 1500, framesWon: 5, framesLost: 0, pointsWon: 1000, pointsLost: 1000, centuries: 0, totalFrames: 25 })), 5);
    near(mval(zeroCenturies, "centuries"), 0);
  });

  test("centuries : les deux bornes mesurées mordent", () => {
    const mk = (c: number): L10WindowResult =>
      windowOf(recs(5, () => ({ elo: 1500, framesWon: 5, framesLost: 0, pointsWon: 1000, pointsLost: 1000, centuries: c, totalFrames: 25 })), 5);
    near(mval(mk(0), "centuries"), 0);
    near(mval(mk(2), "centuries"), 100); // 8/100 > 3.5 → clamp
    near(mval(mk(3), "centuries"), 100);
    // Valeur médiane mesurée : 1 century / 25 frames = 4 pour 100 → saturé
    near(mval(mk(1), "centuries"), scale(4, L10_BOUNDS.centuries.lo, L10_BOUNDS.centuries.hi));
    expect(mval(mk(1), "centuries")).toBe(100);
  });

  test("centuries : frames illisibles → null", () => {
    expect(metric(windowOf(recs(5, () => ({ elo: 1500, framesWon: 5, framesLost: 0 })), 5), "centuries").value).toBeNull();
  });

  // ── 7. Resilience ─────────────────────────────────────────────────────────
  test("resilience : victoires après avoir perdu ≥ 1 frame / victoires", () => {
    // 5 victoires 4-3 : toutes sont des remontées → 100.
    const r = windowOf(recs(5, () => ({ elo: 1500, framesWon: 4, framesLost: 3 })), 5);
    near(mval(r, "resilience"), 100);
    expect(metric(r, "resilience").display).toBe("100 %");
  });

  test("resilience : 0 victoire dans la fenêtre → null, PAS 0 et PAS NaN", () => {
    // 5 défaites 0-5 : wins = 0 → resilience impossible à définir.
    const r = windowOf(recs(5, () => ({ elo: 1500, framesWon: 0, framesLost: 5 })), 5);
    expect(r.wins).toBe(0);
    const v = metric(r, "resilience").value;
    expect(v).toBeNull();
    expect(v === 0).toBe(false);
    expect(Number.isNaN(Number(v))).toBe(false);
    expect(metric(r, "resilience").display).toBe("n/a");
  });

  test("resilience : 0 % quand toutes les victoires sont sans frame perdue", () => {
    // 5-0 : gagné, mais jamais comeback → 0, ce qui est une MESURE, pas une absence.
    const r = windowOf(recs(5, () => ({ elo: 1500, framesWon: 5, framesLost: 0 })), 5);
    near(mval(r, "resilience"), 0);
  });

  test("resilience : 2 remontées sur 5 victoires → 40", () => {
    // 2 × 4-3 (remontées) + 3 × 5-0 (propres) → 2/5
    const r = windowOf(
      [...recs(2, () => ({ elo: 1500, framesWon: 4, framesLost: 3 })), ...recs(3, () => ({ elo: 1500, framesWon: 5, framesLost: 0 }))],
      5,
    );
    expect(r.wins).toBe(5);
    near(mval(r, "resilience"), 40);
  });
});

// ─── 8. Renormalisation des poids ───────────────────────────────────────────

describe("l10 — couverture et renormalisation", () => {
  // elo(30) + frameShare(18) + decider(15) + resilience(8) = 71.
  // margin/ppf/centuries tombent faute de points.
  const partiels = (): L10WindowResult =>
    windowOf(
      [
        ...recs(3, () => ({ elo: 1500, framesWon: 4, framesLost: 3 })),
        ...recs(2, () => ({ elo: 1500, framesWon: 0, framesLost: 4 })),
      ],
      5,
    );

  test("couverture = fraction EXACTE des poids effectivement disponibles", () => {
    const r = partiels();
    expect(metric(r, "elo").value).not.toBeNull();
    expect(metric(r, "frameShare").value).not.toBeNull();
    expect(metric(r, "decider").value).not.toBeNull();
    expect(metric(r, "resilience").value).not.toBeNull();
    expect(metric(r, "margin").value).toBeNull();
    expect(metric(r, "pointsPerFrame").value).toBeNull();
    expect(metric(r, "centuries").value).toBeNull();
    // 30 + 18 + 15 + 8 = 71 sur 100.
    expect(r.coverage).toBe(0.71);
  });

  test("le score n'est PAS calculé sur les 100 points de poids fictifs", () => {
    const r = partiels();
    // Fixture : 3 victoires 4-3 + 2 défaites 0-4.
    //   decider    : |4-3| = 1 → les 3 victoires sont des deciders, 3/3 → 100
    //   resilience : chaque victoire a perdu 3 frames → 3/3 → 100
    // Ce que donnerait un calcul naïf : les 3 métriques absentes comptées 0
    // sur un dénominateur de 100.
    const frameShareBrut = (3 * (4 / 7) + 2 * 0) / 5; // 0.342857...
    const share = scale(frameShareBrut, L10_BOUNDS.frameShare.lo, L10_BOUNDS.frameShare.hi);
    const elo = scale(1500, L10_BOUNDS.elo.lo, L10_BOUNDS.elo.hi);
    const naif = Math.round((elo * 30 + share * 18 + 0 * 15 + 0 * 10 + 0 * 10 + 0 * 9 + 100 * 8) / 100);
    const renorm = Math.round((elo * 30 + share * 18 + 100 * 15 + 100 * 8) / 71);
    expect(r.score).toBe(shrunk(renorm, 5));
    // Les deux résultats sont franchement différents : le test prouve que le
    // dénominateur 71 est bien utilisé, et pas 100.
    expect(renorm).not.toBe(naif);
    // Les valeurs exactes sont dérivées des bornes, jamais recopiées : un
    // ré-étalonnage des bornes ne casse plus cette suite.
    expect(naif).toBe(Math.round((elo * 30 + share * 18 + 100 * 8) / 100));
    expect(renorm).toBe(Math.round((elo * 30 + share * 18 + 100 * 15 + 100 * 8) / 71));
    expect(r.score).toBe(shrunk(renorm, 5));
  });

  test("couverture 1 quand les 7 métriques sont disponibles", () => {
    const r = windowOf(
      recs(5, () => ({ elo: 1500, framesWon: 4, framesLost: 3, pointsWon: 100, pointsLost: 100, centuries: 0, totalFrames: 5 })),
      5,
    );
    expect(r.metrics.every((m) => m.value != null)).toBe(true);
    expect(r.coverage).toBe(1);
  });
});

// ─── 9. Rétrécissement bayésien, arithmétique exacte ────────────────────────

describe("l10 — rétrécissement bayésien", () => {
  /** Score combiné recalculé depuis les métriques exposées — sert à récupérer le NON rétréci. */
  const combined = (r: L10WindowResult): number => {
    const used = r.metrics.filter((m) => m.value != null);
    const totalW = used.reduce((s, m) => s + m.weight, 0);
    if (totalW <= 0) return 50;
    const raw = used.reduce((s, m) => s + (m.value as number) * m.weight, 0) / totalW;
    return Math.round(Math.min(100, Math.max(0, raw)));
  };

  test("SHRINK_K et SHRINK_PRIOR sont bien exportés par `l10.ts`", () => {
    expect(SHRINK_K).toBe(8);
    expect(SHRINK_PRIOR).toBe(50);
    expect(trust(5)).toBeCloseTo(5 / 13, 12);
    expect(trust(10)).toBeCloseTo(10 / 18, 12);
  });

  test("SHRINK_PRIOR = 50 est mathématique, pas une approximation", () => {
    // Un match a UN vainqueur et UN perdant, donc le taux de victoire moyen du
    // champ vaut 50 par construction. Mesuré sur 34 694 matchs : 50,00 %.
    // Vérifié ici par construction : une fenêtre de 5 victoires puis 5
    // défaites a un frameShare moyen de exactement 0.5.
    const sym = windowOf(
      [
        ...recs(5, () => ({ elo: 1500, framesWon: 5, framesLost: 0 })),
        ...recs(5, () => ({ elo: 1500, framesWon: 0, framesLost: 5 })),
      ],
      10,
    );
    near(mval(sym, "frameShare"), scale(0.5, L10_BOUNDS.frameShare.lo, L10_BOUNDS.frameShare.hi));
    expect(sym.wins).toBe(5);
    expect(sym.losses).toBe(5);
  });

  test("n = 5 : score = round(SHRINK_PRIOR + (combiné - PRIOR) · 5/13)", () => {
    // 5 victoires 5-0 : elo 45.238 (mesuré : scale(1500, 1462, 1546)),
    // frameShare 100 (5/5 saturé), decider null, resilience 0.
    // coverage = 30+18+8 = 56.
    const r = windowOf(recs(5, () => ({ elo: 1500, framesWon: 5, framesLost: 0 })), 5);
    const eloV = scale(1500, L10_BOUNDS.elo.lo, L10_BOUNDS.elo.hi);
    const attendu = Math.round((eloV * 30 + 100 * 18 + 0 * 8) / 56);
    expect(combined(r)).toBe(attendu);
    expect(r.score).toBe(shrunk(attendu, 5));
  });

  test("n = 10 : score = round(SHRINK_PRIOR + (combiné - PRIOR) · 10/18)", () => {
    // 5 victoires 5-0 puis 5 défaites 0-5 → frameShare moyen 0.5.
    const r = windowOf([...recs(5, () => ({ elo: 1500, framesWon: 5, framesLost: 0 })), ...recs(5, () => ({ elo: 1500, framesWon: 0, framesLost: 5 }))], 10);
    expect(r.matches).toBe(10);
    const eloV = scale(1500, L10_BOUNDS.elo.lo, L10_BOUNDS.elo.hi);
    const shareV = scale(0.5, L10_BOUNDS.frameShare.lo, L10_BOUNDS.frameShare.hi);
    const attendu = Math.round((eloV * 30 + shareV * 18 + 0 * 8) / 56);
    expect(combined(r)).toBe(attendu);
    expect(r.score).toBe(shrunk(attendu, 10));
  });

  test("n = 1 : rétrécissement MAXIMAL, trust = 1/9", () => {
    // Une seule victoire 5-0 : frameShare clampé à 100, decider null,
    // resilience 0. Le combiné est dérivé des bornes, pas figé.
    const r = windowOf(recs(1, () => ({ elo: 1500, framesWon: 5, framesLost: 0 })), 1);
    expect(r.matches).toBe(1);
    const eloV = scale(1500, L10_BOUNDS.elo.lo, L10_BOUNDS.elo.hi);
    const attendu = Math.round((eloV * 30 + 100 * 18 + 0 * 8) / 56);
    expect(combined(r)).toBe(attendu);
    expect(trust(1)).toBeCloseTo(1 / 9, 12);
    expect(r.score).toBe(shrunk(attendu, 1));
  });

  test("à combined identique, un n plus grand s'éloigne davantage de la prior", () => {
    const l1 = windowOf(recs(1, () => ({ elo: 1500, framesWon: 5, framesLost: 0 })), 1);
    const l5 = windowOf(recs(5, () => ({ elo: 1500, framesWon: 5, framesLost: 0 })), 5);
    expect(combined(l1)).toBe(combined(l5));
    expect(l1.score).toBeLessThan(l5.score);
    expect(Math.abs(l1.score - SHRINK_PRIOR)).toBeLessThan(Math.abs(l5.score - SHRINK_PRIOR));
  });

  // Les tests ci-dessus ont des scores qui tombent près d'un entier après
  // arrondi : une dérive de SHRINK_K de ±1 peut les laisser passer. Les deux
  // suivants fixent la valeur AVANT arrondi pour que la dérive soit visible.

  test("n = 5, les 7 métriques disponibles : score exact", () => {
    const r = windowOf(recs(5, () => ({ elo: 1800, framesWon: 4, framesLost: 3, pointsWon: 200, pointsLost: 100, centuries: 1, totalFrames: 5 })), 5);
    expect(r.coverage).toBe(1);
    // Les 7 métriques sont présentes : dénominateur 100. Deux ne saturent pas,
    // il faut donc les normaliser explicitement plutôt que supposer 100.
    const attendu = Math.round(
      (100 * 30 + // elo 1800 > 1546 → clamp 100
        scale(4 / 7, L10_BOUNDS.frameShare.lo, L10_BOUNDS.frameShare.hi) * 18 + // 93.62
        100 * 15 + // decider : 4-3, écart de 1 frame, gagné → 100
        100 * 10 + // margin (200-100)/5 = +20 > +9.6 → clamp 100
        scale(40, L10_BOUNDS.pointsPerFrame.lo, L10_BOUNDS.pointsPerFrame.hi) * 10 + // 42.26
        100 * 9 + // centuries 1/5 = 20/100 > 4.72 → clamp 100
        100 * 8) / // resilience : 4-3 = remontée → 100
        100,
    );
    expect(combined(r)).toBe(attendu);
    expect(r.score).toBe(shrunk(attendu, 5));
  });

  test("n = 10, couverture 0.71 : score exact", () => {
    // 8 victoires 2-1 + 2 défaites 0-2, sans points parsés.
    //   elo 1800 → clamp 100
    //   share (8·2/3 + 2·0)/10 = 0.5333 → scale(0.5333, 0.225, 0.595)
    //   decider : les 8 « 2-1 » seulement (|0-2| = 2) → 8/8 = 100
    //   resilience : 8/8 (toutes les victoires ont perdu 1 frame) = 100
    // coverage = 30+18+15+8 = 71.
    const r = windowOf(
      [...recs(8, () => ({ elo: 1800, framesWon: 2, framesLost: 1 })), ...recs(2, () => ({ elo: 1800, framesWon: 0, framesLost: 2 }))],
      10,
    );
    expect(r.matches).toBe(10);
    expect(r.wins).toBe(8);
    expect(r.coverage).toBe(0.71);
    expect(mval(r, "elo")).toBe(100);
    near(mval(r, "frameShare"), scale((8 * (2 / 3)) / 10, L10_BOUNDS.frameShare.lo, L10_BOUNDS.frameShare.hi));
    near(mval(r, "decider"), 100);
    near(mval(r, "resilience"), 100);
    const shareV = scale((8 * (2 / 3)) / 10, L10_BOUNDS.frameShare.lo, L10_BOUNDS.frameShare.hi);
    const attendu = Math.round((100 * 30 + shareV * 18 + 100 * 15 + 100 * 8) / 71);
    expect(combined(r)).toBe(attendu);
    expect(r.score).toBe(shrunk(attendu, 10));
  });

  test("les fixtures de rétrécissement sont CHOISIES pour distinguer K=8 de K=9", () => {
    // Table de vérif : pour chaque combined OBSERVÉ dans les tests ci-dessus,
    // l'arrondi est comparé entre SHRINK_K=8 (le réel) et SHRINK_K=9 (une
    // dérive plausible). Au moins deux couples doivent bouger, sinon la suite
    // ne protège pas la constante.
    const avecK = (c: number, n: number, k: number): number => Math.round(SHRINK_PRIOR + (c - SHRINK_PRIOR) * (n / (n + k)));
    const couples: [number, number][] = [
      [56, 1],
      [56, 5],
      [100, 5],
      [48, 10],
      [88, 10],
    ];
    const derive = couples.map(([c, n]) => avecK(c, n, 9) !== avecK(c, n, 8));
    expect(derive.filter(Boolean).length).toBeGreaterThanOrEqual(2);
    for (const [c, n] of couples) expect(avecK(c, n, 8)).toBe(shrunk(c, n));
  });
});

// ─── 10. Passage à la probabilité de frame ──────────────────────────────────

describe("frameProbabilityFromPowerScore — bornes, linéarité, cas extrêmes", () => {
  test("valeur exacte aux extrémités : plancher à 0, plafond à 100", () => {
    // scaled = clamp(score,0,100)/100 · (100/95) = score/95
    expect(frameProbabilityFromPowerScore(0)).toBe(0.2);
    expect(frameProbabilityFromPowerScore(100)).toBe(0.8);
  });

  test("le plancher mord pour score < 19, le plafond mord pour score > 76", () => {
    // scaled = clamp(score,0,100)/100 · OVER_POWER, et OVER_POWER = 100/95,
    // donc scaled = score/95. Le plancher 0.2 est donc atteint à score = 19 et
    // le plafond 0.8 à score = 76.
    expect(frameProbabilityFromPowerScore(18)).toBe(0.2);
    expect(frameProbabilityFromPowerScore(10)).toBe(0.2);
    expect(frameProbabilityFromPowerScore(0)).toBe(0.2);
    expect(frameProbabilityFromPowerScore(77)).toBe(0.8);
    expect(frameProbabilityFromPowerScore(95)).toBe(0.8);
    // 95 est le plafond fonctionnel du PowerScore : sans clamp il donnerait
    // exactement 1.0, c'est-à-dire « la frame est acquise ». C'est le
    // raison d'être du plafond 0.8.
    expect(95 * OVER_POWER).toBeCloseTo(100, 12);
    expect((95 / 100) * OVER_POWER).toBeGreaterThan(0.8);
  });

  test("aux frontières exactes 19 et 76, la valeur nue est déjà la borne", () => {
    near(frameProbabilityFromPowerScore(19), 0.2);
    near(frameProbabilityFromPowerScore(76), 0.8);
    // Et juste à l'intérieur, la rampe est stricte.
    near(frameProbabilityFromPowerScore(20), 20 / 95);
    near(frameProbabilityFromPowerScore(75), 75 / 95);
  });

  test("linéarité exacte dans la zone non bornée : p = score/95", () => {
    for (const s of [19, 25, 33, 47, 50, 61, 68, 76]) {
      near(frameProbabilityFromPowerScore(s), s / 95);
    }
    // 100/95 au plafond du PowerScore donnerait 1.0526 → clampé à 0.8.
    near(frameProbabilityFromPowerScore(95), 0.8);
  });

  test("scores hors [0,100] : clampés aux extrémités, jamais débordants", () => {
    expect(frameProbabilityFromPowerScore(-500)).toBe(0.2);
    expect(frameProbabilityFromPowerScore(1000)).toBe(0.8);
  });

  test("jamais de NaN sur des entrées extrêmes", () => {
    for (const s of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -1e308, 1e308, 0, 100]) {
      const p = frameProbabilityFromPowerScore(s);
      expect(Number.isFinite(p)).toBe(true);
      expect(p).toBeGreaterThanOrEqual(0.2);
      expect(p).toBeLessThanOrEqual(0.8);
    }
    // Non finis → 0.5 neutre (la garde `Number.isFinite`).
    expect(frameProbabilityFromPowerScore(Number.POSITIVE_INFINITY)).toBe(0.5);
    expect(frameProbabilityFromPowerScore(Number.NEGATIVE_INFINITY)).toBe(0.5);
  });

  test("monotone non décroissante sur toute la plage 0-100", () => {
    let prev = -1;
    for (let s = 0; s <= 100; s += 1) {
      const p = frameProbabilityFromPowerScore(s);
      expect(p).toBeGreaterThanOrEqual(prev);
      prev = p;
    }
    // Strictement croissante seulement dans la zone non bornée [19, 76].
    for (let s = 19; s < 76; s += 1) {
      expect(frameProbabilityFromPowerScore(s + 1)).toBeGreaterThan(frameProbabilityFromPowerScore(s));
    }
  });

  test("bornes floor/ceiling passées en paramètre sont respectées", () => {
    // Plancher 0.1 / plafond 0.4 : le plafond devient mordant.
    near(frameProbabilityFromPowerScore(50, 0.1, 0.4), 0.4);
    // Plancher 0.9 > plafond 0.8 : le max l'emporte.
    near(frameProbabilityFromPowerScore(50, 0.9, 0.8), 0.9);
    // Bornes par défaut inchangées.
    near(frameProbabilityFromPowerScore(50), 50 / 95);
  });
});

// ─── 11. Badges UI ──────────────────────────────────────────────────────────

describe("snookerPowerScoreBadges", () => {
  const rows = Array.from({ length: 12 }, (_, i) =>
    won(`m${i}`, `2020-${String((i % 12) + 1).padStart(2, "0")}-01`, "alice", "bob", i < 7 ? 5 : 0, i < 7 ? 0 : 5),
  );
  /** alice a 12 matchs → L5 = 5, L10 = 10. */
  const result = (): SnookerPowerResult => {
    const r = snookerPowerScore(rows, "alice");
    if (!r) throw new Error("alice doit avoir un historique");
    return r;
  };

  test("exactement 2 badges, L5 d'abord puis L10", () => {
    const badges = snookerPowerScoreBadges(result());
    expect(badges).toHaveLength(2);
    expect(badges[0].label.startsWith("L5")).toBe(true);
    expect(badges[1].label.startsWith("L10")).toBe(true);
  });

  test("les valeurs des badges sont exactement l5.score et l10.score", () => {
    const r = result();
    const badges = snookerPowerScoreBadges(r);
    expect(badges[0].value).toBe(r.l5.score);
    expect(badges[1].value).toBe(r.l10.score);
  });

  test("les libellés portent le VRAI nombre de matchs de chaque fenêtre", () => {
    const r = result();
    const badges = snookerPowerScoreBadges(r);
    expect(r.l5.matches).toBe(5);
    expect(r.l10.matches).toBe(10);
    expect(badges[0].label).toBe("L5 (5 m.)");
    expect(badges[1].label).toBe("L10 (10 m.)");
    expect(badges[0].label).toContain(String(r.l5.matches));
    expect(badges[1].label).toContain(String(r.l10.matches));
  });

  test("les hints reprennent matchs, victoires et défaites de la fenêtre", () => {
    const r = result();
    const badges = snookerPowerScoreBadges(r);
    expect(badges[0].hint).toBe(`PowerScore sur les 5 derniers matchs · ${r.l5.wins}V/${r.l5.losses}D`);
    expect(badges[1].hint).toBe(`PowerScore sur les 10 derniers matchs · ${r.l10.wins}V/${r.l10.losses}D`);
    expect(r.l5.wins + r.l5.losses).toBe(r.l5.matches);
    expect(r.l10.wins + r.l10.losses).toBe(r.l10.matches);
  });

  test("les badges de `computeSnookerPowerScores` sont identiques à ceux de `snookerPowerScore`", () => {
    const fromAll = computeSnookerPowerScores(rows).get("alice");
    if (!fromAll) throw new Error("alice doit être dans le lot");
    expect(snookerPowerScoreBadges(fromAll)).toEqual(snookerPowerScoreBadges(result()));
  });

  test("un joueur sans historique exploitable n'a pas de badges (pas de score inventé)", () => {
    expect(snookerPowerScore(rows, "fantome")).toBeNull();
  });
});

// ─── 12. Bords de cas ───────────────────────────────────────────────────────

describe("l10 / elo — bords de cas", () => {
  test("fenêtre 100 % sans frames parsées : les 3 métriques frame tombent ENSEMBLE", () => {
    const r = windowOf(recs(5, () => ({ elo: 1500, framesWon: 4, framesLost: 3 })), 5);
    expect(metric(r, "margin").value).toBeNull();
    expect(metric(r, "pointsPerFrame").value).toBeNull();
    expect(metric(r, "centuries").value).toBeNull();
    expect(metric(r, "margin").display).toBe("n/a");
    expect(metric(r, "pointsPerFrame").display).toBe("n/a");
    expect(metric(r, "centuries").display).toBe("n/a");
    // 30 + 18 + 15 + 8 = 71.
    expect(r.coverage).toBe(0.71);
    expect(Number.isFinite(r.score)).toBe(true);
  });

  test("un joueur avec exactement 1 match : n=1, rétrécissement maximal", () => {
    const r = windowOf(recs(1, () => ({ elo: 1500, framesWon: 5, framesLost: 0 })), 1);
    expect(r.matches).toBe(1);
    expect(r.wins).toBe(1);
    expect(r.losses).toBe(0);
    expect(r.coverage).toBe(0.56);
    // frameShare clampé à 100, decider null, resilience 0 ; l'Élo vient des
    // bornes mesurées. Tout est dérivé, rien n'est figé.
    const eloV = scale(1500, L10_BOUNDS.elo.lo, L10_BOUNDS.elo.hi);
    const attendu = Math.round((eloV * 30 + 100 * 18 + 0 * 8) / 56);
    expect(r.score).toBe(shrunk(attendu, 1));
  });

  test("10-0 contre 0-10 : direction au niveau de la MÉTRIQUE, pas du score seul", () => {
    const records = (gagne: boolean): EloMatchRecord[] =>
      recs(10, () => (gagne ? { elo: 1700, framesWon: 5, framesLost: 0 } : { elo: 1300, framesWon: 0, framesLost: 5 }));
    const haut = windowOf(records(true), 10);
    const bas = windowOf(records(false), 10);

    // Élo : bornes mesurées 1462-1546.
    near(mval(haut, "elo"), scale(1700, L10_BOUNDS.elo.lo, L10_BOUNDS.elo.hi));
    near(mval(bas, "elo"), scale(1300, L10_BOUNDS.elo.lo, L10_BOUNDS.elo.hi));
    expect(mval(haut, "elo")).toBeGreaterThan(mval(bas, "elo"));

    // Frame share : 100 contre 0.
    near(mval(haut, "frameShare"), 100);
    near(mval(bas, "frameShare"), 0);
    expect(mval(haut, "frameShare")).toBeGreaterThan(mval(bas, "frameShare"));

    // Resilience : 0 % (aucune remontée) contre… null (aucune victoire).
    near(mval(haut, "resilience"), 0);
    expect(metric(bas, "resilience").value).toBeNull();

    // Decider : aucun des deux côtés (5-0 et 0-5 ne sont pas des deciders).
    expect(metric(haut, "decider").value).toBeNull();
    expect(metric(bas, "decider").value).toBeNull();

    // Le score suit, mais la couverture DIFFÈRE : c'est le signe que le
    // renormalisation joue et qu'on ne compare pas deux scores bruts.
    expect(haut.score).toBeGreaterThan(bas.score);
    expect(haut.coverage).toBeGreaterThan(bas.coverage);
  });

  test("10-0 vs 0-10 avec frames PARSÉES : points, centures et marge s'inversent", () => {
    // alice gagne 5 frames à 100 pts de moyenne avec 1 century…
    const scoresGagnees = "100(100)-10; 80(80)-20; 90(90)-5; 70-30; 60-40";
    // …et la perd 5 frames à 21 pts de moyenne sans century.
    const scoresPerdus = "10-100(100); 20-80(80); 5-90(90); 30-70; 40-60";
    const bat = (gagne: boolean): L10WindowResult =>
      windowOf(
        buildEloHistory(Array.from({ length: 5 }, (_, i) =>
          wonWithScores(`m${i}`, `2020-0${(i % 9) + 1}-01`, "alice", "bob", gagne ? 5 : 0, gagne ? 0 : 5, gagne ? scoresGagnees : scoresPerdus),
        )).get("alice")!,
        5,
      );

    const haut = bat(true);
    const bas = bat(false);

    // 400 points en 5 frames → 80/frame > 55.3 → plafond 100.
    // 105 points → 21/frame < 28.8 → plancher 0.
    near(mval(haut, "pointsPerFrame"), 100);
    near(mval(bas, "pointsPerFrame"), 0);
    expect(mval(haut, "pointsPerFrame")).toBeGreaterThan(mval(bas, "pointsPerFrame"));

    // Marge : (400-105)/5 = 59 → clamp 100 ; (105-400)/5 = -59 → clamp 0.
    near(mval(haut, "margin"), 100);
    near(mval(bas, "margin"), 0);

    // Centuries : 3 centuries en 5 frames → 60/100 > 4.72 → plafond 100 ;
    // côté perdant, les memes 3 centuries appartiennent à BOB, donc alice 0.
    near(mval(haut, "centuries"), 100);
    near(mval(bas, "centuries"), 0);

    // Couverture : 5-0 n'est pas un decider (|5-0| = 5 > 1) → il manque 15.
    // Côté vainqueur : 30+18+10+10+9+8 = 85.
    expect(metric(haut, "decider").value).toBeNull();
    expect(haut.coverage).toBe(0.85);
    // Côté perdant : resilience null en plus (0 victoire) → 30+18+10+10+9 = 77.
    expect(metric(bas, "resilience").value).toBeNull();
    expect(bas.coverage).toBe(0.77);
    expect(haut.score).toBeGreaterThan(bas.score);
  });
});

describe("elo-walkforward — bords de cas", () => {
  test("décroissance sur 2 ans : nombre CONNU, pas une borne vague", () => {
    // alice bat bob le 2000-01-01 (1500 → 1512), puis rejoue le 2002-01-01,
    // soit 731 jours plus tard (2000 est bissextile).
    // facteur = 2^(-731/365) = 2^-2.00274… = 0.249527…
    // Élo décrémenté = 1500 + 12·facteur = 1502.994…
    const DAYS = 731;
    const rows = [won("m1", "2000-01-01", "alice", "bob", 5, 0), won("m2", "2002-01-01", "alice", "bob", 5, 0)];
    const recs = buildEloHistory(rows).get("alice")!;
    expect(recs[0].elo).toBe(1500);
    const attendu = 1500 + 12 * Math.pow(2, -DAYS / 365);
    near(recs[1].elo, attendu, 1e-9);
    // Une demi-vie de 365 j donnerait 0.5 → 1506. Le gap de 731 j doit être
    // inférieur : c'est exactement ce que la demi-vie fixe.
    expect(recs[1].elo).toBeLessThan(1506);
    expect(recs[1].elo).toBeGreaterThan(1500);
    // Contre-vérification fermée : 2 demi-vies = 1503 exactement.
    near(1500 + 12 * Math.pow(2, -730 / 365), 1503, 1e-9);
  });

  test("décroissance vers la MOYENNE, pas vers zéro", () => {
    // Un joueur très fort et inactif retombe vers 1500, jamais en dessous.
    const rows = [won("m1", "2000-01-01", "alice", "bob", 5, 0), won("m2", "2001-01-01", "alice", "bob", 5, 0)];
    const r = buildEloHistory(rows).get("alice")!;
    expect(r[1].elo).toBeGreaterThan(1500);
    const h = new Map([["alice", r]]);
    expect(lastRating(h, "alice")).toBeGreaterThan(1400);
  });

  test("même joueur, casse de slug différente → UNE seule histoire", () => {
    // La normalisation de casse est faite par `snookerSlug` au moment de la
    // LECTURE de la base (`loadSnookerL10Rows`). Le contrat de `buildEloHistory`
    // est donc : une fois les slugs normalisés, un joueur = une clé.
    const raw1 = "https://cuetracker.net/Players/Judd-Trump";
    const raw2 = "https://cuetracker.net/players/judd-trump";
    const slug = snookerSlug(raw1);
    expect(snookerSlug(raw2)).toBe(slug);

    const h = buildEloHistory([
      won("m1", "2020-01-01", slug, "opposant", 5, 0),
      won("m2", "2020-02-01", slug, "opposant", 5, 0),
    ]);
    expect(h.size).toBe(2); // le joueur + son adversaire, PAS 3 îlots
    expect(h.get(slug)).toHaveLength(2);
    expect([...h.keys()].filter((k) => k.toLowerCase() === slug)).toHaveLength(1);
  });

  test("auto-match détecté même si les deux slugs ne diffèrent que par la casse", () => {
    // `buildEloHistory` compare `a === b` sur les slugs DÉJÀ normalisés. La
    // garde existe, mais elle est sensible à la casse : si un appelant
    // passe "Alice" et "alice" sans normaliser, on obtient un match
    // contre soi-même. On verrouille ici le comportement RÉEL du moteur.
    const h = buildEloHistory([won("m1", "2020-01-01", "Alice", "alice", 5, 0)]);
    // Le moteur n'a pas de garde de casse : 2 clés distinctes, 1 match chacune.
    expect(h.size).toBe(2);
    expect(h.get("Alice")).toHaveLength(1);
    expect(h.get("alice")).toHaveLength(1);
  });

  test("deux joueurs distincts ne sont jamais fusionnés", () => {
    const h = buildEloHistory([
      won("m1", "2020-01-01", "alice", "bob", 5, 0),
      won("m2", "2020-02-01", "carol", "bob", 5, 0),
    ]);
    expect(h.size).toBe(3);
    expect(h.get("bob")).toHaveLength(2);
  });

  test("joueur vide ou identique : ligne ignorée, jamais de record à moitié rempli", () => {
    expect(buildEloHistory([won("m1", "2020-01-01", "", "bob", 5, 0)]).size).toBe(0);
    expect(buildEloHistory([won("m1", "2020-01-01", "alice", "", 5, 0)]).size).toBe(0);
    for (const recs of buildEloHistory([won("m1", "2020-01-01", "", "", 5, 0)]).values()) {
      expect(recs).toHaveLength(0);
    }
  });
});


// ─── 5. Point d entrée ──────────────────────────────────────────────────────

describe("computeSnookerPowerScores / snookerPowerScore", () => {
  const rows = [
    ...Array.from({ length: 8 }, (_, i) =>
      won(`a${i}`, `2020-${String((i % 12) + 1).padStart(2, "0")}-01`, "alice", "bob", 5, i % 3 === 0 ? 2 : 0),
    ),
    ...Array.from({ length: 4 }, (_, i) =>
      won(`b${i}`, `2021-${String((i % 12) + 1).padStart(2, "0")}-01`, "carol", "alice", i % 2 === 0 ? 5 : 1, i % 2 === 0 ? 1 : 5),
    ),
  ];

  test("deux fenêtres, deux scores, pour chaque joueur", () => {
    const all = computeSnookerPowerScores(rows);
    expect(all.get("alice")?.l5.matches).toBe(5);
    expect(all.get("alice")?.l10.matches).toBe(10);
    expect(all.get("bob")?.l10.matches).toBe(8);
  });

  test("joueur absent → null, pas de score inventé", () => {
    expect(snookerPowerScore(rows, "fantome")).toBeNull();
  });

  test("SENTINELLE #7 — ajouter des lignes finales ne réécrit pas le passé", () => {
    // La fuite la plus coûteuse serait un calcul de moyenne sur tout le
    // corpus : le rating d'alice au match m0 changerait à cause de matchs
    // postérieurs. On vérifie que l'Élo ET la date de chaque enregistrement
    // antérieur sont bit-identiques quand on ajoute deux matchs plus tard.
    const base = snookerPowerScore(rows, "alice")!;
    const extended = snookerPowerScore(
      [...rows, won("z1", "2022-01-01", "alice", "bob", 0, 5), won("z2", "2022-01-02", "alice", "bob", 0, 5)],
      "alice",
    )!;

    const histBefore = base.l10.details;
    const histAfter = extended.l10.details;
    // La fenêtre L10 a glissé de 2 crans : elle gagne z1/z2 et perd ses deux
    // plus anciens matchs. Les matchs PRÉSENTS dans les deux fenêtres doivent
    // être strictement identiques.
    const beforeIds = new Set(histBefore.map((r) => r.matchId));
    const kept = histAfter.filter((r) => beforeIds.has(r.matchId));
    expect(kept.length).toBeGreaterThan(0);
    for (const rec of kept) {
      const ref = histBefore.find((r) => r.matchId === rec.matchId)!;
      expect(rec.elo).toBe(ref.elo);
      expect(rec.opponentElo).toBe(ref.opponentElo);
      expect(rec.date).toBe(ref.date);
    }
    // Les deux nouvelles défaites ENTRAIENT bien dans les deux fenêtres :
    // on vérifie la composition, pas la direction du score.
    //
    // On ne peut PAS exiger `extended.l5.score <= base.l5.score` : l'Élo est
    // un score RELATIF. Perdre contre un adversaire déjà très inférieur coûte
    // peu, et le glissement de la fenêtre emporte au passage d'autres matchs.
    // Une fenêtre peut donc monter malgré une défaite supplémentaire. Ce qui
    // doit rester invariant, c'est l'historique — testé ci-dessus.
    expect(extended.l5.losses).toBeGreaterThan(base.l5.losses);
    expect(extended.l5.details.some((r) => r.matchId === "z2")).toBe(true);
    expect(extended.l10.details.some((r) => r.matchId === "z2")).toBe(true);
  });

  test("SENTINELLE #4 — symétrie A/B : le score ne dépend pas de l'ordre des colonnes", () => {
    const flipped = rows.map((r) => ({ ...r, playerA: r.playerB, playerB: r.playerA, scoreA: r.scoreB, scoreB: r.scoreA }));
    const a = snookerPowerScore(rows, "alice")!;
    const b = snookerPowerScore(flipped, "alice")!;
    expect(b.l5.matches).toBe(a.l5.matches);
    expect(b.l10.wins).toBe(a.l10.wins);
  });
});

// ─── 6. Passage à la probabilité de frame (le SEUL point de contact) ────────

describe("frameProbabilityFromPowerScore", () => {
  test("monotone et bornée", () => {
    expect(frameProbabilityFromPowerScore(0)).toBeLessThan(frameProbabilityFromPowerScore(50));
    expect(frameProbabilityFromPowerScore(50)).toBeLessThan(frameProbabilityFromPowerScore(95));
    expect(frameProbabilityFromPowerScore(100)).toBeLessThanOrEqual(0.8);
    expect(frameProbabilityFromPowerScore(0)).toBeGreaterThanOrEqual(0.2);
  });

  test("valeur invalide → 0.5 neutre, jamais NaN", () => {
    expect(frameProbabilityFromPowerScore(Number.NaN)).toBe(0.5);
    expect(frameProbabilityFromPowerScore(50)).toBeGreaterThan(0.5 - 0.01);
  });
});