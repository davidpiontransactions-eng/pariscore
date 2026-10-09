// Calibration du moteur live : le seul test qui peut prouver que le modèle
// Markov VALAIT mieux que le marché. Sans lui, l'écart affiché dans le widget
// n'est qu'une affirmation.
import { describe, expect, test } from "bun:test";
import {
  brierScore,
  calibrate,
  calibrateByMarket,
  inMemoryCalibrationLog,
  logLoss,
  MIN_SAMPLES_FOR_VERDICT,
  type CalibrationRecord,
} from "@/lib/prediction/live-calibration";

function rec(
  modelProb: number,
  marketProb: number,
  outcome: 0 | 1,
  market = "match",
  i = 0
): CalibrationRecord {
  return {
    id: `${market}-${i}`,
    market,
    modelProb,
    marketProb,
    outcome,
    resolvedAt: "2026-01-01T00:00:00Z",
  };
}

describe("Brier Score", () => {
  test("une prédiction parfaite vaut 0", () => {
    expect(brierScore([{ prob: 1, outcome: 1 }])).toBe(0);
    expect(brierScore([{ prob: 0, outcome: 0 }])).toBe(0);
  });

  test("toujours 50 % vaut 0,25 (référence d'un modèle sans information)", () => {
    expect(brierScore([{ prob: 0.5, outcome: 1 }])).toBeCloseTo(0.25, 10);
    expect(brierScore([{ prob: 0.5, outcome: 0 }])).toBeCloseTo(0.25, 10);
  });

  test("le Brier NE clipe PAS : une prédiction parfaite vaut exactement 0", () => {
    // Contrairement au Log-Loss (ln(0) = −∞), le Brier n'a besoin d'aucun
    // bornage. Cliper à 1−eps donnerait 1e−18 au lieu de 0.
    expect(brierScore([{ prob: 1, outcome: 1 }])).toBe(0);
    expect(brierScore([{ prob: 0, outcome: 0 }])).toBe(0);
  });

  test("moyenne sur l'échantillon", () => {
    // (0.8-1)² + (0.2-0)² = 0.04 + 0.04 = 0.08 / 2 = 0.04
    expect(
      brierScore([
        { prob: 0.8, outcome: 1 },
        { prob: 0.2, outcome: 0 },
      ])
    ).toBeCloseTo(0.04, 10);
  });

  test("aucune observation → 0 (pas de donnée n'est pas un score de 0)", () => {
    expect(brierScore([])).toBe(0);
  });
});

describe("Log-Loss", () => {
  test("pénalise bien plus fort la confiance excessive que le Brier", () => {
    // Confiance 95 % ratée vs confiance 60 % ratée, même résultat (1, on dit 0).
    const excessif = logLoss([{ prob: 0.05, outcome: 1 }]);
    const modere = logLoss([{ prob: 0.4, outcome: 1 }]);
    expect(excessif).toBeGreaterThan(modere * 3);

    // Même comparaison sur le Brier : l'écart est bien plus faible.
    const bExcessif = brierScore([{ prob: 0.05, outcome: 1 }]);
    const bModere = brierScore([{ prob: 0.4, outcome: 1 }]);
    expect(bExcessif - bModere).toBeLessThan(excessif / 3);
  });

  test("ne produit jamais Infinity même à 0 % (probabilité clampée)", () => {
    const v = logLoss([{ prob: 0, outcome: 1 }]);
    expect(Number.isFinite(v)).toBe(true);
    expect(v).toBeGreaterThan(0);
  });

  test("probs non finies dégradent à 0.5 au lieu de NaN", () => {
    const v = logLoss([{ prob: Number.NaN, outcome: 1 }]);
    expect(Number.isFinite(v)).toBe(true);
    expect(v).toBeCloseTo(-Math.log(0.5), 6);
  });
});

describe("calibrate — modèle vs marché", () => {
  test("modèle parfait, marché nul → skillScore = 1", () => {
    const r = calibrate([
      rec(0.99, 0.5, 1, "match", 0),
      rec(0.01, 0.5, 0, "match", 1),
    ]);
    expect(r.skillScore).toBeGreaterThan(0.9);
    expect(r.n).toBe(2);
  });

  test("marché parfait, modèle nul → skillScore négatif (le widget ment)", () => {
    const r = calibrate([
      rec(0.5, 0.99, 1, "match", 0),
      rec(0.5, 0.01, 0, "match", 1),
    ]);
    expect(r.skillScore).toBeLessThan(0);
    expect(r.verdict).toContain("bruit");
  });

  test("marché et modèle identiques → skillScore = 0", () => {
    const rows = Array.from({ length: 40 }, (_, i) =>
      rec(0.6, 0.6, i % 3 === 0 ? 1 : 0, "match", i)
    );
    const r = calibrate(rows);
    expect(r.skillScore).toBeCloseTo(0, 10);
    expect(r.verdict).toContain("équivalents");
  });

  test("échantillon insuffisant → AUCUNE conclusion (pas de verdict confiant)", () => {
    const r = calibrate([rec(0.9, 0.2, 1, "match", 0)]);
    expect(r.n).toBeLessThan(MIN_SAMPLES_FOR_VERDICT);
    expect(r.verdict).toContain("aucune conclusion fiable");
  });

  test("aucune observation → message explicite, pas un zéro silencieux", () => {
    const r = calibrate([]);
    expect(r.n).toBe(0);
    expect(r.brierModel).toBe(0);
    expect(r.verdict).toContain("Aucune observation");
  });

  test("les deux scores sont calculés sur les MÊMES observations", () => {
    const rows = Array.from({ length: 50 }, (_, i) =>
      rec(0.3 + (i % 7) * 0.1, 0.5, (i % 2) as 0 | 1, "match", i)
    );
    const r = calibrate(rows);
    // Recalcul indépendant : BS_marché doit être exactement 0.25 (toujours 0.5).
    expect(r.brierMarket).toBeCloseTo(0.25, 10);
    expect(r.n).toBe(50);
  });
});

describe("calibrateByMarket", () => {
  test("ventile par marché et trie par volume d'observations", () => {
    const rows = [
      ...Array.from({ length: 5 }, (_, i) => rec(0.7, 0.5, 1, "match", i)),
      ...Array.from({ length: 2 }, (_, i) => rec(0.3, 0.5, 0, "set-2", i)),
    ];
    const out = calibrateByMarket(rows);
    expect(out).toHaveLength(2);
    expect(out[0].market).toBe("match");
    expect(out[0].n).toBe(5);
    expect(out[1].market).toBe("set-2");
    expect(out[1].n).toBe(2);
  });
});

describe("journal d'observations", () => {
  test("record puis all conserve l'ordre et le contenu", async () => {
    const log = inMemoryCalibrationLog();
    await log.record(rec(0.6, 0.5, 1, "match", 0));
    await log.record(rec(0.4, 0.5, 0, "match", 1));
    const all = await log.all();
    expect(all).toHaveLength(2);
    expect(all[0].modelProb).toBe(0.6);
    expect(all[1].outcome).toBe(0);
  });

  test("all() renvoie une COPIE : muter le résultat ne corrompt pas le log", async () => {
    const log = inMemoryCalibrationLog();
    await log.record(rec(0.6, 0.5, 1));
    const rows = await log.all();
    rows.pop();
    expect((await log.all())).toHaveLength(1);
  });
});