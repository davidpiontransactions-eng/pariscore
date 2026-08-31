"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Line,
  Area,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { XCircle, CheckCircle, Loader2, Calendar, TrendingUp, TrendingDown, X } from "lucide-react";
import { useTranslations } from "next-intl";

type DistributionPopupProps = {
  /** Probability value (0-100) */
  probability: number;
  /** Comparison probability from bookmaker (0-100, optional) */
  bookmakerProbability?: number;
  /** Sample size or confidence factor */
  confidence?: number;
  /** On close callback */
  onClose: () => void;
  /** Whether to show bookmaker comparison */
  showComparison?: boolean;
};

/**
 * DistributionPopup — Modal showing normal distribution approximation
 * around a probability value with ±1σ and ±2σ intervals.
 *
 * Aide les utilisateurs à comprendre l'incertitude autour d'une
 * simple "probabilité de gain" en montrant la distribution normale
 * avec des écarts-types significatifs.
 */
function DistributionPopup({
  probability,
  bookmakerProbability,
  confidence = 2,
  onClose,
  showComparison = true,
}: DistributionPopupProps) {
  const t = useTranslations("probability");

  // Calculate intervals based on confidence level
  // For a proportion p, margin ≈ sqrt(p*(100-p)/n) * z-score
  // We use simplified discrete levels
  const getMargin = (p: number, z: number): number => {
    return Math.sqrt((p * (100 - p)) / 100) * z;
  };

  const margin1 = getMargin(probability, 1); // ±1σ
  const margin2 = getMargin(probability, confidence); // ±confidenceσ

  const lower1 = Math.max(0, probability - margin1);
  const upper1 = Math.min(100, probability + margin1);
  const lower2 = Math.max(0, probability - margin2);
  const upper2 = Math.min(100, probability + margin2);

  // Format numbers for display
  const fmt1Lower = lower1.toFixed(1);
  const fmt1Upper = upper1.toFixed(1);
  const fmt2Lower = lower2.toFixed(1);
  const fmt2Upper = upper2.toFixed(1);

  return (
    <div
      className="fixed inset-0 bg-gray-800/90 backdrop-blur z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-card/90 rounded-xl w-full max-w-lg mx-4 p-6 sm:p-8 outline-none shadow-2xl transform transition-transform animate-scale-from"
        role="dialog"
      >
        {/* Close button */}
        <ButtonClose onClick={onClose} aria-label={t("close.button.ariaLabel")} />

        <h2 id="popup-title" className="text-xl font-bold text-center mb-6">
          {t("popup.title", { probability })}
        </h2>

        {/* Distribution chart */}
        <ResponsiveContainer width="100%" height={200}>
          <BarChart
            data={[
              {
                probability,
                label: t("your_probability"),
              },
              ...(showComparison && bookmakerProbability !== undefined
                ? [
                    {
                      probability: bookmakerProbability,
                      label: t("bookmaker_probability"),
                    },
                  ]
                : []),
            ]}
          >
            <XAxis
              dataKey="probability"
              tick={{ fontSize: 12 }}
              domain={["0", "100"]}
            />
            {/* @ts-expect-error recharts type mismatch */}
            <YAxis domain={[]} tickHidden />
            <CartesianGrid
              strokeDasharray="3 3"
              strokeWidth={1}
              color="rgba(0,0,0,0.1"
            />
            {/* @ts-expect-error recharts type mismatch */}
            <Legend verticalAlign="bottom" dataKey="label" />
            {/* @ts-expect-error recharts type mismatch */}
            <Tooltip formatter={({ payload }) => `${payload.value[0]}%`} />
            <Bar dataKey="probability" name="probability" fill="#10b981" />
            {showComparison && bookmakerProbability !== undefined && (
              <Bar dataKey="probability" name="bookmaker" fill="#f97316" />
            )}
          </BarChart>
        </ResponsiveContainer>

        {/* Interval display */}
        <div className="mt-6 p-4 rounded-lg bg-card/80 text-center">
          <p className="text-sm text-muted-foreground mb-4">
            {t("means")}: {probability}% {t("base_probability")}
          </p>

          {/* 1σ interval */}
          <div className="flex justify-around mb-3">
            <div>
              <p className="text-xs font-medium text-emerald-600">{t("one.sigma")}</p>
              <p className="text-2xl font-bold">{fmt1Lower}% — {fmt1Upper}%</p>
            </div>
            <div>
              <p className="text-xs font-medium text-amber-600">{t("covers")}</p>
              <p className="text-2xl font-medium">{t("approximately")} {confidence}σ</p>
            </div>
          </div>

          {/* 2σ interval if different from 1σ */}
          {confidence !== 1 && (
            <div className="flex justify-around my-3">
              <div>
                <p className="text-xs font-medium text-emerald-600">{t("two.sigma")}</p>
                <p className="text-2xl font-bold">{fmt2Lower}% — {fmt2Upper}%</p>
              </div>
              <div>
                <p className="text-xs font-medium text-amber-600">{t("covers")}</p>
                <p className="text-2xl font-medium">{t("approximately")} {confidence}σ</p>
              </div>
            </div>
          )}

          {/* Interpretation text */}
          <p className="text-sm text-muted-foreground mt-4 line-clamp-3">
            {t(" interpretation")}
          </p>
        </div>

        {/* Bookmaker comparison if shown */}
        {showComparison && bookmakerProbability !== undefined && (
          <div className="mt-6 p-4 rounded-lg bg-card/80 text-center">
            <h3 className="text-base font-medium text-emerald-600 mb-3">
              {t("bookmaker.comparison")}
            </h3>
            <p className="text-lg font-medium">
              {t("bookmaker.implied")}: {bookmakerProbability}%
            </p>
            <p className="text-sm text-muted-foreground">
              {t("difference")}: {Math.abs(
                probability - bookmakerProbability,
              ).toFixed(1)}%
            </p>
          </div>
        )}

        {/* Action button */}
        <div className="mt-8 flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            className="text-sm"
          >
            {t("close.button")}
          </Button>
        </div>
      </div>
    </div>
  );
}

const Button = ({
  className,
  variant = "default",
  size = "default",
  onClick,
  ...props
}: {
  className?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "md" | "lg" | "default";
  onClick: () => void;
  [key: string]: any;
}) => (
  <button
    className={className || `px-4 py-2 rounded-md font-medium transition-colors ${
      variant === "default"
        ? "bg-primary text-primary-foreground"
        : variant === "outline"
        ? "bg-transparent border border-slate-500/60 text-slate-400 hover:bg-slate-950/80 hover:text-white"
        : "bg-muted/30 text-slate-400 hover:bg-muted/50 text-slate-300"
    } ${
      size === "sm"
        ? "text-xs py-1"
        : size === "lg"
        ? "text-xl py-3"
        : ""
    } ${
      variant === "outline"
        ? "border-2"
        : ""
    } ${onClick !== undefined ? "cursor-pointer" : ""} ${props.className || ""}`
    }
    onClick={onClick}
    {...props}
  />
);

function ButtonClose({ className, onClick, ...props }: any) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className={className}
    >
      <X className="h-4 w-4" />
    </Button>
  );
}

export { DistributionPopup as ProbabilityDistributionPopup };