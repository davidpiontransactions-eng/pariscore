"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  TrendingUp,
  Activity,
  Scale,
  Target,
  AlertTriangle,
  ShieldCheck,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";

/**
 * Singleton open-state for the about dialog.
 *
 * Mirrors the pattern used by `PrivacyDialog`: a module-level `openFn`
 * reference is registered when the dialog mounts, so any component can call
 * `openAboutDialog()` from an event handler without prop-drilling.
 *
 * Note: the setter is only invoked from external event handlers (never from
 * an effect body), so the `react-hooks/set-state-in-effect` rule is
 * respected. The effect below only writes to the module-scoped `openFn`
 * ref and cleans it up on unmount.
 */
let openFn: ((open: boolean) => void) | null = null;
export function openAboutDialog() {
  openFn?.(true);
}

type SectionKey =
  | "approach"
  | "elo"
  | "form"
  | "h2h"
  | "ic"
  | "limits"
  | "transparency";

type SectionDef = {
  key: SectionKey;
  icon: LucideIcon;
  /** Whether to render the optional `formula` message as a <code> block. */
  hasFormula: boolean;
  /** Accent color for the section icon — emerald for "info" sections, amber for limits. */
  tone: "emerald" | "amber";
};

const SECTIONS: SectionDef[] = [
  { key: "approach", icon: TrendingUp, hasFormula: false, tone: "emerald" },
  { key: "elo", icon: Activity, hasFormula: true, tone: "emerald" },
  { key: "form", icon: Activity, hasFormula: false, tone: "emerald" },
  { key: "h2h", icon: Scale, hasFormula: false, tone: "emerald" },
  { key: "ic", icon: Target, hasFormula: false, tone: "emerald" },
  { key: "limits", icon: AlertTriangle, hasFormula: false, tone: "amber" },
  { key: "transparency", icon: ShieldCheck, hasFormula: false, tone: "emerald" },
];

const TONE_CLASS: Record<SectionDef["tone"], string> = {
  emerald: "text-emerald-600 dark:text-emerald-400",
  amber: "text-amber-600 dark:text-amber-400",
};

export function AboutDialog() {
  const t = useTranslations("about");
  const [open, setOpen] = useState(false);

  // Register the open function so external callers can trigger the dialog.
  // No state is set inside this effect — only the module-scoped ref is mutated.
  useEffect(() => {
    openFn = setOpen;
    return () => {
      openFn = null;
    };
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[90vh] w-[95vw] max-w-2xl overflow-hidden p-0">
        <DialogHeader className="border-b border-border/60 px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <HelpCircle className="h-4 w-4 text-emerald-600" />
            {t("title")}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {t("subtitle")}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-160px)]">
          <div className="space-y-5 px-5 py-4 text-sm">
            {SECTIONS.map(({ key, icon: Icon, hasFormula, tone }) => (
              <section key={key} aria-labelledby={`about-section-${key}`}>
                <h3
                  id={`about-section-${key}`}
                  className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  <Icon className={cn("h-3.5 w-3.5", TONE_CLASS[tone])} />
                  {t(`sections.${key}.title`)}
                </h3>
                <p className="whitespace-pre-line leading-relaxed text-foreground/90">
                  {t(`sections.${key}.body`)}
                </p>
                {hasFormula && (
                  <pre
                    className="mt-2 overflow-x-auto rounded-md border border-border/60 bg-muted/40 px-3 py-2"
                    aria-label={t(`sections.${key}.title`)}
                  >
                    <code
                      className="font-mono text-[12px] text-emerald-700 dark:text-emerald-300"
                      translate="no"
                    >
                      {t(`sections.${key}.formula`)}
                    </code>
                  </pre>
                )}
              </section>
            ))}
          </div>
        </ScrollArea>

        <div className="flex items-center justify-end gap-2 border-t border-border/60 p-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setOpen(false)}
            className="text-xs"
          >
            {t("close")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
