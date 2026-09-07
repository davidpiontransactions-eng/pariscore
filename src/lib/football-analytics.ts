// Service analytics foot — Pwin, EV, confidence basés sur PowerScore / Elo proxy
// Utilisé par src/lib/top-matches/football.ts pour enrichir les matchs de métriques

export interface FootMatchProb {
  probHome: number;
  probDraw: number;
  probAway: number;
  /** Valeur attendue = Pwin * cote - 1, pour le favori */
  ev: number | null;
  /** Trend : différence entre l'EV actuelle et l'EV moyenne sur la fenêtre */
  trend: number | null;
  /** Niveau de confiance 1-3 */
  confidence: 1 | 2 | 3;
  /** Label de confiance */
  confidenceLabel: string;
  /** Prob en pourcentage arrondi */
  probPct: number;
}

/**
 * Calcule la probabilité réelle (de-vig) à partir des cotes marché.
 * Si une cote manque, elle est ignorée dans le pool de vig.
 */
export function deVig(odds: { home: number; draw?: number | null; away: number }): { home: number; draw: number; away: number } {
  const invH = 1 / odds.home;
  const invD = odds.draw && odds.draw > 1 ? 1 / odds.draw : 0;
  const invA = 1 / odds.away;
  const total = invH + invD + invA;
  if (total <= 0) return { home: 1 / 3, draw: 1 / 3, away: 1 / 3 };
  return {
    home: invH / total,
    draw: invD / total,
    away: invA / total,
  };
}

/**
 * Calcule les métriques Pwin, EV, trend pour un match donné.
 * @param homeOdds cote domicile (si null → 0.33 prob uniforme)
 * @param drawOdds cote nul (si null ou ≤1 → égalité considérée 0)
 * @param awayOdds cote extérieur
 * @param homeStrength force relative domicile 0-100 (50 = neutre)
 * @param awayStrength force relative extérieur 0-100
 */
export function computeMatchProb(
  homeOdds?: number | null,
  drawOdds?: number | null,
  awayOdds?: number | null,
  homeStrength: number = 50,
  awayStrength: number = 50,
): FootMatchProb {
  // Probabilité implicite du marché (de-vig)
  let marketProb: { home: number; draw: number; away: number };
  if (homeOdds && homeOdds > 1 && awayOdds && awayOdds > 1) {
    marketProb = deVig({ home: homeOdds, draw: drawOdds ?? null, away: awayOdds });
  } else {
    // Fallback : prob uniforme
    marketProb = { home: 0.4, draw: 0.25, away: 0.35 };
  }

  // PowerScore proxy : strength diff → prob base
  const totalStrength = homeStrength + awayStrength;
  const rawHomeProb = totalStrength > 0 ? homeStrength / totalStrength : 0.5;
  const rawAwayProb = totalStrength > 0 ? awayStrength / totalStrength : 0.5;

  // Blended : 60% market + 40% power score
  const blendHome = 0.6 * marketProb.home + 0.4 * rawHomeProb;
  const blendAway = 0.6 * marketProb.away + 0.4 * rawAwayProb;
  const blendDraw = 0.6 * marketProb.draw + 0.25 * (1 - blendHome - blendAway);

  // Normalisation
  const totalBlend = blendHome + blendDraw + blendAway;
  const probHome = totalBlend > 0 ? blendHome / totalBlend : 0.4;
  const probDraw = totalBlend > 0 ? blendDraw / totalBlend : 0.2;
  const probAway = totalBlend > 0 ? blendAway / totalBlend : 0.4;

  // EV du favori
  const isHomeFav = probHome >= probAway;
  const favProb = isHomeFav ? probHome : probAway;
  const favOdds = isHomeFav ? homeOdds : awayOdds;
  const ev = favOdds && favOdds > 1 ? favProb * favOdds - 1 : null;

  // Trend : basé sur l'écart entre prob marché brute et prob blend
  // Si la blend est > market → le modèle est plus confiant que le marché = trend positif
  const marketFavProb = isHomeFav ? marketProb.home : marketProb.away;
  const trend = marketFavProb > 0 ? favProb - marketFavProb : null;

  // Confiance
  const probPct = Math.round(favProb * 100);
  let confidence: 1 | 2 | 3;
  let confidenceLabel: string;
  if (probPct >= 78) {
    confidence = 3;
    confidenceLabel = 'Très Forte';
  } else if (probPct >= 65) {
    confidence = 2;
    confidenceLabel = 'Confiance Élevée';
  } else {
    confidence = 1;
    confidenceLabel = 'Valeur / Risque';
  }

  return {
    probHome: Math.round(probHome * 1000) / 1000,
    probDraw: Math.round(probDraw * 1000) / 1000,
    probAway: Math.round(probAway * 1000) / 1000,
    ev: ev !== null ? Math.round(ev * 1000) / 1000 : null,
    trend: trend !== null ? Math.round(trend * 10000) / 10000 : null,
    confidence,
    confidenceLabel,
    probPct,
  };
}