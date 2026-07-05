"use client";

import { Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { routing, type AppLocale } from "@/i18n/routing";

const COOKIE_NAME = "NEXT_LOCALE";
// 1 year
const MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Cookie-based language toggle.
 *
 * On click: writes the next locale into the `NEXT_LOCALE` cookie then calls
 * `router.refresh()`. This triggers a soft server re-render (next-intl
 * `request.ts` reads the cookie and serves the new message bundle), WITHOUT
 * a full page reload — so PostHog state and the WebSocket connection survive.
 */
export function LanguageToggle() {
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const t = useTranslations("common");

  const nextLocale: AppLocale = locale === "fr" ? "en" : "fr";
  const nextLabel = nextLocale === "fr" ? "Français" : "English";

  const handleToggle = useCallback(() => {
    if (typeof document !== "undefined") {
      document.cookie = `${COOKIE_NAME}=${nextLocale};path=/;max-age=${MAX_AGE};samesite=lax`;
    }
    router.refresh();
  }, [nextLocale, router]);

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleToggle}
      aria-label={t("languageToggle", { locale: nextLabel })}
      title={t("languageToggle", { locale: nextLabel })}
      className="gap-1.5 px-2"
    >
      <Languages className="h-4 w-4" />
      <span className="text-xs font-semibold uppercase tracking-wide">
        {locale === "fr" ? "FR" : "EN"}
      </span>
    </Button>
  );
}
