"use client";

import { cn } from "@/lib/utils";
import type { PowerScore } from "@/lib/power-score";

/**
 * TennisHeatmap — heatmap 2 joueurs × 6 metrics PowerScore (idée tenngrand
 * "Understanding Heatmaps") : lignes triées par PowerScore composite
 * (= Power Index), colonnes = metrics, couleur = valeur absolue
 * (vert ≥ 65, jaune 40-65, rouge < 40, gris = inconnue).
 */

const COLS = [
  { key: "elo", label: "Élo" },
  { key: "serve", label: "Service" },
  { key: "form", label: "Forme" },
  { key: "return", label: "Retour" },
  { key: "sps", label: "SPS" },
  { key: "fresh", label: "Fraîch." },
] as const;

function cellStyle(v: number | null): { bg: string; fg: string } {
  if (v == null) return { bg: "#f0f0f0", fg: "#9a9a9a" };
  if (v >= 65) {
    const t = Math.min(1, (v - 65) / 30);
    return { bg: `rgba(0, 152, 95, ${0.15 + t * 0.55})`, fg: t > 0.5 ? "#ffffff" : "#00663f" };
  }
  if (v >= 40) return { bg: "rgba(255, 193, 7, 0.25)", fg: "#7a5c00" };
  const t = Math.min(1, (40 - v) / 35);
  return { bg: `rgba(239, 68, 68, ${0.15 + t * 0.55})`, fg: t > 0.5 ? "#ffffff" : "#a02020" };
}

type Props = {
  powerA: PowerScore;
  powerB: PowerScore;
  nameA: string;
  nameB: string;
  className?: string;
};

export function TennisHeatmap({ powerA, powerB, nameA, nameB, className }: Props) {
  const rows = [
    { name: nameA, ps: powerA },
    { name: nameB, ps: powerB },
  ].sort((x, y) => y.ps.score - x.ps.score);

  const tip = (label: string, m: { value: number | null; display?: string } | undefined): string =>
    m?.value == null ? `${label} : —` : `${label} : ${Math.round(m.value)}${m.display ? ` (${m.display})` : ""}`;

  return (
    <div className={cn("w-full overflow-x-auto", className)} role="img" aria-label={`Heatmap PowerScore ${nameA} vs ${nameB}`}>
      <table className="w-full border-separate text-center" style={{ borderSpacing: 3 }}>
        <thead>
          <tr>
            <th className="w-20" aria-label="Joueur" />
            {COLS.map((c) => (
              <th key={c.key} className="px-1 py-1 text-[10px] font-semibold" style={{ color: "#717171" }}>
                {c.label}
              </th>
            ))}
            <th className="px-1 py-1 text-[10px] font-semibold" style={{ color: "#717171" }}>
              PS
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name}>
              <th className="truncate px-1 py-1 text-left text-[11px] font-semibold" style={{ color: "#222222", maxWidth: 80 }}>
                {r.name}
              </th>
              {COLS.map((c) => {
                const m = r.ps.metrics.find((x) => x.key === c.key);
                const st = cellStyle(m?.value ?? null);
                return (
                  <td
                    key={c.key}
                    title={tip(c.label, m)}
                    className="rounded px-1 py-1 font-mono text-[11px] font-bold tabular-nums"
                    style={{ backgroundColor: st.bg, color: st.fg }}
                  >
                    {m?.value == null ? "—" : Math.round(m.value)}
                  </td>
                );
              })}
              <td
                className="rounded px-1 py-1 font-mono text-[11px] font-bold tabular-nums"
                style={{ backgroundColor: "#00985f", color: "#ffffff" }}
              >
                {r.ps.score}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
