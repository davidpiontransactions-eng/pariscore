// Tests du module de stats historique handball (splits L5/L10 dom/ext, PPG,
// winrate, échelle Over, probas buteurs). bun:test — convention projet.
import { describe, expect, test } from "bun:test";
import {
  DEFAULT_OVER_LINES,
  GOAL_THRESHOLDS,
  PROB_FLOOR,
  computeTeamStats,
  fitNu,
  matchModel,
  meanTotal,
  overLadder,
  pickPlayableLine,
  poissonAtLeast,
  resolveTeamKey,
  scorerProbs,
  teamKey,
  type HistoryMatch,
} from "../handball-history-stats";

/** Construit un match d'historique synthétique (équipe A reçoit). */
function m(date: string, home: string, away: string, hg: number, ag: number): HistoryMatch {
  return {
    date,
    home,
    away,
    homeKey: teamKey(home),
    awayKey: teamKey(away),
    homeGoals: hg,
    awayGoals: ag,
    league: "Test League",
  };
}

describe("teamKey / resolveTeamKey", () => {
  test("normalise casse, diacritiques et ponctuation", () => {
    expect(teamKey("Füchse Berlin")).toBe("fuchseberlin");
    expect(teamKey("Flensburg-H.")).toBe("flensburgh");
    expect(teamKey("FC Bayern")).toBe("fcbayern");
  });

  test("résolution exacte puis par inclusion (longueur ≥ 6)", () => {
    const keys = ["fuchseberlin", "flensburgh", "kiel"];
    expect(resolveTeamKey(keys, "Fuchse Berlin")).toBe("fuchseberlin");
    expect(resolveTeamKey(keys, "Fuchse Berlin (Ger)")).toBe("fuchseberlin");
    expect(resolveTeamKey(keys, "Flensburg")).toBe("flensburgh");
    // Trop court pour de l'inclusion (garde-fou « hc » → « hcm »)
    expect(resolveTeamKey(keys, "Kie")).toBeNull();
  });
});

describe("computeTeamStats — splits L5/L10 dom/ext + PPG + winrate", () => {
  // 6 matchs à domicile (victoires 30-24) + 4 à l'extérieur (défaites 22-28),
  // fournis en ordre DÉCROISSANT comme le fait la couche DB.
  const rows: HistoryMatch[] = [
    m("2026-09-10", "Alpha", "Beta", 30, 24), // dom
    m("2026-09-05", "Gamma", "Alpha", 28, 22), // ext
    m("2026-08-30", "Alpha", "Beta", 30, 24), // dom
    m("2026-08-25", "Gamma", "Alpha", 28, 22), // ext
    m("2026-08-20", "Alpha", "Delta", 30, 24), // dom
    m("2026-08-15", "Epsilon", "Alpha", 28, 22), // ext
    m("2026-08-10", "Alpha", "Delta", 30, 24), // dom
    m("2026-08-05", "Epsilon", "Alpha", 28, 22), // ext
    m("2026-07-30", "Alpha", "Zeta", 30, 24), // dom
    m("2026-07-25", "Eta", "Alpha", 28, 22), // ext
  ];

  const stats = computeTeamStats(rows, teamKey("Alpha"))!;

  test("comptage global + winrate global/dom/ext", () => {
    expect(stats.n).toBe(10);
    expect(stats.wins).toBe(5); // que des victoires à domicile
    expect(stats.draws).toBe(0);
    expect(stats.losses).toBe(5);
    expect(stats.winrate).toBeCloseTo(0.5, 5);
    expect(stats.winrateHome).toBeCloseTo(1, 5); // 5/5 à domicile
    expect(stats.winrateAway).toBeCloseTo(0, 5); // 0/5 à l'extérieur
  });

  test("buts marqués : L5/L10 en situation dom ET ext", () => {
    // Domicile : 5 matchs à 30 buts → L5 = L10 = 30
    expect(stats.home.l5.scored).toBe(30);
    expect(stats.home.l10.scored).toBe(30);
    // Extérieur : 5 matchs à 22 buts
    expect(stats.away.l5.scored).toBe(22);
    expect(stats.away.l10.scored).toBe(22);
    expect(stats.overall.l10.scored).toBe(26);
  });

  test("buts encaissés + différence (marqués − encaissés)", () => {
    expect(stats.home.l5.conceded).toBe(24);
    expect(stats.away.l5.conceded).toBe(28);
    expect(stats.home.l5.diff).toBe(6); // 30 − 24
    expect(stats.away.l5.diff).toBe(-6); // 22 − 28
    expect(stats.overall.l10.diff).toBe(0); // 26 marqués − 26 encaissés
  });

  test("forme PPG L5/L10 dom/ext (V=3, N=1, D=0)", () => {
    expect(stats.home.l5.ppg).toBe(3); // 5 victoires
    expect(stats.away.l5.ppg).toBe(0); // 5 défaites
    expect(stats.overall.l10.ppg).toBe(1.5); // 5×3 + 5×0 sur 10
    expect(stats.home.l5.seq).toBe("VVVVV");
    expect(stats.away.l5.seq).toBe("DDDDD");
  });

  test("fenêtre L5 tronquée : n reflète les matchs disponibles", () => {
    const few = computeTeamStats(rows.slice(0, 3), teamKey("Alpha"))!;
    expect(few.n).toBe(3);
    expect(few.overall.l5.n).toBe(3);
    expect(few.home.l5.n).toBe(2);
    expect(few.away.l5.n).toBe(1);
  });

  test("équipe absente → null (jamais de stats inventées)", () => {
    expect(computeTeamStats(rows, teamKey("Omega"))).toBeNull();
    expect(computeTeamStats([], teamKey("Alpha"))).toBeNull();
  });
});

