// MomentumSparkline — mini graphe 80×20px pour afficher le momentum d'un match
// dans la sidebar (P2 — pattern SofaScore Attack Momentum / InPlayGuru 0-100).
// Entrée : tableau de points [{minute, value}] value ∈ [-100,+100]
// Sortie : SVG inline avec aire bicolore (vert > 0 domicile, bleu < 0 extérieur)

import { cn } from "@/lib/utils";

type Point = { minute: number; value: number };

const W = 80;
const H = 20;
const MID = H / 2;

function toX(min: number, maxMin: number): number {
  return (Math.max(0, Math.min(maxMin, min)) / maxMin) * W;
}

function toY(v: number): number {
  return MID - (v / 100) * (MID - 1);
}

function buildPath(points: Point[], upper: boolean, maxMin: number): string {
  if (points.length === 0) return "";
  const seg = points
    .map((p) => ({ x: toX(p.minute, maxMin), y: toY(p.value), v: p.value }))
    .filter((p) => (upper ? p.v >= 0 : p.v <= 0));
  if (seg.length === 0) return "";
  const d: string[] = [`M ${seg[0].x.toFixed(1)} ${MID}`];
  for (const p of seg) d.push(`L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`);
  d.push(`L ${seg[seg.length - 1].x.toFixed(1)} ${MID} Z`);
  return d.join(" ");
}

export function MomentumSparkline({
  data,
  className,
}: {
  data: Point[];
  className?: string;
}) {
  const maxMin = data.length > 0 ? Math.max(...data.map((p) => p.minute), 90) : 90;
  const sorted = [...data].sort((a, b) => a.minute - b.minute);
  const homePath = buildPath(sorted, true, maxMin);
  const awayPath = buildPath(sorted, false, maxMin);

  if (data.length === 0) {
    return (
      <div className={cn("h-5 w-20 rounded bg-muted/30", className)} aria-label="Momentum indisponible" />
    );
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={cn("h-5 w-20", className)}
      role="img"
      aria-label={`Momentum: ${sorted[sorted.length - 1]?.value > 0 ? "dominant domicile" : "dominant extérieur"}`}
    >
      {/* Ligne médiane */}
      <line x1={0} y1={MID} x2={W} y2={MID} stroke="currentColor" strokeOpacity={0.2} strokeWidth={0.5} className="text-muted-foreground" />
      {/* Aire domicile (vert) */}
      {homePath && <path d={homePath} fill="#22c55e" fillOpacity={0.4} />}
      {/* Aire extérieur (bleu) */}
      {awayPath && <path d={awayPath} fill="#3b82f6" fillOpacity={0.4} />}
    </svg>
  );
}
