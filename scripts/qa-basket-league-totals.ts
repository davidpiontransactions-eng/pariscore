#!/usr/bin/env bun
/**
 * qa-basket-league-totals.ts — MESURE des totaux et marges réels par ligue,
 * lus depuis basketball_match_history. Sortie : fichier de rapport (stdout des
 * exécutables n'est pas capturé par le shell de l'agent).
 *
 * But : remplacer les constantes inventées du backtest (Over 215.5 / seuil
 * 220, calibrées NBA) par des valeurs propres à chaque ligue.
 */

import fs from "node:fs";
import path from "node:path";
import {
  basketballHistoryMeta,
  loadBasketballHistory,
} from "../src/lib/basketball-history-db";

const OUT = path.join(process.cwd(), "logs", "qa-basket-league-totals.txt");

const quantile = (sorted: number[], q: number): number => {
  if (!sorted.length) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
};

const sd = (xs: number[]): number => {
  if (!xs.length) return NaN;
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length);
};

const roundHalf = (v: number) => Math.round(v * 2) / 2;

const lines: string[] = [];
const meta = basketballHistoryMeta();

if (!meta) {
  lines.push("BASE INTROUVABLE");
} else {
  lines.push(`total=${meta.total}`);
  for (const { league, n } of meta.byLeague) {
    const rows = loadBasketballHistory({ league, limit: 5000 });
    const totals: number[] = [];
    const margins: number[] = [];
    let otCount = 0;
    for (const r of rows) {
      if (!Number.isFinite(r.homeScore) || !Number.isFinite(r.awayScore)) continue;
      // Un match avec prolongation se reconnaît aux quart-temps : >4 = OT.
      // On les écarte de la ligne de base pour ne pas gonfler le total.
      const isOt =
        (r.homeQuarters?.length ?? 0) > 4 || (r.awayQuarters?.length ?? 0) > 4;
      if (isOt) {
        otCount++;
        continue;
      }
      totals.push(r.homeScore + r.awayScore);
      margins.push(r.homeScore - r.awayScore);
    }
    totals.sort((a, b) => a - b);
    const p50 = totals.length ? quantile(totals, 0.5) : NaN;
    lines.push(
      [
        league.padEnd(12),
        `n=${String(n).padStart(5)}`,
        `reg=${String(totals.length).padStart(5)}`,
        `ot=${String(otCount).padStart(4)}`,
        `mean=${(totals.length ? totals.reduce((a, b) => a + b, 0) / totals.length : NaN).toFixed(1)}`,
        `p45=${(totals.length ? quantile(totals, 0.45) : NaN).toFixed(1)}`,
        `p50=${p50.toFixed(1)}`,
        `p55=${(totals.length ? quantile(totals, 0.55) : NaN).toFixed(1)}`,
        `sdTotal=${sd(totals).toFixed(1)}`,
        `LINE=${roundHalf(p50)}`,
        `sdMargin=${sd(margins).toFixed(1)}`,
        `homeMargin=${(margins.length ? margins.reduce((a, b) => a + b, 0) / margins.length : NaN).toFixed(2)}`,
        `homeWin=${(rows.length ? (rows.filter((r) => r.homeScore > r.awayScore).length / rows.length) * 100 : NaN).toFixed(1)}%`,
      ].join(" "),
    );
  }
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, lines.join("\n") + "\n", "utf8");
console.log("écrit", OUT);