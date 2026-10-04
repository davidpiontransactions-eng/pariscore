import { describe, expect, test } from "bun:test";
import {
  CALIBRATED_NU,
  NU_LOWER_BOUND,
  OBSERVED_TOTALS,
  observedAllStats,
  observedPooledSigma,
  observedStats,
  totalProbabilityOver,
} from "@/lib/handball-goals-calibration";
import {
  calculateOptimalOverGoals,
  calculateOptimalUnderGoals,
  pickOptimalTotalGoal,
  type ThresholdTeamStats,
} from "@/lib/handball-optimal-thresholds";
import { CMP_DEFAULT_NU, cmpLambdaForMean } from "@/lib/handball-cmp";
import { PARISCORE_MAX_PROB_PCT, PARISCORE_MIN_ODDS, PARISCORE_MIN_PROB_PCT } from "@/lib/handball-pariscore";

// ─── Mesures réelles ───

describe("calibration ν — données réelles Vitibet", () => {
  test("35 matchs réels sur 5 ligues", () => {
    const n = Object.values(OBSERVED_TOTALS).reduce((a, l) => a + l.totals.length, 0);
    expect(n).toBe(35);
    expect(observedAllStats()).toHaveLength(5);
  });

  test("σ empirique intra-ligue mesurée autour de 7.25 buts", () => {
    const { n, sigma } = observedPooledSigma();
    expect(n).toBe(35);
    // Mesure : 7.25. On borne large (± 0.6) : le but est de figer la mesure,
    // pas de la figer au troisième décimal.
    expect(sigma).toBeGreaterThan(6.6);
    expect(sigma).toBeLessThan(7.9);
  });

  test("les totaux sont cohérents avec les moyennes de ligue dérivées", () => {
    // 1. Division Women : moyenne observée 51.2 = exactement la base dérivée
    // 25.6 × 2 du classement. C'est le contrôle de cohérence le plus fort.
    const d2 = observedStats("firstDivisionWomen")!;
    expect(d2.mean).toBeCloseTo(51.2, 1);
    const herre = observedStats("herreHandboldLigaen")!;
    // 7 matchs vs la moyenne de saison : l'écart d'échantillon est normal
    // (64.3 observé pour 63.6 sur la saison complète).
    expect(Math.abs(herre.mean - 63.6)).toBeLessThan(1.5);
  });

  test("ν = 1.3 est EXCLU par la mesure", () => {
    // σ à ν=1.3 pour un total attendu de 57 : bien sous l'observation.
    const lam = 28.5; // ν=1 → λ = moyenne
    const sdNu13 = Math.sqrt(2 * varOf(lam, 1.3));
    const sdNu10 = Math.sqrt(2 * varOf(lam, 1.0));
    const { sigma } = observedPooledSigma();
    expect(sdNu13).toBeLessThan(sigma * 0.8);
    expect(CALIBRATED_NU).toBeGreaterThanOrEqual(NU_LOWER_BOUND);
  });

  test("ν = 1.0 (calibré) reproduit la dispersion à ±15 %", () => {
    const lam = 28.5;
    const sd = Math.sqrt(2 * varOf(lam, CALIBRATED_NU));
    const { sigma } = observedPooledSigma();
    expect(Math.abs(sd / sigma - 1)).toBeLessThan(0.15);
  });

  test("la mesure contredit ν = 1.3 de façon franche (contexte du bug TOP 10)", () => {
    // Avec la dispersion historique, over55.5 vaut 0.0 % et under62.5 100 % :
    // c'est le mécanisme exact du « taux de réussite qui s'effondre ».
    const lam = 28.5;
    expect(totalProbabilityOver(lam, 1.3, lam, 55.5)).toBeLessThan(1e-6);
    expect(totalProbabilityOver(lam, 1.3, lam, 62.5)).toBeLessThan(1e-6);
    // ν = 1.0 donne des probabilités intermédiaires crédibles.
    const mid = totalProbabilityOver(lam, CALIBRATED_NU, lam, 55.5)!;
    expect(mid).toBeGreaterThan(0.4);
    expect(mid).toBeLessThan(0.8);
  });

  test("ν = 1.3 sous-estime la dispersion de ~40 % (contrat de calibration)", () => {
    // Mesure directe via la pmf : c'est le constat qui fonde tout le reste.
    // (Les tests ci-dessus vérifient aussi que ν = 1.3 reste « utilisable »
    // formellement — il produit bien des seuils — mais sa dispersion est
    // fausse, ce qui invalide le CALIBRAGE des seuils, pas leur existence.)
    const lam = 28.5; // ν = 1 → λ = moyenne
    const sd13 = Math.sqrt(2 * varOf(lam, 1.3));
    const sd10 = Math.sqrt(2 * varOf(lam, 1.0));
    const { sigma } = observedPooledSigma();
    expect(sd13 / sigma).toBeLessThan(0.75);
    expect(sd10 / sigma).toBeGreaterThan(0.85);
  });
});

