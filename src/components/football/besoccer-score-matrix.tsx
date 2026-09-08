"use client";

import { useMemo } from "react";
import { scoreMatrixForMatch } from "@/lib/besoccer-matrix";

/* ─── Heatmap scores exacts façon BeSoccer (page analysis prematch) ───
   Grille 0..10 + colonne marges +N, fond vert opacité ∝ proba
   (score : p/0.15, marge : p/0.25 — ratios mesurés sur le sample),
   texte blanc au-delà de 0.5 d'opacité (contraste), sombre sinon. */

const GREEN = "#16a34a";
const INK = "#1a1a1a";

function fmtPct(p: number): string {
  if (p < 0.0005) return "<0%";
  return `${parseFloat((p * 100).toFixed(1))}%`;
}

export function BesoccerScoreMatrix({
  homeName,
  homeLogo,
  awayName,
  awayLogo,
  homeOdds,
  drawOdds,
  awayOdds,
  winProbPct,
}: {
  homeName: string;
  homeLogo?: string | null;
  awayName: string;
  awayLogo?: string | null;
  homeOdds?: number | null;
  drawOdds?: number | null;
  awayOdds?: number | null;
  /** Proba victoire domicile 0-100 (défaut : matrice). */
  winProbPct?: number | null;
}) {
  const r = useMemo(
    () => scoreMatrixForMatch({ homeOdds, drawOdds, awayOdds, max: 10 }),
    [homeOdds, drawOdds, awayOdds]
  );
  const winPct = winProbPct ?? r.homeWin * 100;
  const diffs = useMemo(() => Array.from({ length: 10 }, (_, i) => 10 - i), []);

  const cellBg = (p: number, div: number): string =>
    `rgba(22,163,74,${Math.min(1, p / div).toFixed(3)})`;
  const cellText = (p: number, div: number): string =>
    p / div > 0.5 ? "#ffffff" : INK;

  const side = (
    name: string,
    logo: string | null | undefined,
    probPct: number,
    xg: number,
    align: "left" | "right"
  ) => (
    <div className={align === "left" ? "text-left" : "text-right"}>
      <div className="text-2xl font-bold tabular-nums" style={{ color: INK }}>
        {probPct.toFixed(1)}%
      </div>
      <div className="text-xs" style={{ color: "#717171" }}>Win probability</div>
      {logo ? (
        <img src={logo} alt={name} width="60" height="60" loading="lazy" className="my-1 inline-block size-[60px]" />
      ) : null}
      <div className="text-lg font-bold tabular-nums" style={{ color: INK }}>{xg.toFixed(2)}</div>
      <div className="text-xs" style={{ color: "#717171" }}>Expected goals (xG)</div>
    </div>
  );

  return (
    <div className="w-full rounded-2xl border p-4" style={{ backgroundColor: "#ffffff", borderColor: "#f0f0f0" }}>
      <div className="mb-3 grid grid-cols-2 gap-2">
        {side(homeName, homeLogo, winPct, r.lambdaHome, "left")}
        {side(awayName, awayLogo, r.awayWin * 100, r.lambdaAway, "right")}
      </div>
      <div className="flex flex-col gap-1" role="img" aria-label={`Matrice des scores exacts ${homeName} contre ${awayName}`}>
        {diffs.map((d) => (
          <div key={d} className="flex gap-1">
            <div className="flex flex-1 gap-1">
              {r.matrix[d].slice(0, 11 - d).map((c) => (
                <div
                  key={`${c.home}-${c.away}`}
                  className="flex min-w-0 flex-1 flex-col items-center rounded px-0.5 py-1 text-center tabular-nums"
                  style={{ backgroundColor: cellBg(c.prob, 0.15), color: cellText(c.prob, 0.15) }}
                >
                  <span className="text-[11px] font-semibold leading-tight">{c.home}-{c.away}</span>
                  <span className="text-[10px] leading-tight">{fmtPct(c.prob)}</span>
                </div>
              ))}
            </div>
            <div
              className="flex w-14 shrink-0 flex-col items-center justify-center rounded px-0.5 py-1 text-center tabular-nums"
              style={{
                backgroundColor: cellBg(r.margins[d - 1].prob, 0.25),
                color: cellText(r.margins[d - 1].prob, 0.25),
              }}
            >
              <span className="text-[11px] font-semibold leading-tight">+{d}</span>
              <span className="text-[10px] leading-tight">{fmtPct(r.margins[d - 1].prob)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
