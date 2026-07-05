"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useAnalytics } from "@/components/analytics-provider";
import { Trophy, RefreshCw, Home, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const t = useTranslations("errors");
  const { track } = useAnalytics();

  useEffect(() => {
    track("404_viewed", { path: typeof window !== "undefined" ? window.location.pathname : "" });
  }, [track]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-600/10 text-emerald-600 dark:text-emerald-400">
        <Trophy className="h-7 w-7" />
      </div>
      <div className="space-y-2">
        <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">404</h1>
        <p className="text-lg font-semibold">{t("notFound.title")}</p>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">
          {t("notFound.description")}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button onClick={() => (window.location.href = "/")} className="bg-emerald-600 hover:bg-emerald-700">
          <Home className="mr-2 h-4 w-4" />
          {t("notFound.home")}
        </Button>
        <Button variant="outline" onClick={() => window.history.back()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          {t("notFound.back")}
        </Button>
      </div>
    </div>
  );
}
