"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Cookie, ChevronDown, Check, X, ShieldCheck } from "lucide-react";
import { useConsent } from "@/components/consent-provider";
import { openPrivacyDialog } from "@/components/privacy-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ConsentBanner() {
  const t = useTranslations("consent");
  const { hasDecided, acceptAll, acceptAnalyticsOnly, rejectAll } = useConsent();
  const [expanded, setExpanded] = useState(false);

  if (hasDecided) return null;

  return (
    <div
      role="dialog"
      aria-labelledby="consent-title"
      aria-describedby="consent-desc"
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-3xl p-3 sm:p-4",
        "animate-in slide-in-from-bottom-4 duration-300"
      )}
    >
      <div className="rounded-2xl border border-border/70 bg-card/95 shadow-2xl backdrop-blur-md">
        {/* Header */}
        <div className="flex items-start gap-3 p-4 sm:p-5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600/10 text-emerald-600 dark:text-emerald-400">
            <Cookie className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <h2 id="consent-title" className="text-sm font-bold tracking-tight sm:text-base">
              {t("title")}
            </h2>
            <p id="consent-desc" className="mt-1 text-xs text-muted-foreground sm:text-[13px]">
              {t("description")}{" "}
              <button
                type="button"
                onClick={openPrivacyDialog}
                className="font-semibold text-emerald-600 underline underline-offset-2 hover:text-emerald-700 dark:text-emerald-400"
              >
                {t("privacyLink")}
              </button>
            </p>
          </div>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-label={t("showDetails")}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} />
          </button>
        </div>

        {/* Expanded details */}
        {expanded && (
          <div className="border-t border-border/60 px-4 py-3 sm:px-5">
            <ConsentCategory
              icon={<ShieldCheck className="h-3.5 w-3.5" />}
              title={t("categories.necessary.title")}
              desc={t("categories.necessary.desc")}
              alwaysOn
            />
            <ConsentCategory
              icon={<Check className="h-3.5 w-3.5" />}
              title={t("categories.analytics.title")}
              desc={t("categories.analytics.desc")}
              recommended
            />
            <ConsentCategory
              icon={<Check className="h-3.5 w-3.5" />}
              title={t("categories.marketing.title")}
              desc={t("categories.marketing.desc")}
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/60 p-3 sm:p-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={rejectAll}
            className="order-1 text-xs sm:order-1"
          >
            <X className="mr-1.5 h-3 w-3" />
            {t("reject")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={acceptAnalyticsOnly}
            className="order-3 text-xs sm:order-2"
          >
            <Check className="mr-1.5 h-3 w-3" />
            {t("analyticsOnly")}
          </Button>
          <Button
            size="sm"
            onClick={acceptAll}
            className="order-2 bg-emerald-600 text-xs hover:bg-emerald-700 sm:order-3"
          >
            <Check className="mr-1.5 h-3 w-3" />
            {t("acceptAll")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ConsentCategory({
  icon,
  title,
  desc,
  alwaysOn = false,
  recommended = false,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  alwaysOn?: boolean;
  recommended?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5 py-2">
      <div className="mt-0.5 text-muted-foreground">{icon}</div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold">{title}</span>
          {alwaysOn && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">
              obligatoire
            </span>
          )}
          {recommended && (
            <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              recommandé
            </span>
          )}
        </div>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{desc}</p>
      </div>
      {alwaysOn ? (
        <span className="text-[10px] font-semibold text-muted-foreground">ON</span>
      ) : (
        <span className="text-[10px] font-semibold text-muted-foreground">OPT-IN</span>
      )}
    </div>
  );
}