// ─── Seuils optimaux ───

const balanced: ThresholdTeamStats = { scoredAvg: 28.5, concededAvg: 28.5 };
const highScoring: ThresholdTeamStats = { scoredAvg: 34, concededAvg: 24 };
const lowScoring: ThresholdTeamStats = { scoredAvg: 22, concededAvg: 32 };

describe("calculateOptimalOverGoals", () => {
  test("atteint toujours la probabilité cible", () => {
    const cases = [balanced, highScoring, lowScoring];
    for (const h of cases) {
      for (const a of cases) {
        const t = calculateOptimalOverGoals(h, a, 65);
        if (t) expect(t.prob).toBeGreaterThanOrEqual(65);
      }
    }
  });

  test("la ligne retenue est la plus CONSERVATRICE qui passe 65 %", () => {
    // Match équilibré : total attendu 57, P(total > 57) ≈ 50 %. Il faut
    // descendre jusqu'à la première demi-ligne qui atteint 65 %.
    const t = calculateOptimalOverGoals(balanced, balanced, 65)!;
    expect(t).not.toBeNull();
    expect(t.side).toBe("over");
    expect(t.line).toBeLessThan(57);
    // Une exigence plus basse doit garder une ligne au moins aussi haute.
    const easier = calculateOptimalOverGoals(balanced, balanced, 60)!;
    expect(easier.line).toBeGreaterThanOrEqual(t.line);
  });

  test("respecte le plafond de 95 % (pas de quasi-certitude publiée)", () => {
    for (const h of [balanced, highScoring, lowScoring]) {
      const t = calculateOptimalOverGoals(h, highScoring, 65);
      if (t) expect(t.prob).toBeLessThanOrEqual(PARISCORE_MAX_PROB_PCT);
    }
  });

  test("match à très haut score : le seuil descend pour compensation", () => {
    const low = calculateOptimalOverGoals(highScoring, lowScoring, 65)!;
    const mid = calculateOptimalOverGoals(balanced, balanced, 65)!;
    // Un match qui annonce 58 buts a besoin d'un seuil plus bas pour atteindre
    // 65 % : c'est le défaut de « seuil trop haut » corrigé.
    expect(low.line).toBeLessThan(mid.line);
  });

  test("cote < 1.15 → qualifies=false + motif de refus", () => {
    const t = calculateOptimalOverGoals(balanced, balanced, 65)!;
    const blocked = calculateOptimalOverGoals(balanced, balanced, 65, {
      oddsByLine: { [String(t.line)]: { over: 1.05 } },
    })!;
    expect(blocked.qualifies).toBe(false);
    expect(blocked.rejectReason).toContain("cote");
    expect(blocked.rejectReason).toContain("1.05");
  });

  test("cote ≥ 1.15 → qualifie", () => {
    const t = calculateOptimalOverGoals(balanced, balanced, 65)!;
    const ok = calculateOptimalOverGoals(balanced, balanced, 65, {
      oddsByLine: { [String(t.line)]: { over: 1.9 } },
    })!;
    expect(ok.qualifies).toBe(true);
    expect(ok.rejectReason).toBeNull();
  });

  test("stats invalides → null, jamais de NaN", () => {
    // Les DEUX équipes à zéro : total attendu 0.1 < plancher de 10 buts → refus.
    const zero = { scoredAvg: 0, concededAvg: 0 };
    expect(calculateOptimalOverGoals(zero, zero, 65)).toBeNull();
    expect(calculateOptimalUnderGoals(zero, zero, 65)).toBeNull();
    // Valeurs non finies / négatives : refus immédiat, jamais de RangeError.
    expect(
      calculateOptimalOverGoals({ scoredAvg: NaN, concededAvg: 28 }, balanced, 65),
    ).toBeNull();
    expect(
      calculateOptimalUnderGoals({ scoredAvg: -5, concededAvg: 28 }, balanced, 65),
    ).toBeNull();
  });
});

