import { getTranslations } from "next-intl/server";
import { Trophy, Home, RefreshCw } from "lucide-react";

// not-found.tsx est prerendré statiquement par Next.js → doit être un Server Component.
// Les hooks client (useTranslations, useAnalytics) ne sont pas disponibles ici.

export default async function NotFound() {
  const t = await getTranslations("errors");

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
        <a
          href="/"
          className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
        >
          <Home className="h-4 w-4" />
          {t("notFound.home")}
        </a>
        <a
          href="/"
          className="inline-flex items-center gap-2 rounded-md border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          {t("notFound.back")}
        </a>
      </div>
    </div>
  );
}
