"use client";

import { BrainCircuit, Loader2, Lightbulb, TrendingUp } from "lucide-react";
import type { FootballMatch } from "@/lib/football-data";
import { useFootballAIReport } from "@/hooks/use-football-ai-report";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Rapport de match IA — Phase 2. Carte élégante affichant la synthèse narrative,
 * 3 faits marquants et la suggestion de combiné générés par Gemini depuis le
 * modèle PariScore. Masquée si le rapport est indisponible (pas d'erreur fatale).
 */
export function AIMatchReport({
  match,
  enabled,
  className,
}: {
  match: FootballMatch | null;
  enabled: boolean;
  className?: string;
}) {
  const { report, isLoading, error } = useFootballAIReport(match, enabled);

  if (!enabled || (!isLoading && !report && !error)) return null;

  return (
    <section
      className={cn(
        "rounded-2xl border border-violet-500/30 bg-violet-500/5 p-3.5",
        className,
      )}
      aria-label="Rapport de match IA"
    >
      <header className="mb-2 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-violet-300">
          <BrainCircuit className="h-3.5 w-3.5" aria-hidden />
          Rapport de match IA
        </h3>
        {report && (
          <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-violet-300">
            Confiance {report.confidence}/5
          </span>
        )}
      </header>

      {isLoading && (
        <div className="space-y-2" aria-busy="true">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      )}

      {error && !isLoading && (
        <p className="text-[11px] text-muted-foreground">
          Rapport indisponible pour le moment.
        </p>
      )}

      {report && !isLoading && (
        <div className="space-y-2.5">
          <p className="text-[12px] leading-relaxed text-card-foreground/90">{report.synthesis}</p>

          {report.keyFacts.length > 0 && (
            <ul className="space-y-1">
              {report.keyFacts.map((fact, i) => (
                <li key={i} className="flex items-start gap-1.5 text-[11px] text-card-foreground/80">
                  <Lightbulb className="mt-0.5 h-3 w-3 shrink-0 text-amber-400" aria-hidden />
                  <span>{fact}</span>
                </li>
              ))}
            </ul>
          )}

          {report.combo && (
            <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-2">
              <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden />
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-emerald-300">{report.combo.label}</p>
                {report.combo.rationale && (
                  <p className="text-[10px] text-card-foreground/70">{report.combo.rationale}</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
