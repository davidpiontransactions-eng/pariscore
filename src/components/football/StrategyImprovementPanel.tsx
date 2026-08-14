"use client";

import { useMemo, useState } from "react";
import { FlaskConical, Save, Sparkles } from "lucide-react";
import type { FootballMatch } from "@/lib/football-data";
import { cn } from "@/lib/utils";
import {
  applyCompiledRules,
  type AIFilterPreset,
  type CompiledFilterRule,
} from "@/lib/football-nl-filter";
import { pickScore } from "@/lib/football-pick-utils";

/**
 * Onglet « Améliorer » — Phase 5. Prend un filtre actif, génère des variations de
 * seuils, mesure le rendement (confiance moyenne pondérée par la taille) de chacune
 * sur les matchs courants, et permet de sauvegarder la meilleure comme nouveau filtre.
 */

type Variation = {
  id: string;
  label: string;
  rules: CompiledFilterRule[];
  matchCount: number;
  avgConfidence: number;
  /** Score de rendement : confiance moyenne pondérée par l'échantillon. */
  yieldScore: number;
};

/** Score de rendement d'un jeu de règles sur un ensemble de matchs. */
function scoreRules(matches: FootballMatch[], rules: CompiledFilterRule[]): { count: number; avg: number; score: number } {
  const filtered = applyCompiledRules(matches, rules);
  if (filtered.length === 0) return { count: 0, avg: 0, score: 0 };
  const avg = filtered.reduce((a, m) => a + pickScore(m), 0) / filtered.length;
  // Pondération : un échantillon < 5 matchs est pénalisé (manque de robustesse).
  const weight = Math.min(1, filtered.length / 5);
  return { count: filtered.length, avg, score: avg * weight };
}

/** Génère les variations d'une règle (±10% / ±20%, arrondies). */
function ruleVariations(rule: CompiledFilterRule): { label: string; value: number }[] {
  const v = rule.value;
  const round = (x: number) => (Number.isInteger(v) ? Math.round(x) : Math.round(x * 100) / 100);
  return [
    { label: `${rule.field} ${rule.operator} ${round(v * 0.9)}`, value: round(v * 0.9) },
    { label: `${rule.field} ${rule.operator} ${round(v * 1.1)}`, value: round(v * 1.1) },
    { label: `${rule.field} ${rule.operator} ${round(v * 1.2)}`, value: round(v * 1.2) },
  ];
}

export function StrategyImprovementPanel({
  matches,
  preset,
  onSaveVariation,
  className,
}: {
  matches: FootballMatch[];
  preset: AIFilterPreset | null;
  onSaveVariation?: (preset: AIFilterPreset) => void;
  className?: string;
}) {
  const [savedIdx, setSavedIdx] = useState<string | null>(null);

  const { baseline, variations } = useMemo(() => {
    if (!preset || preset.rules.length === 0) return { baseline: null, variations: [] as Variation[] };

    const base = scoreRules(matches, preset.rules);
    const baseline = { ...base, label: "Filtre actuel" };

    // On fait varier la règle la plus discriminante (première règle numérique).
    const targetIdx = preset.rules.findIndex((r) => r.operator !== "==");
    const idx = targetIdx >= 0 ? targetIdx : 0;
    const target = preset.rules[idx];

    const vars: Variation[] = ruleVariations(target).map((rv, i) => {
      const rules = preset.rules.map((r, ri) => (ri === idx ? { ...r, value: rv.value } : r));
      const s = scoreRules(matches, rules);
      return {
        id: `var-${i}`,
        label: rv.label,
        rules,
        matchCount: s.count,
        avgConfidence: s.avg,
        yieldScore: s.score,
      };
    });

    return { baseline, variations: vars };
  }, [matches, preset]);

  if (!preset) {
    return (
      <section className={cn("rounded-2xl border border-border/70 bg-card p-4", className)}>
        <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          <FlaskConical className="h-3.5 w-3.5 text-violet-400" aria-hidden />
          Améliorer la stratégie
        </h3>
        <p className="rounded-lg bg-muted/30 px-3 py-4 text-center text-xs text-muted-foreground">
          Créez d'abord un filtre IA pour tester des variations de seuils.
        </p>
      </section>
    );
  }

  const baseScore = baseline?.score ?? 0;

  return (
    <section className={cn("rounded-2xl border border-border/70 bg-card p-4", className)} aria-label="Améliorer la stratégie">
      <header className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          <FlaskConical className="h-3.5 w-3.5 text-violet-400" aria-hidden />
          Améliorer · {preset.label}
        </h3>
        <span className="text-[10px] text-muted-foreground">base {baseScore.toFixed(1)}</span>
      </header>

      <div className="space-y-1.5">
        {variations.map((v) => {
          const delta = v.yieldScore - baseScore;
          const positive = delta > 0;
          return (
            <div
              key={v.id}
              className="flex items-center gap-2 rounded-lg border border-border/50 bg-background px-2.5 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-[10px] text-foreground">{v.label}</p>
                <p className="text-[9px] text-muted-foreground">
                  {v.matchCount} match{v.matchCount > 1 ? "s" : ""} · conf. {v.avgConfidence.toFixed(0)}%
                </p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                  positive ? "bg-emerald-500/15 text-emerald-400" : "bg-muted text-muted-foreground",
                )}
              >
                {positive ? "+" : ""}
                {delta.toFixed(1)}
              </span>
              {positive && onSaveVariation && (
                <button
                  type="button"
                  onClick={() => {
                    onSaveVariation({
                      ...preset,
                      id: `${preset.id}-opt-${Date.now()}`,
                      label: `${preset.label} (opt.)`,
                      rules: v.rules,
                      createdAt: new Date().toISOString(),
                    });
                    setSavedIdx(v.id);
                  }}
                  className="shrink-0 rounded-md bg-foreground p-1 text-background transition-opacity hover:opacity-80"
                  title="Enregistrer comme nouveau filtre"
                  aria-label="Enregistrer la variation"
                >
                  {savedIdx === v.id ? <Sparkles className="h-3 w-3" /> : <Save className="h-3 w-3" />}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {variations.length > 0 && !variations.some((v) => v.yieldScore > baseScore) && (
        <p className="mt-2 text-[10px] text-muted-foreground">
          Aucune variation ne bat le filtre actuel sur les matchs disponibles.
        </p>
      )}
    </section>
  );
}
