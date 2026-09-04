"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ShapWaterfall } from "./shap-waterfall";
import type { HybridPrediction } from "@/lib/predictions/fiba-predictions";

type PredictionPanelProps = {
  prediction: HybridPrediction;
  homeAbbr: string;
  awayAbbr: string;
  homeName: string;
  awayName: string;
  className?: string;
};

type Tab = "overview" | "shap" | "models";

export function PredictionPanel({
  prediction,
  homeAbbr,
  awayAbbr,
  homeName,
  awayName,
  className,
}: PredictionPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  const pHome = Math.round(prediction.blendedPHome * 100);
  const pAway = Math.round((1 - prediction.blendedPHome) * 100);
  const edge = Math.abs(Math.round(prediction.edge * 100));

  return (
    <div className={cn("rounded-xl border bg-card overflow-hidden", className)}>
      {/* Tabs */}
      <div className="flex border-b bg-muted/30">
        {(["overview", "shap", "models"] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex-1 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider transition-colors",
              activeTab === tab
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab === "overview" && "Vue d'ensemble"}
            {tab === "shap" && "SHAP"}
            {tab === "models" && "Modèles"}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-3">
        {/* OVERVIEW TAB */}
        {activeTab === "overview" && (
          <div className="space-y-3">
            {/* Big WP display */}
            <div className="flex items-center justify-center gap-4">
              <div className="text-center">
                <div className="text-2xl font-black text-emerald-500">{pHome}%</div>
                <div className="text-[10px] text-muted-foreground">{homeAbbr}</div>
              </div>
              <div className="text-xs text-muted-foreground">vs</div>
              <div className="text-center">
                <div className="text-2xl font-black text-red-500">{pAway}%</div>
                <div className="text-[10px] text-muted-foreground">{awayAbbr}</div>
              </div>
            </div>

            {/* Edge & Confidence */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-muted/50 p-2">
                <div className={cn(
                  "text-sm font-bold",
                  prediction.recommendation === "HOME" && "text-emerald-500",
                  prediction.recommendation === "AWAY" && "text-red-500",
                  prediction.recommendation === "NEUTRAL" && "text-muted-foreground",
                )}>
                  {prediction.recommendation === "HOME" && `▲ ${homeAbbr}`}
                  {prediction.recommendation === "AWAY" && `▼ ${awayAbbr}`}
                  {prediction.recommendation === "NEUTRAL" && "— Neutre"}
                </div>
                <div className="text-[9px] text-muted-foreground">Recommandation</div>
              </div>
              <div className="rounded-lg bg-muted/50 p-2">
                <div className="text-sm font-bold">{edge}%</div>
                <div className="text-[9px] text-muted-foreground">Edge</div>
              </div>
              <div className="rounded-lg bg-muted/50 p-2">
                <div className="text-sm font-bold">{Math.round(prediction.blendedConfidence * 100)}%</div>
                <div className="text-[9px] text-muted-foreground">Confiance</div>
              </div>
            </div>

            {/* Model Agreement */}
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-muted-foreground">Accord des modèles</span>
              <div className="flex items-center gap-1">
                <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${prediction.modelAgreement * 100}%` }}
                  />
                </div>
                <span className="font-mono">{Math.round(prediction.modelAgreement * 100)}%</span>
              </div>
            </div>
          </div>
        )}

        {/* SHAP TAB */}
        {activeTab === "shap" && (
          <ShapWaterfall
            prediction={prediction}
            homeAbbr={homeAbbr}
            awayAbbr={awayAbbr}
          />
        )}

        {/* MODELS TAB */}
        {activeTab === "models" && (
          <div className="space-y-2">
            {/* Model breakdown */}
            {[
              { name: "XGBoost+SHAP", p: prediction.xgboost.pHome, weight: 0.40, icon: "🤖" },
              { name: "Four Factors", p: prediction.fourFactors.pHome, weight: 0.25, icon: "📊" },
              { name: "Elo Rating", p: prediction.elo.pHome, weight: 0.20, icon: "🏆" },
              { name: "PIR", p: prediction.pir.pHome, weight: 0.15, icon: "📈" },
            ].map(({ name, p, weight, icon }) => (
              <div key={name} className="flex items-center gap-2 rounded-lg bg-muted/30 px-2 py-1.5">
                <span className="text-sm">{icon}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold">{name}</span>
                    <span className="text-[10px] text-muted-foreground">{Math.round(weight * 100)}%</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          p > 0.5 ? "bg-emerald-500" : "bg-red-500",
                        )}
                        style={{ width: `${Math.abs(p - 0.5) * 200}%` }}
                      />
                    </div>
                    <span className={cn(
                      "text-[10px] font-mono tabular-nums w-10 text-right",
                      p > 0.5 ? "text-emerald-500" : "text-red-500",
                    )}>
                      {Math.round(p * 100)}%
                    </span>
                  </div>
                </div>
              </div>
            ))}

            {/* Summary */}
            <div className="mt-2 text-[9px] text-muted-foreground text-center">
              Blend pondéré: XGBoost 40% + Four Factors 25% + Elo 20% + PIR 15%
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
