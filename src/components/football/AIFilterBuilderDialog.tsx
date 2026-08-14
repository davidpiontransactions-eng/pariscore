"use client";

import { useState } from "react";
import { Sparkles, Loader2, Trash2, Plus, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  compileNLFilter,
  NL_FILTER_EXAMPLES,
  type AIFilterPreset,
  type CompiledFilterRule,
  type FilterOperator,
} from "@/lib/football-nl-filter";

const OPERATORS: FilterOperator[] = [">=", "<=", "==", "delta_gt"];

/** Étiquette lisible d'une règle compilée. */
function ruleLabel(rule: CompiledFilterRule): string {
  const op = rule.operator === "delta_gt" ? "> (écart)" : rule.operator;
  const unit = rule.unit === "percentage" ? "%" : rule.unit === "ppg" ? " PPG" : "";
  return `${rule.field} ${op} ${rule.value}${unit}`;
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (preset: AIFilterPreset) => void;
};

/**
 * Dialog « Filtre IA » — Phase 1. L'utilisateur décrit un filtre en langage
 * naturel, Gemini le compile en règles éditables, puis il le sauvegarde comme
 * preset réutilisable dans la barre de filtres de l'onglet Football.
 */
export function AIFilterBuilderDialog({ open, onOpenChange, onSave }: Props) {
  const [text, setText] = useState("");
  const [isCompiling, setIsCompiling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<AIFilterPreset | null>(null);

  const handleCompile = async (query?: string) => {
    const q = (query ?? text).trim();
    if (!q || isCompiling) return;
    setIsCompiling(true);
    setError(null);
    const result = await compileNLFilter(q);
    setIsCompiling(false);
    if (result.ok) {
      setDraft(result.preset);
    } else {
      setError(result.error);
      setDraft(null);
    }
  };

  const updateRule = (idx: number, patch: Partial<CompiledFilterRule>) => {
    if (!draft) return;
    const rules = draft.rules.map((r, i) => (i === idx ? { ...r, ...patch } : r));
    setDraft({ ...draft, rules });
  };

  const removeRule = (idx: number) => {
    if (!draft) return;
    setDraft({ ...draft, rules: draft.rules.filter((_, i) => i !== idx) });
  };

  const handleSave = () => {
    if (!draft || draft.rules.length === 0) return;
    onSave(draft);
    setDraft(null);
    setText("");
    onOpenChange(false);
  };

  const handleClose = (next: boolean) => {
    if (!next) {
      setDraft(null);
      setError(null);
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-400" aria-hidden />
            Créer un filtre avec l'IA
          </DialogTitle>
          <DialogDescription>
            Décrivez votre filtre en langage naturel, l'IA le compile en règles applicables aux matchs.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Requête */}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ex : BTTS avec une équipe visiteuse forte, domicile ≥ 1.2 PPG, proba BTTS ≥ 55%"
            rows={3}
            className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />

          {/* Exemples */}
          <div className="flex flex-wrap gap-1.5">
            {NL_FILTER_EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => {
                  setText(ex);
                  void handleCompile(ex);
                }}
                className="rounded-full border border-border bg-muted/30 px-2.5 py-1 text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {ex.length > 48 ? `${ex.slice(0, 48)}…` : ex}
              </button>
            ))}
          </div>

          {/* Action compiler */}
          <button
            type="button"
            onClick={() => void handleCompile()}
            disabled={!text.trim() || isCompiling}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50 dark:bg-emerald-500 dark:hover:bg-emerald-400"
          >
            {isCompiling ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Compilation…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" aria-hidden />
                Compiler le filtre
              </>
            )}
          </button>

          {error && (
            <p className="rounded-lg border border-rose-500/40 bg-rose-500/5 px-3 py-2 text-xs text-rose-400">
              {error}
            </p>
          )}

          {/* Règles compilées — éditables */}
          {draft && (
            <div className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
              <div className="flex items-center justify-between gap-2">
                <input
                  value={draft.label}
                  onChange={(e) => setDraft({ ...draft, label: e.target.value.slice(0, 30) })}
                  className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Nom du filtre"
                />
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {draft.rules.length} règle{draft.rules.length > 1 ? "s" : ""}
                </span>
              </div>
              {draft.description && (
                <p className="text-[11px] text-muted-foreground">{draft.description}</p>
              )}

              <ul className="space-y-1.5">
                {draft.rules.map((rule, idx) => (
                  <li
                    key={`${rule.field}-${idx}`}
                    className="flex items-center gap-1.5 rounded-md bg-background px-2 py-1.5 text-[11px]"
                  >
                    <span className="min-w-0 flex-1 truncate font-mono" title={ruleLabel(rule)}>
                      {rule.field}
                    </span>
                    <select
                      value={rule.operator}
                      onChange={(e) => updateRule(idx, { operator: e.target.value as FilterOperator })}
                      className="rounded border border-border bg-background px-1 py-0.5 text-[10px]"
                      aria-label="Opérateur"
                    >
                      {OPERATORS.map((op) => (
                        <option key={op} value={op}>
                          {op}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={rule.value}
                      onChange={(e) => updateRule(idx, { value: Number(e.target.value) })}
                      className="w-16 rounded border border-border bg-background px-1 py-0.5 text-right text-[10px] tabular-nums"
                      aria-label="Valeur"
                    />
                    <button
                      type="button"
                      onClick={() => removeRule(idx)}
                      className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-rose-400"
                      aria-label="Supprimer la règle"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={draft.rules.length === 0}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-xs font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                  Enregistrer le filtre
                </button>
                <button
                  type="button"
                  onClick={() => setDraft(null)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  Annuler
                </button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
