import { predictPrematch } from "@/lib/prediction/football/engine";

/* ─── Barre Win probability 1X2 façon BeSoccer ─── */

export type EloBar = { home: number; draw: number; away: number }; // 0-100

/**
 * Proba 1X2 du modèle (blend Poisson + cotes si fournies).
 * Libellé honnête : « Win probability », pas « ELO » (Elo équipes inconnus).
 */
export function eloBarForMatch(o: {
  homeOdds?: number | null;
  drawOdds?: number | null;
  awayOdds?: number | null;
}): EloBar {
  const hasOdds =
    o.homeOdds != null && o.drawOdds != null && o.awayOdds != null;
  const r = predictPrematch(
    hasOdds
      ? { odds: { home: o.homeOdds as number, draw: o.drawOdds as number, away: o.awayOdds as number } }
      : {}
  );
  const m = r.markets!;
  return { home: m.homeWin, draw: m.draw, away: m.awayWin };
}
