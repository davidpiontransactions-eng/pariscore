"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Chart, ChartData, ChartConfiguration } from "chart.js";
import { Area } from "chartjs-plugin-annotation";
import { useTranslations } from "next-intl";

/**
 * ValueBetTimeline — Timeline de valeur ROI sur les paris value.
 *
 * Affiche en inline chart ci-dessous le banquier:
 * - Cumul P&L théorique si toutes les value bets au niveau de confiance actuel étaient placées
 * - Simulation gagnant/perdue roulante basée sur les probabilités implicites
 * - Moyenne pondérée par la confiance sur 10 / 50 / 100 paris
 *
 * Utilise Chart.js avec plugins pour:
 * - Zone remplie sous la courbe (vert/gain, rouge/perte)
 * - Ligne de référence zéro
 * - Points de données avec tooltips au survol
 * - Animation fluide à chaque mise à jour
 */
type ValueBetTimelineProps = {
  /** Nombre de paris simulés (10, 50, ou 100) */
  simulationCount?: number;
  /** Largeur en caractères du container (pour grille responsive) */
  widthChars?: number;
  /** Hauteur en lignes du container */
  heightLines?: number;
  /** Callback sur clic d'un point de données */
  onDataPointClick?: (day: number, cumulativePnL: number, confidence: number) => void;
};

/**
 * Génère une séquence de jours de paris value simulateurs.
 * Dans un cas réel, ces données viendraient d'une historique de paris.
 * Ici, nous générons une séquence synthétique basée sur la confiance moyenne.
 */
function generateSimulationData(
  count: number,
  avgEdge: number = 0.03, // 3% edge moyenne
  variance: number = 0.05 // 5% variance
) {
  const data = [];
  let cumulative = 0;

  for (let i = 0; i < count; i++) {
    // Générer un résultat aléatoire basé sur l'edge
    const random = Math.random();
    const winProb = avgEdge / (avgEdge + variance); // probabilité implicite simplifiée
    const wins = random < winProb ? 1 : 0;

    // Gain/perte simplifié: mise unitaire = 1, cotes moyennes = 2.0
    const pnl = wins ? 1.0 : -1.0; // simplified: profit = stake * (odds - 1)
    cumulative += pnl;

    data.push({
      day: i + 1,
      cumulativePnL: cumulative,
      confidence: ((count - i) / count * 100).toFixed(0),
      winRate: ((data.filter((d) => d.cumulativePnL > 0).length / (i + 1)) * 100).toFixed(0),
    });
  }

  return data;
}

/**
 * ValueBetTimeline — Timeline de valeur ROI sur les paris value.
 *
 * Affiche une grille responsive de simulations de valeur sur différents
 * horisons (10/50/100 paris) avec:
 * - Courbe cumul P&L (zone vert/ gains, rouge/ pertes)
 * - Ligne de référence zéro
 * - Tooltips au survel displaying confiance, taux de gain
 * - Moyenne pondérée sur les trois horizons
 */