describe("meanTotal + matchModel", () => {
  test("moyenne des totaux observés", () => {
    const rows = [m("2026-09-01", "A", "B", 30, 28), m("2026-09-02", "C", "D", 25, 25)];
    expect(meanTotal(rows)).toBe(54);
    expect(meanTotal([])).toBeNull();
  });

  test("équipes inconnues → total ~60.45 (neutre + avantage domicile)", () => {
    const model = matchModel(null, null, 1);
    expect(model.lambdaH).toBeCloseTo(30.9, 1);
    expect(model.lambdaA).toBeCloseTo(29.55, 1);
    expect(model.expectedTotal).toBeCloseTo(60.5, 1);
  });

  test("la calibration multiplie les λ sans écraser l'écart", () => {
    const a = matchModel(null, null, 1);
    const b = matchModel(null, null, 1.1);
    expect(b.lambdaH).toBeCloseTo(a.lambdaH * 1.1, 3);
    expect(b.lambdaA).toBeCloseTo(a.lambdaA * 1.1, 3);
    expect(b.scale).toBeCloseTo(1.1, 3);
  });
});

describe("overLadder / pickPlayableLine", () => {
  test("8 lignes de 59.5 à 52.5, probas croissantes quand la ligne descend", () => {
    const ladder = overLadder(31, 1, 29, 1); // ν = 1 (Poisson) : cas nominal
    expect(ladder).toHaveLength(DEFAULT_OVER_LINES.length);
    expect(ladder[0].line).toBe(59.5);
    expect(ladder[ladder.length - 1].line).toBe(52.5);
    for (let i = 1; i < ladder.length; i++) {
      // Ligne plus basse → P(over) ≥ (tolérance sur les queues du grid CMP)
      expect(ladder[i].over).toBeGreaterThanOrEqual(ladder[i - 1].over - 1e-6);
      expect(ladder[i].over + ladder[i].under).toBeCloseTo(1, 6);
    }
    // Sens physique : total attendu 60 → P(>59.5) ~50 %, P(>52.5) nettement plus
    expect(ladder[0].over).toBeGreaterThan(0.3);
    expect(ladder[0].over).toBeLessThan(0.7);
    expect(ladder[ladder.length - 1].over).toBeGreaterThan(ladder[0].over);
  });

  test("jouabilité au seuil 55 %", () => {
    const ladder = overLadder(31, 1, 29, 1);
    for (const l of ladder) expect(l.playable).toBe(l.over >= PROB_FLOOR);
    const pick = pickPlayableLine(ladder);
    expect(pick).not.toBeNull();
    expect(pick!.playable).toBeTrue();
    // Le pick est la ligne la PLUS HAUTE jouable (Over 60 d'abord)
    expect(pick!.line).toBe(ladder.find((l) => l.playable)!.line);
  });

  test("total très faible → aucune ligne jouable", () => {
    const ladder = overLadder(22, 1.3, 21, 1.3);
    expect(pickPlayableLine(ladder)).toBeNull();
    expect(ladder.every((l) => !l.playable)).toBeTrue();
  });
});

