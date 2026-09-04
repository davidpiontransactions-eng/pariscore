"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

/**
 * BankrollHeatmap — Heatmap historique du bankroll.
 *
 * Affiche une barre horizontale colorée montrant les périodes
 * bénéficiaires (vert) et perdantes (rouge) de l'historique des paris.
 * L'utilisateur peut faire glisser pour sélectionner une plage de dates.
 *
 * Utilisation :
 * - Placée en entête du panneau de bankroll
 * - Largeur fixe de 1rem de hauteur
 * - Couleurs: emerald pour gains, destructive pour pertes
 * - Accessible: aria-label, focus-visible, contrast ≥ 4.5:1
 */
type BankrollHeatmapProps = {
  /** Nombre de périodes historiques à afficher (par défaut: 30 jours) */
  historicalDays?: number;
  /** Largeur de la barre en caractères (par défaut: 40) */
  widthChars?: number;
  /** Hauteur en lignes de texte (par défaut: 1.5) */
  heightLines?: number;
  /** Date de début de l'historique (optionnel - par défaut: 30j avant aujourd'hui) */
  startDate?: Date;
  /** Date de fin (optionnel - par défaut: aujourd'hui) */
  endDate?: Date;
  /** Callback sur changement de sélection de période */
  onPeriodSelect?: (start: Date, end: Date) => void;
  /** Classe CSS additionnelle */
  className?: string;
};

/**
 * Génère des données de périodicité simulé pour la heatmap.
 * Dans un cas réel, ces données viendraient de l'historique des paris de l'utilisateur.
 * Ici, nous générons une séquence synthétique avec des périodes alternées
 * de gains et de pertes pour démontrer le composant.
 */
function generateHeatmapData(
  days: number,
  startDate: Date,
): Array<{ date: Date; profit: number; isProfitable: boolean }> {
  const data = [];
  const timeDiff = days * 24 * 60 * 60 * 1000; // ms par journée
  let currentDate = new Date(startDate.getTime());

  // Seed pour des résultats "réalistes" alternés
  let seed = 0;

  for (let i = 0; i < days; i++) {
    // Générer un pattern alterné tous les 3-5 jours
    seed = (seed + 7) % 10;
    const isProfitable = seed % 3 !== 0; // ~66% de périodes bénéficiaires
    const daysInPeriod = 3 + (seed % 3); // 3, 4 ou 5 jours par période
    const profit = isProfitable ? 1 + (seed * 0.2) : -1 - (seed * 0.2);

    for (let j = 0; j < daysInPeriod && i < days; j++, i++) {
      const dayDate = new Date(currentDate.getTime() + j * 24 * 60 * 60 * 1000);
      data.push({
        date: dayDate,
        profit: profit,
        isProfitable,
      });
    }

    currentDate = new Date(currentDate.getTime() + daysInPeriod * 24 * 60 * 60 * 1000);
  }

  return data;
}

/**
 * BankrollHeatmap — Heatmap historique du bankroll.
 *
 * Barre horizontale colorée montrant l'historique des périodes bénéficiaires/perdantes.
 * - Vert (emerald) = période bénéficiaire
 * - Rouge (destructive) = période perdante
 * - Gris (muted-foreground) = période neutre
 * - Interaction: glisser pour sélectionner une plage de dates
 */
