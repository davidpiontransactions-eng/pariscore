"use client";

// calibration-chart.tsx
// Composant de courbe de calibration pour les prédictions football.
// Dessine sur un <canvas> natif (pas de dépendance externe).
// La calibration parfaite = diagonale ; chaque marché a sa propre courbe.

import { useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// ─── Types ────────────────────────────────────────────────────────────────

export type CalibrationBin = {
  predicted: number; // probabilité moyenne prédite dans le bucket
  actual: number;    // fréquence observée (0-1)
  count: number;     // nombre de prédictions dans le bucket
};

export type CalibrationCurve = {
  market: string;    // ex: "1x2", "btts", "over25"
  bins: CalibrationBin[];
};

export type CalibrationChartProps = {
  curves: CalibrationCurve[];
  title?: string;
};

// ─── Couleurs par marché ──────────────────────────────────────────────────

const MARKET_COLORS: Record<string, string> = {
  "1x2": "#3b82f6",   // bleu
  btts: "#22c55e",    // vert
  over25: "#f97316",  // orange
};

/** Renvoie une couleur pour un marché inconnu (palette décalée). */
function marketColor(market: string): string {
  if (MARKET_COLORS[market]) return MARKET_COLORS[market];
  // Fallback : teinte décalée selon le hash du nom
  let hash = 0;
  for (let i = 0; i < market.length; i++) {
    hash = (hash * 31 + market.charCodeAt(i)) | 0;
  }
  const hue = ((hash % 360) + 360) % 360;
  return `hsl(${hue}, 65%, 55%)`;
}

/** Label lisible pour un marché. */
function marketLabel(market: string): string {
  const labels: Record<string, string> = {
    "1x2": "1X2",
    btts: "BTTS",
    over25: "Over 2.5",
  };
  return labels[market] ?? market;
}

// ─── Helper : transformation raw → bins ───────────────────────────────────

/**
 * Transforme des tableaux bruts de prédictions / outcomes en bins de calibration.
 *
 * @param predictions - probabilités prédites (0-1)
 * @param actuals     - outcomes observés (0 ou 1)
 * @param numBins     - nombre de buckets (défaut 10)
 * @returns           - CalibrationBin[] prêt pour le composant
 */
export function computeCalibrationData(
  predictions: number[],
  actuals: number[],
  numBins: number = 10,
): CalibrationBin[] {
  if (predictions.length === 0 || predictions.length !== actuals.length) return [];
  if (numBins <= 0) return [];

  const bucketSize = 1 / numBins;
  const buckets: { sumPred: number; sumActual: number; count: number }[] = [];
  for (let i = 0; i < numBins; i++) {
    buckets.push({ sumPred: 0, sumActual: 0, count: 0 });
  }

  for (let i = 0; i < predictions.length; i++) {
    const p = Math.min(1, Math.max(0, predictions[i]));
    const y = actuals[i] === 1 ? 1 : 0;
    let idx = Math.floor(p / bucketSize);
    if (idx >= numBins) idx = numBins - 1;
    buckets[idx].sumPred += p;
    buckets[idx].sumActual += y;
    buckets[idx].count += 1;
  }

  return buckets.map((b, i) => ({
    predicted: b.count > 0 ? b.sumPred / b.count : (i + 0.5) * bucketSize,
    actual: b.count > 0 ? b.sumActual / b.count : 0,
    count: b.count,
  }));
}

// ─── Rendu Canvas ─────────────────────────────────────────────────────────

function drawCalibration(
  ctx: CanvasRenderingContext2D,
  curves: CalibrationCurve[],
  width: number,
  height: number,
) {
  // Marges intérieures
  const pad = { top: 16, right: 20, bottom: 36, left: 44 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  // Fond
  ctx.clearRect(0, 0, width, height);

  // ── Grille ──
  ctx.strokeStyle = "rgba(148,163,184,0.15)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 10; i++) {
    const x = pad.left + (i / 10) * plotW;
    const y = pad.top + plotH - (i / 10) * plotH;
    // Lignes verticales
    ctx.beginPath();
    ctx.moveTo(x, pad.top);
    ctx.lineTo(x, pad.top + plotH);
    ctx.stroke();
    // Lignes horizontales
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + plotW, y);
    ctx.stroke();
  }

  // ── Diagonale parfaite (tiretés gris) ──
  ctx.strokeStyle = "rgba(148,163,184,0.4)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(pad.left, pad.top + plotH);
  ctx.lineTo(pad.left + plotW, pad.top);
  ctx.stroke();
  ctx.setLineDash([]);

  // ── Axes labels ──
  ctx.fillStyle = "rgba(148,163,184,0.7)";
  ctx.font = "10px ui-monospace, monospace";
  ctx.textAlign = "center";
  for (let i = 0; i <= 10; i += 2) {
    const x = pad.left + (i / 10) * plotW;
    ctx.fillText(`${i * 10}%`, x, pad.top + plotH + 14);
  }
  ctx.textAlign = "right";
  for (let i = 0; i <= 10; i += 2) {
    const y = pad.top + plotH - (i / 10) * plotH;
    ctx.fillText(`${i * 10}%`, pad.left - 6, y + 3);
  }

  // Labels d'axe
  ctx.fillStyle = "rgba(148,163,184,0.5)";
  ctx.font = "10px ui-sans-serif, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Probabilité prédite", pad.left + plotW / 2, height - 4);

  ctx.save();
  ctx.translate(10, pad.top + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText("Fréquence observée", 0, 0);
  ctx.restore();

  // ── Courbes ──
  for (const curve of curves) {
    const color = marketColor(curve.market);

    // Ligne reliant les centres des bins
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    let started = false;
    for (const bin of curve.bins) {
      const x = pad.left + bin.predicted * plotW;
      const y = pad.top + plotH - bin.actual * plotH;
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // Points + labels count
    ctx.fillStyle = color;
    ctx.font = "9px ui-monospace, monospace";
    ctx.textAlign = "center";
    for (const bin of curve.bins) {
      const x = pad.left + bin.predicted * plotW;
      const y = pad.top + plotH - bin.actual * plotH;

      // Point
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();

      // Label count (au-dessus du point)
      if (bin.count > 0) {
        ctx.fillStyle = "rgba(148,163,184,0.6)";
        ctx.fillText(String(bin.count), x, y - 7);
        ctx.fillStyle = color;
      }
    }
  }
}

// ─── Composant React ──────────────────────────────────────────────────────

export function CalibrationChart({ curves, title }: CalibrationChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.scale(dpr, dpr);
    drawCalibration(ctx, curves, rect.width, rect.height);
  }, [curves]);

  return (
    <Card className="w-full">
      {(title || curves.length > 0) && (
        <CardHeader className="pb-2">
          {title && <CardTitle className="text-sm">{title}</CardTitle>}
        </CardHeader>
      )}
      <CardContent className="pt-0">
        <canvas
          ref={canvasRef}
          className="w-full"
          style={{ height: 250 }}
        />
        {/* Légende */}
        {curves.length > 0 && (
          <div className="flex items-center justify-center gap-4 mt-3 text-xs text-muted-foreground">
            {curves.map((c) => (
              <div key={c.market} className="flex items-center gap-1.5">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: marketColor(c.market) }}
                />
                <span>{marketLabel(c.market)}</span>
              </div>
            ))}
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-4 border-t border-dashed border-slate-400" />
              <span>Parfait</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