export function ValueBetTimeline({
  simulationCount = 50,
  widthChars = 40,
  heightLines = 10,
  onDataPointClick,
}: ValueBetTimelineProps) {
  const [selectedPoint, setSelectedPoint] = useState<{ day: number } | null>(null);
  const t = useTranslations("bankroll");

  // Générer les données pour les trois horizons
  const data10 = useMemo(() => generateSimulationData(10), []);
  const data50 = useMemo(() => generateSimulationData(50), []);
  const data100 = useMemo(() => generateSimulationData(100), []);

  // Calculer les moyennes pondérées
  const calculateAverage = (data: typeof data10) => {
    const finalPnL = data[data.length - 1].cumulativePnL;
    const profitableDays = data.filter((d) => d.cumulativePnL > 0).length;
    const avgConfidence =
      data.reduce((sum, d) => sum + parseInt(d.confidence ?? "0"), 0) /
      data.length;
    return {
      finalPnL,
      profitableDays,
      profitabilityRate: (profitableDays / data.length) * 100,
      avgConfidence: Math.round(avgConfidence),
    };
  };

  const avg10 = calculateAverage(data10);
  const avg50 = calculateAverage(data50);
  const avg100 = calculateAverage(data100);

  // Configuration Chart.js
  useEffect(() => {
    // Chart.js n'est disponible que côté navigateur
    const ctx = (document.getElementById("value-bet-timeline-chart") as HTMLCanvasElement)
      .getContext("2d");

    if (!ctx) return;

    new Chart(ctx, {
      type: "line",
      data: {
        datasets: [
          {
            label: t("simulation10"),
            data: data10.map((d) => ({
              x: d.day,
              y: d.cumulativePnL,
            })),
            borderColor: "#10b981",
            backgroundColor: "rgba(16, 185, 129, 0.15)",
            tension: 0.3,
            fill: true,
            pointRadius: 0,
          },
          {
            label: t("simulation50"),
            data: data50.map((d) => ({
              x: d.day,
              y: d.cumulativePnL,
            })),
            borderColor: "#f59e0b",
            backgroundColor: "rgba(245, 158, 11, 0.15)",
            tension: 0.3,
            fill: true,
            pointRadius: 0,
          },
          {
            label: t("simulation100"),
            data: data100.map((d) => ({
              x: d.day,
              y: d.cumulativePnL,
            })),
            borderColor: "#ef4444",
            backgroundColor: "rgba(239, 68, 68, 0.15)",
            tension: 0.3,
            fill: true,
            pointRadius: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 500,
          easing: "easeOutQuart",
        },
        hover: {
          mode: "nearest",
          intersect: false,
        },
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            enabled: true,
            backgroundColor: "#1f2937",
            titleColor: "#f9fafb",
            bodyColor: "#d1d5db",
            borderColor: "#374151",
            borderWidth: 1,
            padding: 8,
            callbacks: {
              label: function (context) {
                const point = context.parsedY;
                const day = context.dataIndex + 1;
                const confidence = context.dataset.label === t("simulation10")
                  ? avg10.avgConfidence
                  : context.dataset.label === t("simulation50")
                  ? avg50.avgConfidence
                  : avg100.avgConfidence;
                return `${t("day")} ${day}: ${point >= 0 ? "+" : ""}${point} ${t("pnl")} — ${t("confidence")}: ${confidence}%`;
              },
            },
          },
        },
        scales: {
          x: {
            display: false,
            grid: { display: false },
          },
          y: {
            display: true,
            grid: { color: "rgba(0, 0, 0, 0.1)" },
            title: {
              display: true,
              text: t("cumulative_pnl"),
            },
            ticks: {
              callback: (value: number) => (value >= 0 ? `+${value}` : value.toString()),
            },
          },
        },
      },
      plugins: [Area],
    });
  }, [simulationCount]);

  return (
    <div
      className={cn(
        "value-bet-timeline bg-card/80 rounded-xl p-4 sm:p-6 border border-border/50 backdrop-blur",
        " max-w-[400px] w-full",
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="text-sm font-medium text-slate-300">
          {t("value_timeline_title")}
        </span>
        <span
          className={cn(
            "text-xs font-semibold",
            avg100.finalPnL >= 0 ? "text-green-400" : "text-red-400",
          )}
        >
          {avg100.finalPnL >= 0 ? "+" : ""}{avg100.finalPnL} {t("units")}
        </span>
      </div>

      {/* Résumé des trois horizons */}
      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <div
          className={cn(
            "flex-1 px-2 py-1 rounded-md bg-green-500/10 text-green-400 text-xs sm:text-center",
            "hover:bg-green-500/20 transition-colors",
          )}
        >
          <div>{avg10.finalPnL >= 0 ? "+" : ""}{avg10.finalPnL}</div>
          <div className="mt-0.5">{t("bets_10")}</div>
        </div>
        <div
          className={cn(
            "flex-1 px-2 py-1 rounded-md bg-amber-500/10 text-amber-400 text-xs sm:text-center",
            "hover:bg-amber-500/20 transition-colors",
          )}
        >
          <div>{avg50.finalPnL >= 0 ? "+" : ""}{avg50.finalPnL}</div>
          <div className="mt-0.5">{t("bets_50")}</div>
        </div>
        <div
          className={cn(
            "flex-1 px-2 py-1 rounded-md bg-red-500/10 text-red-400 text-xs sm:text-center",
            "hover:bg-red-500/20 transition-colors",
          )}
        >
          <div>{avg100.finalPnL >= 0 ? "+" : ""}{avg100.finalPnL}</div>
          <div className="mt-0.5">{t("bets_100")}</div>
        </div>
      </div>

      {/* Canvas Chart.js */}
      <canvas
        id="value-bet-timeline-chart"
        width={widthChars * 10}
        height={heightLines * 20}
        className="hidden" // Caché par défaut, initialisé via useEffect
        role="img"
        aria-label={t("value_timeline_aria_label", {
          finalPnL: `${avg100.finalPnL >= 0 ? "+" : ""}${avg100.finalPnL}`,
          confidence: avg100.avgConfidence,
        })}
      />

      {/* Indicateur quand Chart.js n'est pas disponible */}
      {/**@noReact@*/(
        <div
          className={
            "bg-slate-950/50 rounded border border-slate-700/50 p-3 text-xs text-slate-400"
          }
        >
          {t("chart_unavailable")}
        </div>
      )}
    </div>
  );
}