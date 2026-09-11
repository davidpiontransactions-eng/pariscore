"use client";

import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend, Tooltip } from "recharts";

// ─── Types ──────────────────────────────────────────────────────────────────

export type SpiderMetric = {
  metric: string;       // Nom affiché (court)
  label: string;        // Description longue
  home: number;         // Valeur 0-100 pour l'equipe home
  away: number;         // Valeur 0-100 pour l'equipe away
  category: "offense" | "defense" | "possession" | "special" | "form";
};

export type SpiderMatchProps = {
  homeTeam: string;
  awayTeam: string;
  metrics: SpiderMetric[];
  height?: number;
};

// ─── Couleurs ───────────────────────────────────────────────────────────────

const COLORS = {
  home: "#00e676",      // Vert neon (home)
  homeFill: "rgba(0,230,118,0.15)",
  away: "#448aff",      // Bleu (away)
  awayFill: "rgba(68,138,255,0.15)",
  grid: "rgba(255,255,255,0.08)",
  axis: "rgba(255,255,255,0.4)",
  label: "rgba(255,255,255,0.7)",
};

// ─── Tooltip ────────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }> }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-[#0d1117] border border-white/10 rounded-lg px-3 py-2 shadow-xl text-xs">
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-white/60">{entry.name}:</span>
          <span className="font-bold text-white">{entry.value}%</span>
        </div>
      ))}
    </div>
  );
}

// ─── Composant ──────────────────────────────────────────────────────────────

