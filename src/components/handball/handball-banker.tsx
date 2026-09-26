"use client";

import { useMemo } from "react";
import { useHandballTop8 } from "@/hooks/use-handball-top8";

const STRONG_THRESHOLD = 65;

export function HandballBanker() {
  const { matchesFor, isReady } = useHandballTop8();

  const banker = useMemo(() => {
    if (!isReady) return null;

    const candidates = [
      ...matchesFor("valueBet").map((e) => ({
        ...e,
        source: "valueBet" as const,
      })),
      ...matchesFor("bestTeam").map((e) => ({
        ...e,
        source: "bestTeam" as const,
      })),
    ].filter((e) => e.probPct != null && e.probPct >= STRONG_THRESHOLD);

    if (candidates.length === 0) return null;

    candidates.sort((a, b) => (b.ev ?? 0) - (a.ev ?? 0));
    return candidates[0];
  }, [isReady, matchesFor]);

  if (!banker) return null;

  const pickName =
    banker.pick === "home" ? banker.home.name : banker.away.name;

  return (
    <div className="rounded-lg border bg-gradient-to-br from-emerald-500/5 to-emerald-500/10 p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">🏦</span>
        <h3 className="text-sm font-semibold">Banker du jour</h3>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <div className="font-bold text-lg">{pickName}</div>
          <div className="text-xs text-[#717171]">
            {banker.home.name} vs {banker.away.name} • {banker.league}
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-emerald-500">
            {banker.probPct?.toFixed(0)}%
          </div>
          {banker.ev != null && banker.ev > 0 && (
            <div className="text-xs text-emerald-600">
              EV +{banker.ev.toFixed(2)}
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 text-xs text-[#717171]">
        💡{" "}
        {banker.source === "valueBet"
          ? "Value bet détecté — probabilité modèle supérieure au marché"
          : "Équipe la plus forte du match selon le modèle PPG"}
      </div>
    </div>
  );
}
