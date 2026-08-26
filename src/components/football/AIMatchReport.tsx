"use client";

import { BrainCircuit, Loader2, Lightbulb, TrendingUp, Target, Zap } from "lucide-react";
import type { FootballMatch } from "@/lib/football-data";
import type { AIPredictiveBet } from "@/lib/football-match-report";
import { useFootballAIReport } from "@/hooks/use-football-ai-report";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Badge de confiance : étoiles colorées (1-5). */
function ConfidenceBadge({ level }: { level: number }) {
  const colors = ["text-muted-foreground", "text-rose-400", "text-orange-400", "text-amber-400", "text-emerald-400", "text-emerald-300"];
  return (
    <span className={`text-[10px] font-bold ${colors[level] ?? colors[0]}`}>
      {"★".repeat(level)}{"☆".repeat(5 - level)}
    </span>
  );
}

/** Carte d'un pari prédictif IA — label, barre proba, odds, confiance, rationale. */
function PredictiveBetCard({ bet, index }: { bet: AIPredictiveBet; index: number }) {
  const icons = ["🏆", "⚽", "⚡"];
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-2.5">
      <span className="text-base leading-none" aria-hidden="true">
        {icons[index] ?? "🎯"}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-[11px] font-semibold text-foreground">
            {bet.label}
          </p>
          {bet.odds != null && (
            <span className="shrink-0 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-emerald-300">
              {bet.odds.toFixed(2)}
            </span>
          )}
        </div>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all"
            style={{ width: `${bet.prob}%` }}
          />
        </div>
        <div className="mt-1 flex items-center justify-between gap-1">
          <span className="text-[11px] font-bold tabular-nums text-emerald-300">
            {bet.prob}%
          </span>
          <ConfidenceBadge level={bet.confidence} />
        </div>
        {bet.rationale && (
          <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
            {bet.rationale}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Rapport de match IA — Phase 2. Carte élégante affichant la synthèse narrative,
 * 3 faits marquants, 3 paris prédictifs et la suggestion de combiné générés par
 * Gemini depuis le modèle PariScore. Masquée si le rapport est indisponible
 * (pas d'erreur fatale).
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
        "rounded-2xl border border-ai-insight/30 bg-ai-insight/5 p-3.5",
        className,
      )}
      aria-label="Rapport de match IA"
    >
      <header className="mb-2 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-ai-insight">
          <BrainCircuit className="h-3.5 w-3.5" aria-hidden />
          Rapport de match IA
        </h3>
        {report && (
          <span className="rounded-full bg-ai-insight/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-ai-insight">
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

          {/* 3 Paris Prédictifs IA */}
          {report.predictiveBets && report.predictiveBets.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Target className="h-3 w-3 text-emerald-400" aria-hidden />
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">
                  3 Paris Prédictifs IA
                </span>
              </div>
              {report.predictiveBets.map((bet, i) => (
                <PredictiveBetCard key={i} bet={bet} index={i} />
              ))}
            </div>
          )}

          {report.combo && (
            <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-2">
              <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden />
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-emerald-300">{report.combo.label}</p>
                {report.combo.rationale && (
                  <p className="text-[11px] text-card-foreground/70">{report.combo.rationale}</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