export function SpiderMatch({
  homeTeam,
  awayTeam,
  metrics,
  height = 320,
}: SpiderMatchProps) {
  const data = metrics.map((m) => ({
    metric: m.metric,
    home: m.home,
    away: m.away,
    fullMark: 100,
  }));

  return (
    <div className="w-full">
      {/* Titre */}
      <div className="flex items-center justify-center gap-4 mb-2 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS.home }} />
          <span className="text-white/70 font-medium">{homeTeam}</span>
        </div>
        <span className="text-white/30">vs</span>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS.away }} />
          <span className="text-white/70 font-medium">{awayTeam}</span>
        </div>
      </div>

      {/* Radar Chart */}
      <ResponsiveContainer width="100%" height={height}>
        <RadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
          <PolarGrid stroke={COLORS.grid} />
          <PolarAngleAxis
            dataKey="metric"
            tick={{ fill: COLORS.label, fontSize: 10, fontWeight: 500 }}
            stroke={COLORS.axis}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 8 }}
            stroke="none"
            tickCount={5}
          />
          <Radar
            name={homeTeam}
            dataKey="home"
            stroke={COLORS.home}
            fill={COLORS.homeFill}
            strokeWidth={2}
            dot={{ r: 3, fill: COLORS.home }}
          />
          <Radar
            name={awayTeam}
            dataKey="away"
            stroke={COLORS.away}
            fill={COLORS.awayFill}
            strokeWidth={2}
            dot={{ r: 3, fill: COLORS.away }}
          />
          <Tooltip content={<CustomTooltip />} />
        </RadarChart>
      </ResponsiveContainer>

      {/* Légende détaillée */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-1 px-2">
        {metrics.map((m) => (
          <div key={m.metric} className="flex items-center justify-between text-[10px]">
            <span className="text-white/40 truncate" title={m.label}>{m.metric}</span>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[#00e676] font-mono w-7 text-right">{m.home}</span>
              <span className="text-white/20">-</span>
              <span className="text-[#448aff] font-mono w-7 text-right">{m.away}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Calcul des métriques spider ────────────────────────────────────────────

export type TeamStandingForSpider = {
  name: string;
  gp: number;
  w: number;
  t: number;
  l: number;
  otw?: number;
  otl?: number;
  gf: number;
  ga: number;
  tp?: number;
  ppg?: number;
  home?: { w: number; l: number; gf: number; ga: number; gp: number };
  away?: { w: number; l: number; gf: number; ga: number; gp: number };
};

/**
 * Calcule les 8 métriques du spider match à partir des standings.
 *
 * Métriques basées sur la recherche académique:
 * - Attaque: GF/game (offensive volume - Macdonald 2012)
 * - Défense: GA/game inversé (defensive suppression)
 * - Efficacité: +/- differential/game (goal differential - Linhac 2024)
 * - Win%: Win rate (proxy possession - OZPTD correlation r=0.77)
 * - Points: Points per game (dominance)
 * - Forme: Recent form proxy (win streak indicator)
 * - Domicile: Home record strength
 * - Extérieur: Away record strength
 */
export function computeSpiderMetrics(
  home: TeamStandingForSpider,
  away: TeamStandingForSpider
): SpiderMetric[] {
  // Helpers
  const gpg = (gf: number, gp: number) => gp > 0 ? gf / gp : 0;
  const winPct = (w: number, gp: number) => gp > 0 ? (w / gp) * 100 : 50;
  const ppgCalc = (pts: number, gp: number) => gp > 0 ? pts / gp : 0;

  // Normaliser sur 0-100 (relative a la ligue ou absolue)
  // Attaque: 0-6 buts/game → 0-100 (3 = 50%)
  const normOffense = (gf: number, gp: number) => Math.min(100, Math.round(gpg(gf, gp) / 6 * 100));
  // Défense: inversé - 0 GA = 100, 6 GA = 0
  const normDefense = (ga: number, gp: number) => Math.max(0, Math.round((1 - gpg(ga, gp) / 6) * 100));
  // Differential: -3 a +3 → 0-100
  const normDiff = (gf: number, ga: number, gp: number) => {
    const diff = gp > 0 ? (gf - ga) / gp : 0;
    return Math.round(((diff + 3) / 6) * 100);
  };
  // Win%: direct
  const normWin = (w: number, gp: number) => Math.round(winPct(w, gp));
  // Points: 0-2 pts/game → 0-100
  const normPts = (pts: number, gp: number) => Math.min(100, Math.round(ppgCalc(pts, gp) / 2 * 100));

  // Points totaux
  const homePts = (home.tp ?? 0) || (home.w * 2 + (home.otw ?? 0) * 2 + (home.t ?? 0) + (home.otl ?? 0));
  const awayPts = (away.tp ?? 0) || (away.w * 2 + (away.otw ?? 0) * 2 + (away.t ?? 0) + (away.otl ?? 0));

  // Forme: proxy base sur win% recent (si home/away data dispo, sinon win% global)
  const homeForm = home.home ? winPct(home.home.w, home.home.gp) : winPct(home.w, home.gp);
  const awayForm = away.away ? winPct(away.away.w, away.away.gp) : winPct(away.w, away.gp);

  return [
    {
      metric: "Attaque",
      label: "Buts marqués par match (offensive volume)",
      home: normOffense(home.gf, home.gp),
      away: normOffense(away.gf, away.gp),
      category: "offense",
    },
    {
      metric: "Défense",
      label: "Buts encaissés par match (defensive suppression, inversé)",
      home: normDefense(home.ga, home.gp),
      away: normDefense(away.ga, away.gp),
      category: "defense",
    },
    {
      metric: "Efficacité",
      label: "Différentiel de buts par match (goal differential r=0.77 avec OZPTD)",
      home: normDiff(home.gf, home.ga, home.gp),
      away: normDiff(away.gf, away.ga, away.gp),
      category: "offense",
    },
    {
      metric: "Win%",
      label: "Pourcentage de victoires (proxy possession — correlation r=0.77)",
      home: normWin(home.w, home.gp),
      away: normWin(away.w, away.gp),
      category: "possession",
    },
    {
      metric: "Points",
      label: "Points par match (dominance générale)",
      home: normPts(homePts, home.gp),
      away: normPts(awayPts, away.gp),
      category: "possession",
    },
    {
      metric: "Forme",
      label: "Forme récente (record domicile/extérieur — proxy streak)",
      home: Math.round(homeForm),
      away: Math.round(awayForm),
      category: "form",
    },
    {
      metric: "Domicile",
      label: "Force au domicile (win% à domicile)",
      home: home.home ? Math.round(winPct(home.home.w, home.home.gp)) : 60,
      away: away.away ? Math.round(winPct(away.away.w, away.away.gp)) : 40,
      category: "special",
    },
    {
      metric: "Extérieur",
      label: "Performance à l'extérieur (win% à l'extérieur)",
      home: home.away ? Math.round(winPct(home.away.w, home.away.gp)) : 40,
      away: away.home ? Math.round(winPct(away.home.w, away.home.gp)) : 60,
      category: "special",
    },
  ];
}

// ─── Résumé forces/faiblesses ───────────────────────────────────────────────

export type StrengthSummary = {
  homeStrengths: string[];
  homeWeaknesses: string[];
  awayStrengths: string[];
  awayWeaknesses: string[];
  verdict: string;
};

export function summarizeStrengths(metrics: SpiderMetric[]): StrengthSummary {
  const homeStrengths: string[] = [];
  const homeWeaknesses: string[] = [];
  const awayStrengths: string[] = [];
  const awayWeaknesses: string[] = [];

  for (const m of metrics) {
    const diff = m.home - m.away;
    if (diff > 10) homeStrengths.push(m.metric);
    else if (diff < -10) awayStrengths.push(m.metric);

    if (m.home < 40) homeWeaknesses.push(m.metric);
    if (m.away < 40) awayWeaknesses.push(m.metric);
  }

  // Verdict
  const homeTotal = metrics.reduce((s, m) => s + m.home, 0);
  const awayTotal = metrics.reduce((s, m) => s + m.away, 0);
  const gap = homeTotal - awayTotal;

  let verdict: string;
  if (gap > 40) verdict = `Domination ${metrics[0]?.home ? "home" : "away"} — écart significatif`;
  else if (gap > 15) verdict = "Avantage home — match équilibré avec léger favori";
  else if (gap < -40) verdict = "Domination away — écart significatif";
  else if (gap < -15) verdict = "Avantage away — match équilibré avec léger favori";
  else verdict = "Match ultra-équilibré — aucun avantage clair";

  return { homeStrengths, homeWeaknesses, awayStrengths, awayWeaknesses, verdict };
}