describe("fitNu — apparillage de variance", () => {
  test("échantillon insuffisant → repli 1.3 (ν handball du plan)", () => {
    const few = [m("2026-09-01", "A", "B", 30, 28), m("2026-09-02", "C", "D", 25, 25)];
    const { nu, n } = fitNu(few);
    expect(nu).toBe(1.3);
    expect(n).toBe(2);
  });

  test("échantillon de 40 totaux proches de Poisson → ν proche de 1", () => {
    // Totaux générés autour de 60 avec variance ~ moyenne locale (bruit déterministe)
    const rows: HistoryMatch[] = [];
    for (let i = 0; i < 40; i++) {
      const t = 40 + ((i * 7) % 41); // 40..80, variance ~140
      rows.push(m(`2026-09-${String((i % 28) + 1).padStart(2, "0")}`, "A", "B", Math.floor(t / 2), t - Math.floor(t / 2)));
    }
    const { nu, n } = fitNu(rows);
    expect(n).toBe(40);
    expect(nu).toBeGreaterThan(0.6);
    expect(nu).toBeLessThan(3);
  });
});

describe("probas buteurs (au moins 2/3/4/5 buts)", () => {
  test("P(≥n) décroissante en n et ∈ [0;1]", () => {
    const { probs } = scorerProbs(6, 30);
    expect(probs.map((p) => p.n)).toEqual([...GOAL_THRESHOLDS]);
    for (let i = 1; i < probs.length; i++) {
      expect(probs[i].p).toBeLessThan(probs[i - 1].p);
    }
    for (const p of probs) {
      expect(p.p).toBeGreaterThanOrEqual(0);
      expect(p.p).toBeLessThanOrEqual(1);
      expect(p.playable).toBe(p.p >= PROB_FLOOR);
    }
  });

  test("λ joueur ajusté au rythme du match, facteur borné [0.75;1.35]", () => {
    expect(scorerProbs(4, 30).lambda).toBeCloseTo(4, 2); // ratio 1
    expect(scorerProbs(4, 45).lambda).toBeCloseTo(4 * 1.35, 2); // plafonné
    expect(scorerProbs(4, 15).lambda).toBeCloseTo(4 * 0.75, 2); // plancher
  });

  test("butleur star : P(≥5) élevée ; buteur faible : sous le seuil", () => {
    const star = scorerProbs(8.6, 30).probs.find((p) => p.n === 5)!;
    expect(star.p).toBeGreaterThan(0.85);
    expect(star.playable).toBeTrue();
    const weak = scorerProbs(1.2, 30).probs.find((p) => p.n === 5)!;
    expect(weak.p).toBeLessThan(PROB_FLOOR);
    expect(weak.playable).toBeFalse();
  });

  test("poissonAtLeast : bornes exactes", () => {
    expect(poissonAtLeast(0, 5)).toBe(1);
    expect(poissonAtLeast(1, 0)).toBeLessThan(1e-8); // λ borné à 1e-9
    expect(poissonAtLeast(1, 3)).toBeCloseTo(1 - Math.exp(-3), 6);
    expect(poissonAtLeast(2, 3)).toBeCloseTo(1 - Math.exp(-3) * (1 + 3), 6);
  });
});
