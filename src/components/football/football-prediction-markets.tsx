"use client";

// football-prediction-markets.tsx
// Panneau unifié des 6 marchés de prédiction football.
// Affiche 1X2, Double Chance, Over/Under, BTTS, Corners et Score Exact
// dans une grille compacte (2x3) ou en mode inline.

import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import type { Prediction } from "@/lib/football-data";

// ─── Types ────────────────────────────────────────────────────────────────

export type FootballPredictionMarketsProps = {
  prediction: Prediction;
  match?: {
    homeTeam: string;
    awayTeam: string;
    league?: string;
  };
  compact?: boolean;
};

// ─── Helpers ──────────────────────────────────────────────────────────────

/** Retourne la classe de couleur selon la probabilité. */
function probColor(p: number): string {
  if (p >= 65) return "text-emerald-500";
  if (p >= 50) return "text-emerald-400";
  return "text-muted-foreground";
}

/** Largeur de barre en pourcentage (max 100). */
function barW(p: number): string {
  return `${Math.min(100, Math.max(0, p))}%`;
}

/** Score exact simplifié : top 3 basé sur la probabilité 1X2.
 *  Utilise une approximation Poisson tronquée (lambda ~ 1.3 home, ~1.0 away)
 *  sans importer la matrice complète. */
function approxTopScores(homeProb: number, awayProb: number) {
  // Lambda approximatif inversé depuis les probs 1X2
  const lambdaH = Math.max(0.4, homeProb / 50); // ~homeProb% → lambda
  const lambdaA = Math.max(0.3, awayProb / 50);

  // Scores les plus probables avec lambda typiques football
  const candidates: { h: number; a: number; label: string }[] = [
    { h: 1, a: 0, label: "1-0" },
    { h: 0, a: 0, label: "0-0" },
    { h: 1, a: 1, label: "1-1" },
    { h: 2, a: 1, label: "2-1" },
    { h: 0, a: 1, label: "0-1" },
    { h: 2, a: 0, label: "2-0" },
    { h: 1, a: 2, label: "1-2" },
    { h: 2, a: 2, label: "2-2" },
  ];

  // Approximation Poisson pour chaque score
  const poisson = (lam: number, k: number) => {
    if (lam <= 0) return k === 0 ? 1 : 0;
    return Math.exp(-lam + k * Math.log(lam) - logFactorial(k));
  };
  const logFactorial = (n: number) => {
    let s = 0;
    for (let i = 2; i <= n; i++) s += Math.log(i);
    return s;
  };

  const scored = candidates
    .map((c) => ({ ...c, prob: poisson(lambdaH, c.h) * poisson(lambdaA, c.a) }))
    .sort((a, b) => b.prob - a.prob);

  return scored.slice(0, 3).map((s) => ({
    label: s.label,
    prob: Math.round(s.prob * 100),
  }));
}

// ─── Sous-composants ──────────────────────────────────────────────────────

/** Section 1X2 : barre empilée horizontale. */
function Section1X2({
  homeProb,
  drawProb,
  awayProb,
  compact,
}: {
  homeProb: number;
  drawProb: number;
  awayProb: number;
  compact: boolean;
}) {
  if (compact) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="text-emerald-500 font-bold tabular-nums">{Math.round(homeProb)}%</span>
        <span className="text-muted-foreground">-</span>
        <span className="text-muted-foreground tabular-nums">{Math.round(drawProb)}%</span>
        <span className="text-muted-foreground">-</span>
        <span className="text-rose-500 font-bold tabular-nums">{Math.round(awayProb)}%</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Barre empilée */}
      <div className="h-6 flex rounded-md overflow-hidden text-xs font-bold">
        <div
          className="bg-emerald-500 flex items-center justify-center text-white transition-all"
          style={{ width: barW(homeProb) }}
        >
          {homeProb >= 20 && `${Math.round(homeProb)}%`}
        </div>
        <div
          className="bg-slate-400 dark:bg-slate-500 flex items-center justify-center text-white transition-all"
          style={{ width: barW(drawProb) }}
        >
          {drawProb >= 15 && `${Math.round(drawProb)}%`}
        </div>
        <div
          className="bg-rose-500 flex items-center justify-center text-white transition-all"
          style={{ width: barW(awayProb) }}
        >
          {awayProb >= 20 && `${Math.round(awayProb)}%`}
        </div>
      </div>
      {/* Labels sous la barre */}
      <div className="flex justify-between text-xs text-muted-foreground">
        <span className={probColor(homeProb)}>Dom. {Math.round(homeProb)}%</span>
        <span>Nul {Math.round(drawProb)}%</span>
        <span className={probColor(awayProb)}>Ext. {Math.round(awayProb)}%</span>
      </div>
    </div>
  );
}

