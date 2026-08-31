"use client";

// src/app/admin/predictions/page.tsx
// Dashboard admin des prédictions : santé du modèle, calibration,
// historique, versions, et détection de drift.
// Layout vertical avec sections shadcn Card.

import { useState, useEffect, useCallback } from "react";
import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CalibrationChart, type CalibrationCurve } from "@/components/football/calibration-chart";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Cpu,
  TrendingUp,
  TrendingDown,
  Database,
  BarChart3,
} from "lucide-react";

// ─── Types API ────────────────────────────────────────────────────────────

type HealthStatus = "healthy" | "degraded" | "critical";

interface PredictionHealth {
  status: HealthStatus;
  model: {
    active: string;
    totalVersions: number;
    lastTrainedAt: string;
  };
  metrics: {
    brierScore: number;
    accuracy: number;
    sampleSize: number;
    period: string;
  };
  drift: {
    detected: boolean;
    summary: string;
  };
  data: {
    totalPredictions: number;
    settledPredictions: number;
    pendingPredictions: number;
    lastPredictionAt: string;
  };
  catboost: {
    enabled: boolean;
    available: boolean;
  };
}

interface MarketAccuracy {
  brier: number;
  logLoss: number;
  accuracy: number;
  roi: number;
  sampleSize: number;
}

interface AccuracyResponse {
  brierScore: number;
  logLoss: number;
  accuracy: number;
  calibration: { predicted: number; actual: number; count: number }[];
  sampleSize: number;
  period: { from: string; to: string; matchCount: number };
  markets: {
    "1X2": MarketAccuracy;
    BTTS: MarketAccuracy;
    O25: MarketAccuracy;
  };
  windows: number;
}

interface DriftResponse {
  drifted: boolean;
  summary: string;
  markets: {
    market: string;
    recentBrier: number;
    baselineBrier: number;
    change: number;
    significant: boolean;
  }[];
  checkedAt: string;
  details: {
    recentCount: number;
    baselineCount: number;
    period: string;
    baseline: string;
  };
}

interface PredictionLogEntry {
  id: string;
  matchId: string;
  homeProb: number;
  drawProb: number;
  awayProb: number;
  bttsProb: number | null;
  over25Prob: number | null;
  edge: number | null;
  confidence: number | null;
  actualHome: number | null;
  actualAway: number | null;
  settled: boolean;
  createdAt: string;
  modelVersion: {
    name: string;
    modelType: string;
  } | null;
}

interface ModelVersionEntry {
  id: string;
  name: string;
  modelType: string;
  version: number;
  status: string;
  trainedAt: string;
  promotedAt: string | null;
  modelMetrics: {
    brierScore: number;
    accuracy: number | null;
    sampleSize: number;
    market: string;
  }[];
}

// ─── Fetcher ──────────────────────────────────────────────────────────────

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
  return json as T;
}

// ─── Sous-composants de statut ────────────────────────────────────────────

