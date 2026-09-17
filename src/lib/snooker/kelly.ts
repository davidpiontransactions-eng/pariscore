/**
 * Kelly Criterion — sizing optimal des mises
 *
 * Formule: f* = (bp - q) / b
 * b = cote decimale - 1, p = proba de gain, q = 1 - p
 *
 * Half-Kelly recommande pour reduire la variance (f divise par 2).
 * Source: Kelly (1956), "A New Interpretation of Information Rate"
 */

export type KellyResult = {
  /** Fraction optimale de bankroll (Kelly complet) */
  fullKelly: number;
  /** Fraction conservatrice (Half-Kelly) */
  halfKelly: number;
  /** Expected value en % de la mise */
  ev: number;
  /** ROI attendu en % */
  roi: number;
  /** Verdict */
  verdict: "strong" | "medium" | "weak" | "no_edge";
};

/**
 * Calcule le Kelly criterion pour un pari
 * @param modelProb - Probabilité estimée de gain (0-1)
 * @param odds - Cote décimale (ex: 2.0 pour "even money")
 * @returns Résultat Kelly avec verdict
 */
export function kellyCriterion(modelProb: number, odds: number): KellyResult {
  if (odds <= 1 || modelProb <= 0 || modelProb >= 1) {
    return { fullKelly: 0, halfKelly: 0, ev: 0, roi: 0, verdict: "no_edge" };
  }

  const b = odds - 1; // profit potentiel par unité mise
  const p = modelProb;
  const q = 1 - p;

  // Kelly fraction: f* = (bp - q) / b
  const fullKelly = Math.max(0, (b * p - q) / b);

  // Half-Kelly (recommandé)
  const halfKelly = fullKelly / 2;

  // Expected value: EV = p * b - q
  const ev = p * b - q;

  // ROI attendu
  const roi = fullKelly > 0 ? (ev / (fullKelly || 1)) * 100 : 0;

  // Verdict
  let verdict: KellyResult["verdict"];
  if (fullKelly <= 0) {
    verdict = "no_edge";
  } else if (fullKelly < 0.03) {
    verdict = "weak";
  } else if (fullKelly < 0.08) {
    verdict = "medium";
  } else {
    verdict = "strong";
  }

  return {
    fullKelly: Math.round(fullKelly * 1000) / 10, // en % (1 décimale)
    halfKelly: Math.round(halfKelly * 1000) / 10,
    ev: Math.round(ev * 1000) / 10,
    roi: Math.round(roi * 10) / 10,
    verdict,
  };
}

/**
 * Formate le verdict en texte court
 */
export function verdictLabel(v: KellyResult["verdict"]): string {
  switch (v) {
    case "strong": return "Fort edge";
    case "medium": return "Edge moyen";
    case "weak": return "Léger edge";
    case "no_edge": return "Pas d'edge";
  }
}

/**
 * Formate le verdict en couleur Tailwind
 */
export function verdictColor(v: KellyResult["verdict"]): string {
  switch (v) {
    case "strong": return "#00985f";
    case "medium": return "#FF6D00";
    case "weak": return "#2196F3";
    case "no_edge": return "#9e9e9e";
  }
}

/**
 * Calcule le Kelly avec probabilité du modèle ET cotes marché réelles
 * @param modelProb - Probabilité estimée par le modèle (0-1)
 * @param marketOdds - Cotes du marché (décimales, ex: 2.10)
 */
export function kellyFromProb(modelProb: number, marketOdds?: number): KellyResult {
  if (!marketOdds || marketOdds <= 1) {
    return { fullKelly: 0, halfKelly: 0, ev: 0, roi: 0, verdict: "no_edge" };
  }
  return kellyCriterion(modelProb, marketOdds);
}

/**
 * Simule un bankroll sur N paris avec Kelly sizing
 * @param bets - Array de { probability, odds, won }
 * @param initialBankroll - Bankroll initiale en units
 * @param fraction - Fraction de Kelly (0.5 = half-Kelly)
 * @returns Évolution du bankroll
 */
export function simulateBankroll(
  bets: { probability: number; odds: number; won: boolean }[],
  initialBankroll: number = 100,
  fraction: number = 0.5
): { bankroll: number[]; final: number; maxDrawdown: number; roi: number } {
  const bankroll: number[] = [initialBankroll];
  let current = initialBankroll;
  let peak = initialBankroll;
  let maxDrawdown = 0;

  for (const bet of bets) {
    const kelly = kellyCriterion(bet.probability, bet.odds);
    const stake = current * (kelly.fullKelly * fraction) / 100;

    if (stake <= 0) {
      bankroll.push(current);
      continue;
    }

    if (bet.won) {
      current += stake * (bet.odds - 1);
    } else {
      current -= stake;
    }

    current = Math.max(0, current);
    bankroll.push(Math.round(current * 100) / 100);

    // Max drawdown
    if (current > peak) peak = current;
    const dd = (peak - current) / peak;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  const roi = ((current - initialBankroll) / initialBankroll) * 100;

  return {
    bankroll,
    final: Math.round(current * 100) / 100,
    maxDrawdown: Math.round(maxDrawdown * 1000) / 10,
    roi: Math.round(roi * 10) / 10,
  };
}
