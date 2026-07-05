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
import {
  Cookie,
  ShieldCheck,
  BarChart3,
  Megaphone,
  Clock,
  Mail,
  Globe,
  RefreshCw,
} from "lucide-react";
import { useConsent } from "@/components/consent-provider";
import { cn } from "@/lib/utils";

// Singleton open-state for the privacy dialog (any component can open it)
let openFn: ((open: boolean) => void) | null = null;
export function openPrivacyDialog() {
  openFn?.(true);
}

export function PrivacyDialog() {
  const t = useTranslations("consent");
  const tPrivacy = useTranslations("privacy");
  const { state, hasDecided, acceptAll, acceptAnalyticsOnly, rejectAll, reset } = useConsent();
  const [open, setOpen] = useState(false);

  // Register open function for external callers
  useEffect(() => {
    openFn = setOpen;
    return () => {
      openFn = null;
    };
  }, []);

  // Auto-open if query param ?privacy=1 is present (for footer links)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("privacy") === "1") {
      Promise.resolve().then(() => setOpen(true));
    }
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[90vh] w-[95vw] max-w-2xl overflow-hidden p-0">
        <DialogHeader className="border-b border-border/60 px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            {tPrivacy("title")}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {tPrivacy("subtitle")}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-160px)]">
          <div className="space-y-5 px-5 py-4 text-sm">
            {/* Intro */}
            <section>
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {tPrivacy("intro.title")}
              </h3>
              <p className="leading-relaxed text-foreground/90">
                {tPrivacy("intro.body")}
              </p>
            </section>

            {/* Cookie categories */}
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {tPrivacy("categories.title")}
              </h3>
              <div className="space-y-2.5">
                <CategoryRow
                  icon={<Cookie className="h-3.5 w-3.5" />}
                  title={t("categories.necessary.title")}
                  desc={t("categories.necessary.desc")}
                  status={tPrivacy("status.alwaysOn")}
                  alwaysOn
                />
                <CategoryRow
                  icon={<BarChart3 className="h-3.5 w-3.5" />}
                  title={t("categories.analytics.title")}
                  desc={t("categories.analytics.desc")}
                  status={state.analytics ? tPrivacy("status.enabled") : tPrivacy("status.disabled")}
                  enabled={state.analytics}
                />
                <CategoryRow
                  icon={<Megaphone className="h-3.5 w-3.5" />}
                  title={t("categories.marketing.title")}
                  desc={t("categories.marketing.desc")}
                  status={state.marketing ? tPrivacy("status.enabled") : tPrivacy("status.disabled")}
                  enabled={state.marketing}
                />
              </div>
            </section>

            {/* Storage duration */}
            <section>
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                {tPrivacy("storage.title")}
              </h3>
              <ul className="space-y-1.5 text-xs text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
                  <span>
                    <strong className="text-foreground">{tPrivacy("storage.consent")}</strong> — {tPrivacy("storage.consentDuration")}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
                  <span>
                    <strong className="text-foreground">{tPrivacy("storage.locale")}</strong> — {tPrivacy("storage.localeDuration")}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
                  <span>
                    <strong className="text-foreground">{tPrivacy("storage.theme")}</strong> — {tPrivacy("storage.themeDuration")}
                  </span>
                </li>
              </ul>
            </section>

            {/* User rights */}
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {tPrivacy("rights.title")}
              </h3>
              <p className="mb-2 text-xs leading-relaxed text-foreground/90">
                {tPrivacy("rights.body")}
              </p>
              <ul className="space-y-1 text-xs text-muted-foreground">
                {["access", "rectify", "erase", "limit", "portability", "object"].map((right) => (
                  <li key={right} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-emerald-500" />
                    <span>{tPrivacy(`rights.items.${right}`)}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Contact */}
            <section className="rounded-lg border border-border/60 bg-muted/20 p-3">
              <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Mail className="h-3.5 w-3.5" />
                {tPrivacy("contact.title")}
              </h3>
              <p className="text-xs text-foreground/90">
                {tPrivacy("contact.body")}
              </p>
              <p className="mt-1.5 font-mono text-xs text-emerald-600 dark:text-emerald-400">
                dpo@setpoint.example
              </p>
            </section>

            {/* Current consent status */}
            {hasDecided && (
              <section className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                      {tPrivacy("currentStatus")}
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      {state.status === "all" && tPrivacy("status.all")}
                      {state.status === "analytics-only" && tPrivacy("status.analyticsOnly")}
                      {state.status === "rejected" && tPrivacy("status.rejected")}
                      {state.grantedAt && (
                        <> · {new Date(state.grantedAt).toLocaleDateString()}</>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      reset();
                      setOpen(false);
                    }}
                    className="text-xs"
                  >
                    <RefreshCw className="mr-1.5 h-3 w-3" />
                    {tPrivacy("reset")}
                  </Button>
                </div>
              </section>
            )}
          </div>
        </ScrollArea>

        {/* Footer actions */}
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/60 p-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              rejectAll();
              setOpen(false);
            }}
            className="text-xs"
          >
            {t("reject")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              acceptAnalyticsOnly();
              setOpen(false);
            }}
            className="text-xs"
          >
            {t("analyticsOnly")}
          </Button>
          <Button
            size="sm"
            onClick={() => {
              acceptAll();
              setOpen(false);
            }}
            className="bg-emerald-600 text-xs hover:bg-emerald-700"
          >
            {t("acceptAll")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CategoryRow({
  icon,
  title,
  desc,
  status,
  alwaysOn = false,
  enabled = false,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  status: string;
  alwaysOn?: boolean;
  enabled?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-border/50 p-2.5">
      <div
        className={cn(
          "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md",
          alwaysOn
            ? "bg-muted text-muted-foreground"
            : enabled
            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
            : "bg-muted text-muted-foreground/60"
        )}
      >
        {icon}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold">{title}</span>
          <span
            className={cn(
              "rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider",
              alwaysOn
                ? "bg-muted text-muted-foreground"
                : enabled
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                : "bg-muted text-muted-foreground/60"
            )}
          >
            {status}
          </span>
        </div>
        <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{desc}</p>
      </div>
    </div>
  );
}
