"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import * as Sentry from "@sentry/nextjs";
import { useAnalytics } from "@/components/analytics-provider";
import { Trophy, RefreshCw, Home, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errors");
  const { track } = useAnalytics();

  useEffect(() => {
    // Capture in Sentry (will respect beforeSend consent gate)
    Sentry.captureException(error);
    track("error_boundary_triggered", {
      message: error.message,
      digest: error.digest,
    });
  }, [error, track]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
        <AlertTriangle className="h-7 w-7" />
      </div>
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {t("error.title")}
        </h1>
        <p className="text-base font-semibold">{t("error.subtitle")}</p>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">
          {t("error.description")}
        </p>
        {error.digest && (
          <p className="mt-2 font-mono text-[11px] text-muted-foreground/70">
            ID: {error.digest}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button onClick={reset} className="bg-emerald-600 hover:bg-emerald-700">
          <RefreshCw className="mr-2 h-4 w-4" />
          {t("error.retry")}
        </Button>
        <Button variant="outline" onClick={() => (window.location.href = "/")}>
          <Home className="mr-2 h-4 w-4" />
          {t("error.home")}
        </Button>
      </div>
    </div>
  );
}
