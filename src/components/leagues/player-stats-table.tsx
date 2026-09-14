"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * PlayerStatsTable — Tableau de stats joueurs avec :
 *   - Grouped headers (Player, Passing, Shooting, Other)
 *   - Heatmap cells (rgba(0, 152, 95, intensity))
 *   - Pagination 50/page
 *   - Colonnes dynamiques selon la catégorie sélectionnée
 */

export type PlayerRow = {
  rank?: number;
  player_name: string;
  team: string;
  position?: string;
  photo?: string;
  apps?: number;
  time?: number;
  // Stats variables selon la catégorie
  [key: string]: unknown;
};

type ColumnGroup = {
  label: string;
  columns: { key: string; label: string }[];
};

type Props = {
  columns: { key: string; label: string }[];
  rows: PlayerRow[];
  /** Map colonne → max value pour normaliser la heatmap */
  maxValues?: Record<string, number>;
  /** Catégorie active (pour grouped headers) */
  category?: string;
  className?: string;
};

const ROWS_PER_PAGE = 50;

/** Intensité heatmap : rgba(0, 152, 95, intensity) — même logique que FotMob. */
function heatmapStyle(value: number, max: number): React.CSSProperties | undefined {
  if (max <= 0 || value <= 0) return undefined;
  const intensity = Math.min((value / max) * 0.25, 0.25);
  return { backgroundColor: `rgba(0, 152, 95, ${intensity})` };
}

function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  const pages: (number | "...")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push("...");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
      pages.push(i);
    }
    if (page < totalPages - 2) pages.push("...");
    pages.push(totalPages);
  }

  return (
    <div className="flex items-center justify-center gap-1 py-3">
      <button
        type="button"
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page <= 1}
        className="rounded px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-white disabled:opacity-30"
      >
        &laquo;
      </button>
      {pages.map((p, i) =>
        p === "..." ? (
          <span key={`dots-${i}`} className="px-1 text-xs text-zinc-600">
            ...
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            className={cn(
              "min-w-[28px] rounded px-2 py-1 text-xs tabular-nums transition-colors",
              p === page
                ? "bg-[#00985f] text-white"
                : "text-zinc-400 hover:bg-zinc-800 hover:text-white",
            )}
          >
            {p}
          </button>
        ),
      )}
      <button
        type="button"
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages}
        className="rounded px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-white disabled:opacity-30"
      >
        &raquo;
      </button>
    </div>
  );
}

export function PlayerStatsTable({
  columns,
  rows,
  maxValues,
  className,
}: Props) {
  const [page, setPage] = useState(1);

  const totalPages = Math.ceil(rows.length / ROWS_PER_PAGE);
  const paginatedRows = useMemo(
    () => rows.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE),
    [rows, page],
  );

  // Calcul automatique des maxValues si non fournis
  const computedMax = useMemo(() => {
    if (maxValues) return maxValues;
    const m: Record<string, number> = {};
    for (const col of columns) {
      if (col.key === "#" || col.key === "Team" || col.key === "Player" || col.key === "Pos") continue;
      let max = 0;
      for (const row of rows) {
        const v = Number(row[col.key]);
        if (Number.isFinite(v) && v > max) max = v;
      }
      m[col.key] = max;
    }
    return m;
  }, [columns, rows, maxValues]);

  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-[11px] uppercase tracking-wider text-zinc-400">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  "px-2 py-2",
                  col.key === "#" && "w-8 text-center",
                  col.key === "Team" && "text-left",
                  col.key !== "#" && col.key !== "Team" && "text-center",
                )}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {paginatedRows.map((row, i) => (
            <tr
              key={`${row.player_name}-${i}`}
              className="border-b border-zinc-800/50 transition-colors hover:bg-white/[0.03]"
            >
              {columns.map((col) => {
                const val = col.key === "#" ? (row.rank ?? (page - 1) * ROWS_PER_PAGE + i + 1) : row[col.key];
                const numVal = Number(val);
                const isHeatmap = col.key !== "#" && col.key !== "Team" && col.key !== "Player" && col.key !== "Pos" && Number.isFinite(numVal);

                return (
                  <td
                    key={col.key}
                    className={cn(
                      "px-2 py-1.5 text-xs tabular-nums",
                      col.key === "#" && "text-center text-zinc-400",
                      col.key === "Team" && "text-left font-medium text-white",
                      col.key !== "#" && col.key !== "Team" && "text-center text-zinc-300",
                    )}
                    style={isHeatmap ? heatmapStyle(numVal, computedMax[col.key] ?? 1) : undefined}
                  >
                    {col.key === "Team" ? (
                      <div className="flex items-center gap-2">
                        {row.photo && (
                          <img src={row.photo} alt="" className="h-5 w-5 rounded-full" loading="lazy" />
                        )}
                        <span className="truncate">{String(val ?? "")}</span>
                      </div>
                    ) : isHeatmap ? (
                      numVal > 0 ? numVal.toFixed(numVal % 1 === 0 ? 0 : 1) : "-"
                    ) : (
                      String(val ?? "-")
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      <div className="px-2 pb-2 text-[11px] text-zinc-500">
        Showing {(page - 1) * ROWS_PER_PAGE + 1}–{Math.min(page * ROWS_PER_PAGE, rows.length)} of {rows.length}
      </div>
    </div>
  );
}