function StatusDot({ status }: { status: HealthStatus }) {
  const color =
    status === "healthy"
      ? "bg-emerald-500"
      : status === "degraded"
        ? "bg-yellow-500"
        : "bg-red-500";
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${color}`} />;
}

function StatusIcon({ status }: { status: HealthStatus }) {
  if (status === "healthy") return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
  if (status === "degraded") return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
  return <XCircle className="h-5 w-5 text-red-500" />;
}

function MetricCard({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-white/5 bg-white/[0.02] p-3">
      <div className="mt-0.5 rounded-md bg-white/5 p-1.5">
        <Icon className="h-4 w-4 text-zinc-400" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-zinc-500">{label}</p>
        <p className="text-sm font-semibold tabular-nums text-zinc-100">{value}</p>
        {sub && <p className="text-xs text-zinc-500">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Skeletons ────────────────────────────────────────────────────────────

function HealthSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-5 w-48" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full rounded" />
      ))}
    </div>
  );
}

function VersionsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-20 w-full rounded-lg" />
      ))}
    </div>
  );
}

// ─── Section 1 : Santé du modèle ─────────────────────────────────────────

function HealthSection({ data, error }: { data: PredictionHealth | undefined; error: unknown }) {
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Activity className="h-4 w-4" />
            État du système
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-red-400">
            <XCircle className="h-4 w-4" />
            <span className="text-sm">Erreur de chargement</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) return <HealthSkeleton />;

  return (
    <div className="space-y-4">
      {/* Barre de statut */}
      <div className="flex items-center gap-3">
        <StatusIcon status={data.status} />
        <div>
          <h2 className="text-sm font-semibold">
            Système {data.status === "healthy" ? "opérationnel" : data.status === "degraded" ? "dégradé" : " critique"}
          </h2>
          <p className="text-xs text-zinc-500">
            Modèle actif : <span className="text-zinc-300">{data.model.active}</span>
            {data.model.lastTrainedAt && (
              <> — entraîné le {new Date(data.model.lastTrainedAt).toLocaleDateString("fr-FR")}</>
            )}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <StatusDot status={data.status} />
          <Badge variant={data.status === "healthy" ? "default" : "destructive"}>
            {data.status}
          </Badge>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Brier Score"
          value={data.metrics.brierScore.toFixed(4)}
          sub={`${data.metrics.sampleSize} prédictions`}
          icon={BarChart3}
        />
        <MetricCard
          label="Accuracy"
          value={`${(data.metrics.accuracy * 100).toFixed(1)}%`}
          sub={data.metrics.period}
          icon={TrendingUp}
        />
        <MetricCard
          label="Prédictions"
          value={`${data.data.totalPredictions}`}
          sub={`${data.data.settledPredictions} réglées · ${data.data.pendingPredictions} en attente`}
          icon={Database}
        />
        <MetricCard
          label="CatBoost"
          value={data.catboost.enabled ? "Activé" : "Désactivé"}
          sub={data.catboost.available ? "Modèle disponible" : "Non disponible"}
          icon={Cpu}
        />
      </div>

      {/* Drift */}
      <div className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${
        data.drift.detected
          ? "border-red-500/20 bg-red-500/5 text-red-400"
          : "border-emerald-500/20 bg-emerald-500/5 text-emerald-400"
      }`}>
        {data.drift.detected ? (
          <TrendingDown className="h-4 w-4 shrink-0" />
        ) : (
          <TrendingUp className="h-4 w-4 shrink-0" />
        )}
        <span className="flex-1">{data.drift.summary}</span>
      </div>
    </div>
  );
}

// ─── Section 2 : Courbes de calibration ───────────────────────────────────