export function BankrollHeatmap({
  historicalDays = 30,
  widthChars = 40,
  heightLines = 1.5,
  startDate,
  endDate,
  onPeriodSelect,
  className,
}: BankrollHeatmapProps) {
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedStartIdx, setSelectedStartIdx] = useState<number | null>(null);
  const [selectedEndIdx, setSelectedEndIdx] = useState<number | null>(null);
  const t = useTranslations("bankroll");

  // Dates par défaut si non fournies
  const defaultStart = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - historicalDays);
    return d;
  }, [historicalDays]);

  const defaultEnd = useMemo(() => {
    const d = new Date();
    return d;
  }, []);

  const heatStart = startDate ?? defaultStart;
  const heatEnd = endDate ?? defaultEnd;

  // Générer les données de heatmap
  const heatData = useMemo(() =>
    generateHeatmapData(historicalDays, heatStart),
    [historicalDays, heatStart],
  );

  // Calculer la largeur de chaque jour en pixels
  const dayWidth = Math.max(1, widthChars / historicalDays);

  // Calculer les couleurs pour chaque jour
  const dayColors = useMemo(() =>
    heatData.map((day) => (day.isProfitable ? "emerald" : "destructive")),
  [], [heatData]);

  // Gestion du drag pour sélection de période
  const handleMouseDown = useCallback(
    (e: React.MouseEvent, idx: number) => {
      setDragStart(idx);
      setIsDragging(true);
      setSelectedStartIdx(idx);
      setSelectedEndIdx(null);
    },
    [],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragStart || !isDragging) return;
      const clientX = e.clientX;
      // Trouver l'index sous le curseur
      const container = e.currentTarget as HTMLDivElement;
      const containerRect = container.getBoundingClientRect();
      const relativeX = clientX - containerRect.left;
      const idx = Math.max(0, Math.min(historicalDays - 1, Math.round(relativeX / dayWidth)));
      setSelectedEndIdx(idx);
    },
    [dragStart, isDragging, dayWidth, historicalDays],
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    if (dragStart !== null && selectedStartIdx !== null && selectedEndIdx !== null) {
      const start = Math.min(dragStart, selectedEndIdx);
      const end = Math.max(dragStart, selectedEndIdx);
      // Convertir les index en dates
      const startDate = new Date(heatStart.getTime() + start * 24 * 60 * 60 * 1000);
      const endDate = new Date(heatStart.getTime() + (end + 1) * 24 * 60 * 60 * 1000);
      onPeriodSelect?.(startDate, endDate);
    }
    setDragStart(null);
  }, [dragStart, selectedStartIdx, selectedEndIdx, heatStart, onPeriodSelect]);

  // Calculer les statistiques résumées
  const totalProfit = useMemo(() =>
    heatData.reduce((sum, day) => sum + day.profit, 0),
    [heatData],
  );
  const profitableDays = useMemo(() =>
    heatData.filter((day) => day.isProfitable).length,
    [heatData],
  );
  const profitabilityRate = historicalDays > 0
    ? (profitableDays / historicalDays) * 100
    : 0;

  return (
    <div
      className={cn(
        "bankroll-heatmap bg-card/80 rounded-xl p-2 sm:p-3 border border-border/50 backdrop-blur",
        " overflow-x-auto select-none",
        className,
      )}
      onMouseUp={handleMouseUp}
      role="region"
      aria-label={t("heatmap_aria_label", {
        profitableDays,
        historicalDays,
        totalProfit: totalProfit >= 0 ? `+${totalProfit}` : totalProfit,
        profitabilityRate: profitabilityRate.toFixed(0),
      })}
    >
      {/* Étiquette période sélectionnée */}
      {selectedStartIdx !== null && selectedEndIdx !== null && (
        <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
          <span>{t("period")}: </span>
          <span
            className={cn(
              "font-medium",
              totalProfit >= 0 ? "text-emerald-400" : "text-destructive",
            )}
          >
            {selectedStartIdx !== null ? "+" : ""}{totalProfit}
          </span>
          {t("over")}
          {historicalDays} {t("days")}
        </div>
      )}

      {/* Barre de heatmap */}
      <div
        className={cn(
          "relative h-[calc(1.5rem_/_2)] min-w-0 flex shrink-0",
          " fade-in",
        )}
        onMouseDown={(e) => handleMouseDown(e, 0)}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        {/* Fond gris neutre */}
        <div
          className={cn(
            "absolute inset-0 bg-slate-900/30 rounded-full overflow-hidden",
          )}
        />

        {/* Barres de période colorées */}
        {heatData.map((day, idx) => {
          const dayX = idx * dayWidth;
          const isSelected =
            selectedStartIdx !== null &&
            selectedEndIdx !== null &&
            idx >= Math.min(dragStart ?? 0, selectedEndIdx) &&
            idx <= Math.max(dragStart ?? 0, selectedEndIdx);

          const colorClass = day.isProfitable
            ? "bg-emerald-500/40"
            : "bg-destructive/40";

          const borderClass = day.isProfitable
            ? "border-emerald-500/50"
            : "border-destructive/50";

          const tooltipClass = day.isProfitable
            ? "bg-emerald-800/90"
            : "bg-destructive-800/90";

          return (
            <div
              key={day.date}
              className={cn(
                "absolute top-0 bottom-0 min-w-[1px]",
                `left-${dayX}px`,
                "transition-all duration-200",
                isSelected && "scale-x-105",
              )}
              style={{
                height: `${heightLines}rem`,
                left: `${dayX}px`,
                width: `${dayWidth - 1}px`,
                backgroundColor: colorClass,
                borderLeft: borderClass,
                borderRight: borderClass,
              }}
              title={day.isProfitable
                ? `${t("profitable_period")}: ${day.profit > 0 ? "+" : ""}${day.profit}${t("units")} sur ${day.date.toLocaleDateString()}`
                : `${t("losing_period")}: ${day.profit < 0 ? "" : ""}${day.profit}${t("units")} sur ${day.date.toLocaleDateString()}`}
            />
          );
        })}

        {/* Sélecteur de période en surbrillance */}
        {selectedStartIdx !== null && selectedEndIdx !== null && (
          <div
            className={cn(
              "absolute inset-0 rounded-full opacity-50",
              "bg-emerald-500/20" || "bg-destructive-500/20",
              "animate-pulse-subtle",
            )}
            style={{
              left: `${selectedStartIdx * dayWidth}px`,
              width: `${Math.abs(selectedEndIdx - dragStart ?? 0) + 1} * dayWidth}px`,
            }}
          />
        )}
      </div>

      {/* Légende */}
      <div className="flex flex-col sm:flex-row gap-2 text-xs text-slate-400 mt-1">
        <span className="flex items-center gap-1">
          <span
            className="w-1.5 h-1.5 rounded bg-emerald-500"
          ></span>
          {t("profitable")}
        </span>
        <span className="flex items-center gap-1">
          <span
            className="w-1.5 h-1.5 rounded bg-destructive"
          ></span>
          {t("losing")}
        </span>
        <span className="flex items-center gap-1">
          <span
            className="w-1.5 h-1.5 rounded bg-slate-400"
          ></span>
          {t("neutral")}
        </span>
      </div>
    </div>
  );
}