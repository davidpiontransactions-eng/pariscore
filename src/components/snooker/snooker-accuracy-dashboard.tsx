"use client";

import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type CalibrationPoint = {
  range: string;
  avgPredicted: number;
  actualRate: number;
  count: number;
};

type AccuracyData = {
  totalMatches: number;
  accuracy: number;
  highConfidence: { count: number; accuracy: number };
  edge: { count: number; accuracy: number };
  brierScore: number;
  logLoss: number;
  calibration: CalibrationPoint[];
  perMatch: { match: string; predicted: number; actual: "win" | "loss"; correct: boolean }[];
};

function MetricCard({
  label,
  value,
  unit,
  color,
  subtitle,
}: {
  label: string;
  value: number;
  unit: string;
  color: string;
  subtitle?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-3 text-center">
      <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">{label}</div>
      <div className="mt-1 text-2xl font-black tabular-nums" style={{ color }}>
        {value}
        <span className="text-sm font-normal text-gray-400">{unit}</span>
      </div>
      {subtitle && <div className="mt-0.5 text-[9px] text-gray-400">{subtitle}</div>}
    </div>
  );
}

function CalibrationChart({ data }: { data: CalibrationPoint[] }) {
  if (data.length === 0) return null;

  const maxCount = Math.max(...data.map((d) => d.count));

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4">
      <h3 className="mb-3 text-[11px] font-semibold text-gray-700 uppercase tracking-wide">
        Calibration — Prédit vs Réel
      </h3>
      <div className="space-y-2">
        {data.map((d) => {
          const barWidth = (d.count / maxCount) * 100;
          const diff = d.actualRate - d.avgPredicted;
          const diffColor = Math.abs(diff) < 5 ? "#10b981" : diff > 0 ? "#f59e0b" : "#ef4444";
          return (
            <div key={d.range} className="flex items-center gap-2">
              <span className="w-14 text-right text-[10px] tabular-nums text-gray-500">{d.range}</span>
              <div className="relative flex-1">
                {/* Background bar */}
                <div className="h-4 rounded bg-gray-50">
                  <div
                    className="h-4 rounded bg-[#00985f]/20 transition-all"
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
                {/* Predicted line */}
                <div
                  className="absolute top-0 h-4 w-px bg-[#00985f]"
                  style={{ left: `${d.avgPredicted}%` }}
                />
                {/* Actual dot */}
                <div
                  className="absolute top-0 h-4 w-1.5 rounded-full"
                  style={{
                    left: `${d.actualRate}%`,
                    backgroundColor: diffColor,
                    transform: "translateX(-50%)",
                  }}
                />
              </div>
              <div className="flex w-20 items-center gap-1 text-[10px] tabular-nums">
                <span className="font-semibold text-gray-700">{d.actualRate.toFixed(0)}%</span>
                <span className="text-gray-400">/</span>
                <span className="text-gray-500">{d.avgPredicted.toFixed(0)}%</span>
              </div>
              <span className="w-6 text-center text-[9px] text-gray-400">n={d.count}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex items-center gap-4 text-[9px] text-gray-400">
        <span className="flex items-center gap-1">
          <span className="inline-block h-1 w-1 rounded-full bg-[#00985f]" /> Prédit (ligne)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-1 w-1 rounded-full bg-emerald-500" /> Réel (proche = bon)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-1 w-1 rounded-full bg-amber-500" /> Sous-estimé
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-1 w-1 rounded-full bg-red-500" /> Sur-estimé
        </span>
      </div>
    </div>
  );
}

function RecentPredictions({
  data,
}: {
  data: { match: string; predicted: number; actual: "win" | "loss"; correct: boolean }[];
}) {
  if (data.length === 0) return null;

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4">
      <h3 className="mb-3 text-[11px] font-semibold text-gray-700 uppercase tracking-wide">
        Prédictions récentes
      </h3>
      <div className="space-y-1">
        {data.map((p, i) => (
          <div
            key={`${p.match}-${i}`}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-gray-50"
          >
            <span
              className={`flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-bold text-white ${
                p.correct ? "bg-emerald-500" : "bg-red-500"
              }`}
            >
              {p.correct ? "✓" : "✗"}
            </span>
            <span className="min-w-0 flex-1 truncate text-[11px] text-gray-700">{p.match}</span>
            <span className="text-[10px] tabular-nums text-gray-500">{p.predicted}%</span>
            <span
              className={`text-[9px] font-semibold ${
                p.actual === "win" ? "text-emerald-600" : "text-red-600"
              }`}
            >
              {p.actual === "win" ? "W" : "L"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SnookerAccuracyDashboard() {
  const { data, isLoading } = useSWR<AccuracyData>(
    "/api/v1/snooker/accuracy",
    fetcher,
    { refreshInterval: 300_000 }
  );

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-6 text-center">
        <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-[#00985f] border-t-transparent" />
        <p className="mt-2 text-xs text-gray-500">Chargement des métriques…</p>
      </div>
    );
  }

  if (!data || data.totalMatches === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#00985f]/10">
          <svg className="h-3.5 w-3.5 text-[#00985f]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
          </svg>
        </div>
        <h2 className="text-[13px] font-semibold text-gray-900">
          Précision du modèle
        </h2>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500 tabular-nums">
          {data.totalMatches} matchs analysés
        </span>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <MetricCard
          label="Accuracy"
          value={data.accuracy}
          unit="%"
          color="#00985f"
          subtitle="Toutes prédictions"
        />
        <MetricCard
          label="Haute confiance"
          value={data.highConfidence.accuracy}
          unit="%"
          color="#2196F3"
          subtitle={`${data.highConfidence.count} matchs >65%`}
        />
        <MetricCard
          label="Edge accuracy"
          value={data.edge.accuracy}
          unit="%"
          color="#FF6D00"
          subtitle={`${data.edge.count} matchs avec edge >5%`}
        />
        <MetricCard
          label="Brier Score"
          value={data.brierScore}
          unit=""
          color={data.brierScore < 0.2 ? "#10b981" : data.brierScore < 0.25 ? "#f59e0b" : "#ef4444"}
          subtitle="0 = parfait, 1 = pire"
        />
        <MetricCard
          label="Log Loss"
          value={data.logLoss}
          unit=""
          color={data.logLoss < 0.5 ? "#10b981" : data.logLoss < 0.7 ? "#f59e0b" : "#ef4444"}
          subtitle="Plus bas = meilleur"
        />
      </div>

      {/* Calibration chart */}
      <CalibrationChart data={data.calibration} />

      {/* Recent predictions */}
      <RecentPredictions data={data.perMatch} />

      {/* Academic note */}
      <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-3">
        <p className="text-[10px] leading-relaxed text-gray-500">
          <span className="font-semibold text-gray-600">Références :</span>{" "}
          Modèle binomial corrigé (Negative Binomial, dispersion 1.15) basé sur{" "}
          Collingwood, Wright & Brooks (EJOR 2023), Clarke, Norman & Stride (2008),{" "}
          Baker & McHale (2024). Calibré sur les données CueTracker + FlashScore.
        </p>
      </div>
    </section>
  );
}