/** Section Double Chance : 3 chips. */
function SectionDoubleChance({
  homeProb,
  drawProb,
  awayProb,
  compact,
}: {
  homeProb: number;
  drawProb: number;
  awayProb: number;
  compact: boolean;
}) {
  const p1X = homeProb + drawProb;
  const pX2 = drawProb + awayProb;
  const p12 = homeProb + awayProb;

  const selections = [
    { label: "1X", prob: p1X },
    { label: "X2", prob: pX2 },
    { label: "12", prob: p12 },
  ];

  if (compact) {
    const best = selections.reduce((a, b) => (a.prob > b.prob ? a : b));
    return (
      <span className="text-sm font-bold tabular-nums">
        {best.label} {Math.round(best.prob)}%
      </span>
    );
  }

  return (
    <div className="flex gap-1.5 flex-wrap">
      {selections.map((s) => (
        <span
          key={s.label}
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums
            ${s.prob >= 65 ? "bg-emerald-500/15 text-emerald-500" : "bg-muted text-muted-foreground"}`}
        >
          {s.label} {Math.round(s.prob)}%
        </span>
      ))}
    </div>
  );
}

/** Section Over/Under : deux barres comparatives. */
function SectionOverUnder({
  over25Prob,
  over15Prob,
  under35Prob,
  compact,
}: {
  over25Prob: number;
  over15Prob?: number;
  under35Prob?: number;
  compact: boolean;
}) {
  const under25Prob = 100 - over25Prob;

  if (compact) {
    return (
      <span className="text-sm tabular-nums">
        <span className="text-blue-500 font-bold">O2.5 {Math.round(over25Prob)}%</span>
        <span className="text-muted-foreground mx-1">/</span>
        <span className="text-orange-500 font-bold">U2.5 {Math.round(under25Prob)}%</span>
      </span>
    );
  }

  return (
    <div className="space-y-2">
      {/* Barre O/U principale */}
      <div className="h-5 flex rounded overflow-hidden text-xs font-bold">
        <div
          className="bg-blue-500 flex items-center justify-center text-white transition-all"
          style={{ width: barW(over25Prob) }}
        >
          {over25Prob >= 25 && `O2.5 ${Math.round(over25Prob)}%`}
        </div>
        <div
          className="bg-orange-500 flex items-center justify-center text-white transition-all"
          style={{ width: barW(under25Prob) }}
        >
          {under25Prob >= 25 && `U2.5 ${Math.round(under25Prob)}%`}
        </div>
      </div>
      {/* Secondaires */}
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>O1.5: {over15Prob != null ? `${Math.round(over15Prob)}%` : "—"}</span>
        <span>U3.5: {under35Prob != null ? `${Math.round(under35Prob)}%` : "—"}</span>
      </div>
    </div>
  );
}

/** Section BTTS : Yes/No avec barres. */
function SectionBTTS({
  bttsProb,
  compact,
}: {
  bttsProb: number;
  compact: boolean;
}) {
  const noBtts = 100 - bttsProb;
  const highlight = bttsProb >= 60;

  if (compact) {
    return (
      <span className={`text-sm font-bold tabular-nums ${highlight ? "text-emerald-500" : "text-muted-foreground"}`}>
        Oui {Math.round(bttsProb)}%
      </span>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="h-5 flex rounded overflow-hidden text-xs font-bold">
        <div
          className={`flex items-center justify-center text-white transition-all ${highlight ? "bg-emerald-500" : "bg-slate-400 dark:bg-slate-500"}`}
          style={{ width: barW(bttsProb) }}
        >
          {bttsProb >= 20 && `Oui ${Math.round(bttsProb)}%`}
        </div>
        <div
          className="bg-rose-400 flex items-center justify-center text-white transition-all"
          style={{ width: barW(noBtts) }}
        >
          {noBtts >= 20 && `Non ${Math.round(noBtts)}%`}
        </div>
      </div>
      {highlight && (
        <span className="text-xs text-emerald-500 font-medium">BTTS fortement favorisé</span>
      )}
    </div>
  );
}

/** Section Corners : meilleure ligne over. */
function SectionCorners({
  bestCornerOver,
  compact,
}: {
  bestCornerOver?: Prediction["bestCornerOver"];
  compact: boolean;
}) {
  if (!bestCornerOver) {
    return <span className="text-xs text-muted-foreground">Non disponible</span>;
  }

  if (compact) {
    return (
      <span className="text-sm tabular-nums">
        <span className="text-blue-500 font-bold">O{bestCornerOver.line} {Math.round(bestCornerOver.overProb)}%</span>
      </span>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-baseline gap-1.5">
        <span className="text-sm font-bold text-blue-500 tabular-nums">
          Over {bestCornerOver.line}
        </span>
        <span className="text-lg font-bold tabular-nums">{Math.round(bestCornerOver.overProb)}%</span>
      </div>
      <div className="text-xs text-muted-foreground tabular-nums">
        O6.5: {Math.round(bestCornerOver.over65Prob)}%
      </div>
    </div>
  );
}

/** Section Score Exact : top 3 scores approximatifs. */
function SectionCorrectScore({
  homeProb,
  awayProb,
  compact,
}: {
  homeProb: number;
  awayProb: number;
  compact: boolean;
}) {
  const scores = useMemo(() => approxTopScores(homeProb, awayProb), [homeProb, awayProb]);

  if (compact) {
    const best = scores[0];
    return (
      <span className="text-sm font-bold tabular-nums">
        {best.label} ({best.prob}%)
      </span>
    );
  }

  return (
    <div className="space-y-1">
      {scores.map((s, i) => (
        <div key={s.label} className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <span className={`w-5 h-5 rounded flex items-center justify-center text-xs font-bold
              ${i === 0 ? "bg-amber-500/15 text-amber-600" : "bg-muted text-muted-foreground"}`}>
              {i + 1}
            </span>
            <span className="font-bold tabular-nums">{s.label}</span>
          </div>
          <span className={`tabular-nums ${probColor(s.prob)}`}>{s.prob}%</span>
        </div>
      ))}
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────

export function FootballPredictionMarkets({
  prediction,
  match,
  compact = false,
}: FootballPredictionMarketsProps) {
  const {
    homeProb,
    drawProb,
    awayProb,
    bttsProb,
    over25Prob,
    over15Prob,
    under35Prob,
    bestCornerOver,
  } = prediction;

  // Mode compact : rangée horizontale unique
  if (compact) {
    return (
      <Card className="w-full">
        <CardContent className="py-3 px-4">
          <div className="flex items-center gap-4 flex-wrap text-xs">
            <Section1X2
              homeProb={homeProb}
              drawProb={drawProb}
              awayProb={awayProb}
              compact
            />
            <span className="text-border">|</span>
            <SectionDoubleChance
              homeProb={homeProb}
              drawProb={drawProb}
              awayProb={awayProb}
              compact
            />
            <span className="text-border">|</span>
            <SectionOverUnder over25Prob={over25Prob} over15Prob={over15Prob} under35Prob={under35Prob} compact />
            <span className="text-border">|</span>
            <SectionBTTS bttsProb={bttsProb} compact />
            <span className="text-border">|</span>
            <SectionCorners bestCornerOver={bestCornerOver} compact />
            <span className="text-border">|</span>
            <SectionCorrectScore homeProb={homeProb} awayProb={awayProb} compact />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Mode complet : grille 3 colonnes x 2 lignes
  const sections: { key: string; title: string; content: React.ReactNode }[] = [
    {
      key: "1x2",
      title: "1X2",
      content: (
        <Section1X2
          homeProb={homeProb}
          drawProb={drawProb}
          awayProb={awayProb}
          compact={false}
        />
      ),
    },
    {
      key: "dc",
      title: "Double Chance",
      content: (
        <SectionDoubleChance
          homeProb={homeProb}
          drawProb={drawProb}
          awayProb={awayProb}
          compact={false}
        />
      ),
    },
    {
      key: "ou",
      title: "Over/Under 2.5",
      content: (
        <SectionOverUnder
          over25Prob={over25Prob}
          over15Prob={over15Prob}
          under35Prob={under35Prob}
          compact={false}
        />
      ),
    },
    {
      key: "btts",
      title: "BTTS",
      content: <SectionBTTS bttsProb={bttsProb} compact={false} />,
    },
    {
      key: "corners",
      title: "Corners",
      content: <SectionCorners bestCornerOver={bestCornerOver} compact={false} />,
    },
    {
      key: "score",
      title: "Score Exact",
      content: (
        <SectionCorrectScore
          homeProb={homeProb}
          awayProb={awayProb}
          compact={false}
        />
      ),
    },
  ];

  return (
    <Card className="w-full">
      <CardContent className="p-4">
        {/* En-tête du match */}
        {match && (
          <div className="mb-4 pb-3 border-b border-border">
            <p className="text-sm font-semibold">
              {match.homeTeam} vs {match.awayTeam}
            </p>
            {match.league && (
              <p className="text-xs text-muted-foreground">{match.league}</p>
            )}
          </div>
        )}

        {/* Grille 3x2 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {sections.map((s, i) => (
            <div
              key={s.key}
              className={`space-y-2 p-3 rounded-lg bg-muted/30
                ${i % 3 !== 2 ? "sm:border-r sm:border-border" : ""}
                ${i < 3 ? "border-b border-border sm:border-b-0" : ""}`}
            >
              <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {s.title}
              </h3>
              {s.content}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
