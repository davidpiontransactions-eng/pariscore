"use client";

import { useMemo } from "react";

/**
 * DynamicColumns — Logique de sélection de colonnes selon la catégorie active.
 * Mappe le StatCategory sélectionné vers les colonnes à afficher dans le tableau.
 */

import { CATEGORY_COLUMNS, type StatCategory } from "./stat-category-pills";

export type ColumnDef = {
  key: string;
  label: string;
  align?: "left" | "center" | "right";
  width?: number;
};

/** Colonnes toujours visibles (communes à toutes les catégories). */
const FIXED_COLUMNS: ColumnDef[] = [
  { key: "#", label: "#", align: "center", width: 40 },
  { key: "Team", label: "Team", align: "left" },
];

/**
 * Retourne la liste des colonnes à afficher pour une catégorie donnée.
 * Les colonnes "Team" et "#" sont toujours présentes.
 */
export function getColumnsForCategory(category: StatCategory): ColumnDef[] {
  const catCols = CATEGORY_COLUMNS[category] ?? CATEGORY_COLUMNS.overview;
  const fixed = FIXED_COLUMNS.map((c) => c.key);
  const dynamic: ColumnDef[] = catCols
    .filter((k) => !fixed.includes(k))
    .map((k) => ({
      key: k,
      label: k,
      align: k === "#" || k === "Team" ? "left" : "center",
    }));
  return [...FIXED_COLUMNS, ...dynamic];
}

/**
 * Extrait la valeur d'une colonne d'un objet de données (standings ou player).
 * Gère les chemins imbriqués (ex. "xG.overall" → data.xG.overall).
 */
export function getCellValue(row: Record<string, unknown>, columnKey: string): unknown {
  if (columnKey === "#") return row.rank ?? row.index ?? null;
  if (columnKey === "Team") return row.team ?? row.player_name ?? "";
  if (columnKey === "Form") return row.form ?? null;

  // Chemin imbriqué (ex. "PPG")
  const val = row[columnKey];
  if (val !== undefined && val !== null) return val;

  // Fallback : chercher dans les stats imbriquées
  const stats = row.stats as Record<string, unknown> | undefined;
  if (stats?.[columnKey] !== undefined) return stats[columnKey];

  return null;
}

/**
 * Hook pour obtenir les colonnes et les données formatées pour le tableau.
 */
export function useDynamicColumns(
  category: StatCategory,
  rows: Record<string, unknown>[],
) {
  const columns = useMemo(() => getColumnsForCategory(category), [category]);

  const formattedRows = useMemo(() => {
    return rows.map((row, i) => ({
      ...row,
      "#": (row.rank ?? i + 1) as number,
      Team: (row.team ?? row.player_name ?? "") as string,
      Form: row.form as string[] | undefined,
    }));
  }, [rows]);

  return { columns, formattedRows };
}