function CalibrationSection({
  data,
  error,
}: {
  data: AccuracyResponse | undefined;
  error: unknown;
}) {
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Courbes de calibration</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-400">Erreur de chargement</p>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Courbes de calibration</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[250px] w-full rounded" />
        </CardContent>
      </Card>
    );
  }

  // Transformation des données calibration en courbes par marché
  const curves: CalibrationCurve[] = [];
  if (data.calibration.length > 0) {
    curves.push({ market: "1x2", bins: data.calibration });
  }
  // Les courbes BTTS et O/U pourraient venir d'un endpoint dédié ;
  // pour l'instant on affiche la calibration globale 1X2
  // TODO: enrichir avec BTTS et O/U quand l'API les expose

  const marketEntries = Object.entries(data.markets) as [string, MarketAccuracy][];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm">
          <span>Courbes de calibration</span>
          <span className="text-xs text-muted-foreground">
            Walk-forward · {data.windows} fenêtres · {data.sampleSize} prédictions
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <CalibrationChart
          curves={curves}
          title={`Période : ${data.period.from} → ${data.period.to}`}
        />

        {/* Métriques par marché */}
        <div className="grid gap-3 sm:grid-cols-3">
          {marketEntries.map(([market, metrics]) => (
            <div
              key={market}
              className="rounded-lg border border-white/5 bg-white/[0.02] p-3"
            >
              <p className="text-xs text-zinc-500">{market}</p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-lg font-bold tabular-nums text-zinc-100">
                  {metrics.brier.toFixed(4)}
                </span>
                <span className="text-xs text-zinc-500">
                  {metrics.sampleSize} échantillons
                </span>
              </div>
              <div className="mt-1 flex items-center gap-3 text-xs text-zinc-500">
                <span>Acc: {(metrics.accuracy * 100).toFixed(1)}%</span>
                <span>ROI: {(metrics.roi * 100).toFixed(1)}%</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Section 3 : Tableau des prédictions récentes ────────────────────────

function PredictionsTable({
  data,
  error,
}: {
  data: PredictionLogEntry[] | undefined;
  error: unknown;
}) {
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Prédictions récentes</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-400">Erreur de chargement</p>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Prédictions récentes</CardTitle>
        </CardHeader>
        <CardContent>
          <TableSkeleton rows={8} />
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Prédictions récentes</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-zinc-500">Aucune prédiction enregistrée</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">
          Prédictions récentes ({data.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/5 text-left text-zinc-500">
              <th className="pb-2 pr-3 font-medium">Match</th>
              <th className="pb-2 pr-3 font-medium">Modèle</th>
              <th className="pb-2 pr-3 font-medium text-center">Dom.</th>
              <th className="pb-2 pr-3 font-medium text-center">Nul</th>
              <th className="pb-2 pr-3 font-medium text-center">Ext.</th>
              <th className="pb-2 pr-3 font-medium text-center">Résultat</th>
              <th className="pb-2 pr-3 font-medium">Statut</th>
              <th className="pb-2 font-medium text-right">Brier</th>
            </tr>
          </thead>
          <tbody>
            {data.map((entry) => {
              // Brier score individuel si settled
              let brier: string = "—";
              if (entry.settled && entry.actualHome != null && entry.actualAway != null) {
                const actualResult =
                  entry.actualHome > entry.actualAway
                    ? 0 // victoire domicile
                    : entry.actualHome === entry.actualAway
                      ? 1 // nul
                      : 2; // victoire extérieur
                const probs = [entry.homeProb, entry.drawProb, entry.awayProb];
                const brierVal =
                  probs.reduce(
                    (sum, p, i) => sum + (i === actualResult ? (1 - p) ** 2 : p ** 2),
                    0,
                  ) / probs.length;
                brier = brierVal.toFixed(3);
              }

              const score =
                entry.actualHome != null && entry.actualAway != null
                  ? `${entry.actualHome} - ${entry.actualAway}`
                  : "—";

              return (
                <tr
                  key={entry.id}
                  className="border-b border-white/[0.03] text-zinc-300"
                >
                  <td className="py-2 pr-3 font-medium">{entry.matchId}</td>
                  <td className="py-2 pr-3 text-zinc-500">
                    {entry.modelVersion?.name ?? "—"}
                  </td>
                  <td className="py-2 pr-3 text-center tabular-nums">
                    {(entry.homeProb * 100).toFixed(1)}%
                  </td>
                  <td className="py-2 pr-3 text-center tabular-nums">
                    {(entry.drawProb * 100).toFixed(1)}%
                  </td>
                  <td className="py-2 pr-3 text-center tabular-nums">
                    {(entry.awayProb * 100).toFixed(1)}%
                  </td>
                  <td className="py-2 pr-3 text-center font-medium tabular-nums">
                    {score}
                  </td>
                  <td className="py-2 pr-3">
                    <Badge variant={entry.settled ? "default" : "secondary"}>
                      {entry.settled ? "Réglé" : "En attente"}
                    </Badge>
                  </td>
                  <td className="py-2 text-right tabular-nums text-zinc-500">
                    {brier}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

// ─── Section 4 : Versions du modèle ──────────────────────────────────────

function VersionsSection({
  data,
  error,
}: {
  data: ModelVersionEntry[] | undefined;
  error: unknown;
}) {
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Versions du modèle</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-400">Erreur de chargement</p>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Versions du modèle</CardTitle>
        </CardHeader>
        <CardContent>
          <VersionsSkeleton />
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Versions du modèle</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-zinc-500">Aucune version enregistrée</p>
        </CardContent>
      </Card>
    );
  }

  const statusVariant = (s: string): "default" | "secondary" | "destructive" | "outline" => {
    if (s === "production") return "default";
    if (s === "staging") return "secondary";
    return "outline";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">
          Versions du modèle ({data.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.map((v) => {
          // Métrique 1X2 si disponible
          const m1x2 = v.modelMetrics.find((m) => m.market === "1x2");
          return (
            <div
              key={v.id}
              className="flex items-center gap-4 rounded-lg border border-white/5 bg-white/[0.02] p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-zinc-100">{v.name}</span>
                  <Badge variant={statusVariant(v.status)}>{v.status}</Badge>
                </div>
                <div className="mt-1 flex items-center gap-3 text-xs text-zinc-500">
                  <span>Type : {v.modelType}</span>
                  <span>v{v.version}</span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(v.trainedAt).toLocaleDateString("fr-FR")}
                  </span>
                  {v.promotedAt && (
                    <span className="text-emerald-500">
                      Promu {new Date(v.promotedAt).toLocaleDateString("fr-FR")}
                    </span>
                  )}
                </div>
              </div>
              {m1x2 && (
                <div className="text-right">
                  <p className="text-sm font-bold tabular-nums text-zinc-100">
                    {m1x2.brier.toFixed(4)}
                  </p>
                  <p className="text-xs text-zinc-500">
                    Acc: {m1x2.accuracy != null ? `${(m1x2.accuracy * 100).toFixed(1)}%` : "—"}
                    {" · "}
                    n={m1x2.sampleSize}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

// ─── Section 5 : Drift Monitor ───────────────────────────────────────────

function DriftSection({
  data,
  error,
  period,
  onPeriodChange,
}: {
  data: DriftResponse | undefined;
  error: unknown;
  period: string;
  onPeriodChange: (p: string) => void;
}) {
  const periods = ["7d", "30d", "90d"];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm">Drift Monitor</CardTitle>
        <div className="flex gap-1">
          {periods.map((p) => (
            <button
              key={p}
              onClick={() => onPeriodChange(p)}
              className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                period === p
                  ? "bg-white/10 text-white"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <p className="text-sm text-red-400">Erreur de chargement</p>
        )}

        {!data && !error && <Skeleton className="h-24 w-full rounded" />}

        {data && (
          <div className="space-y-3">
            {/* Résumé */}
            <div className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${
              data.drifted
                ? "border-red-500/20 bg-red-500/5 text-red-400"
                : "border-emerald-500/20 bg-emerald-500/5 text-emerald-400"
            }`}>
              {data.drifted ? (
                <TrendingDown className="h-4 w-4 shrink-0" />
              ) : (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              )}
              <span className="flex-1">{data.summary}</span>
            </div>

            {/* Détails */}
            <div className="flex items-center gap-4 text-xs text-zinc-500">
              <span>Récent: {data.details.recentCount} prédictions ({data.details.period})</span>
              <span>Baseline: {data.details.baselineCount} ({data.details.baseline})</span>
              <span>Vérifié le {new Date(data.checkedAt).toLocaleString("fr-FR")}</span>
            </div>

            {/* Détail par marché */}
            {data.markets.length > 0 && (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {data.markets.map((m) => (
                  <div
                    key={m.market}
                    className={`rounded-lg border p-2 text-xs ${
                      m.significant
                        ? "border-red-500/20 bg-red-500/5"
                        : "border-white/5 bg-white/[0.02]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-zinc-300">{m.market}</span>
                      {m.significant && (
                        <Badge variant="destructive" className="text-[10px]">
                          Drift
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-zinc-500">
                      <span>Récent: {m.recentBrier.toFixed(4)}</span>
                      <span>Baseline: {m.baselineBrier.toFixed(4)}</span>
                      <span className={m.change > 0 ? "text-red-400" : "text-emerald-400"}>
                        {m.change > 0 ? "+" : ""}{(m.change * 100).toFixed(2)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────

export default function AdminPredictionsPage() {
  const [driftPeriod, setDriftPeriod] = useState("7d");

  // Données health — revalidate toutes les 30s
  const { data: healthData, error: healthError } = useSWR<PredictionHealth>(
    "/api/v1/predictions/health",
    fetcher,
    { refreshInterval: 30_000, revalidateOnFocus: false },
  );

  // Données calibration
  const { data: accuracyData, error: accuracyError } = useSWR<AccuracyResponse>(
    "/api/v1/predictions/accuracy",
    fetcher,
    { revalidateOnFocus: false },
  );

  // Prédictions récentes
  const { data: predictionsData, error: predictionsError } = useSWR<PredictionLogEntry[]>(
    "/api/v1/predictions/logs?limit=20",
    fetcher,
    { revalidateOnFocus: false },
  );

  // Versions du modèle
  const { data: versionsData, error: versionsError } = useSWR<ModelVersionEntry[]>(
    "/api/v1/predictions/versions",
    fetcher,
    { revalidateOnFocus: false },
  );

  // Drift — refetch quand la période change
  const { data: driftData, error: driftError } = useSWR<DriftResponse>(
    `/api/v1/predictions/drift?period=${driftPeriod}`,
    fetcher,
    { revalidateOnFocus: false },
  );

  return (
    <div className="min-h-screen bg-bg-deep pb-16 text-zinc-100">
      {/* En-tête */}
      <header className="border-b border-white/5 bg-bg-deep">
        <div className="mx-auto flex min-h-14 max-w-6xl items-center px-4 py-2 sm:px-6">
          <h1 className="text-sm font-bold tracking-tight text-white">
            Admin — Prédictions
          </h1>
          {healthData && (
            <div className="ml-auto flex items-center gap-2">
              <StatusDot status={healthData.status} />
              <span className="text-xs text-zinc-500">
                {healthData.model.active}
              </span>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
        {/* 1. Santé du modèle */}
        <HealthSection data={healthData} error={healthError} />

        {/* 2. Courbes de calibration */}
        <CalibrationSection data={accuracyData} error={accuracyError} />

        {/* 3. Prédictions récentes */}
        <PredictionsTable data={predictionsData} error={predictionsError} />

        {/* 4. Versions du modèle */}
        <VersionsSection data={versionsData} error={versionsError} />

        {/* 5. Drift Monitor */}
        <DriftSection
          data={driftData}
          error={driftError}
          period={driftPeriod}
          onPeriodChange={setDriftPeriod}
        />
      </main>
    </div>
  );
}