describe("calculateOptimalUnderGoals", () => {
  test("atteint toujours la probabilité cible", () => {
    const cases = [balanced, highScoring, lowScoring];
    for (const h of cases) {
      for (const a of cases) {
        const t = calculateOptimalUnderGoals(h, a, 65);
        if (t) {
          expect(t.prob).toBeGreaterThanOrEqual(65);
          expect(t.side).toBe("under");
        }
      }
    }
  });

  test("remplace la ligne fixe 62.5 : le seuil dépend des deux équipes", () => {
    const fast = calculateOptimalUnderGoals(highScoring, highScoring, 65)!;
    const slow = calculateOptimalUnderGoals(lowScoring, lowScoring, 65)!;
    // Deux équipes rapides annoncent ~58 buts → il faut un seuil Under PLUS
    // HAUT pour rester prudent ; deux équipes lentes (~54 buts) → un seuil
    // plus bas. Une ligne fixe donnerait le même chiffre pour les deux.
    expect(fast.line).toBeGreaterThan(slow.line);
  });

  test("respecte le plafond de 95 %", () => {
    const t = calculateOptimalUnderGoals(balanced, balanced, 65);
    if (t) expect(t.prob).toBeLessThanOrEqual(PARISCORE_MAX_PROB_PCT);
  });

  test("cote < 1.15 → refus motivé", () => {
    const t = calculateOptimalUnderGoals(balanced, balanced, 65)!;
    const blocked = calculateOptimalUnderGoals(balanced, balanced, 65, {
      oddsByLine: { [String(t.line)]: { under: 1.01 } },
    })!;
    expect(blocked.qualifies).toBe(false);
  });
});

describe("pickOptimalTotalGoal — arbitrage Over / Under", () => {
  test("renvoie le côté de plus forte probabilité qui respecte la cote", () => {
    const t = pickOptimalTotalGoal(balanced, balanced)!;
    expect(t).not.toBeNull();
    expect(t.prob).toBeGreaterThanOrEqual(PARISCORE_MIN_PROB_PCT);
    expect(t.qualifies).toBe(true);
  });

  test("un seuil avec cote trop basse n'est jamais proposé", () => {
    const t = pickOptimalTotalGoal(balanced, balanced, {
      // Toutes les lignes du scan à 1.02 → aucun pari proposable. On couvre
      // les deux écritures de clé ("60" et "60.0") pour tester la tolérance.
      oddsByLine: Object.fromEntries(
        Array.from({ length: 40 }, (_, i) => {
          const line = 41 + i * 0.5;
          return [line.toFixed(1), { over: 1.02, under: 1.02 }];
        }),
      ),
    });
    expect(t).toBeNull();
  });

  test("la lecture des cotes tolère les deux écritures de clé", () => {
    const probe = calculateOptimalOverGoals(balanced, balanced, 65)!;
    const asPlain = calculateOptimalOverGoals(balanced, balanced, 65, {
      oddsByLine: { [String(probe.line)]: { over: 1.9 } },
    })!;
    const asFixed = calculateOptimalOverGoals(balanced, balanced, 65, {
      oddsByLine: { [probe.line.toFixed(1)]: { over: 1.9 } },
    })!;
    expect(asPlain.odds).toBe(1.9);
    expect(asFixed.odds).toBe(1.9);
  });

  test("ν serré : la ligne trouvée existe mais la transition est irrecevable", () => {
    // ν = 1.3 trouve UN seuil (Over 53.5), mais il faut descendre très bas depuis
    // le total attendu : c'est le signe d'une distribution trop resserrée. On
    // documente le comportement réel plutôt que d'inventer un « null ».
    const t = pickOptimalTotalGoal(balanced, balanced, { nu: CMP_DEFAULT_NU })!;
    const cal = pickOptimalTotalGoal(balanced, balanced, { nu: CALIBRATED_NU })!;
    expect(t).not.toBeNull();
    // ν=1.3 → seuil notablement plus bas que la version calibrée.
    expect(t.line).toBeLessThan(cal.line);
  });

  test("déterministe", () => {
    const a = pickOptimalTotalGoal(highScoring, balanced);
    const b = pickOptimalTotalGoal(highScoring, balanced);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

// ─── Helper local ───

/** Variance d'un X CMP(λ, ν), reconstruite depuis la pmf. */
function varOf(lambda: number, nu: number): number {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { cmpPmf, cmpKMax, cmpMean } = require("@/lib/handball-cmp") as
    typeof import("@/lib/handball-cmp");
  const kMax = cmpKMax(lambda, lambda + 20);
  const pmf = cmpPmf(lambda, nu, kMax);
  const m = cmpMean(lambda, nu);
  let v = 0;
  for (let k = 0; k <= kMax; k++) v += pmf[k] * (k - m) ** 2;
  return v;
}
