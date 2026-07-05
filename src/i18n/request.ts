import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { routing, type AppLocale } from "./routing";

/**
 * Locale resolution for next-intl in a cookie-based setup (no URL prefix).
 *
 * Order:
 *   1. `NEXT_LOCALE` cookie (set by the LanguageToggle button)
 *   2. Fallback to `routing.defaultLocale`
 *
 * No middleware is required because we are NOT using locale prefixes in the URL —
 * the only visible route remains `/`, which preserves the PostHog session.
 */
export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get("NEXT_LOCALE")?.value as
    | AppLocale
    | undefined;

  const locale: AppLocale =
    cookieLocale && routing.locales.includes(cookieLocale)
      ? cookieLocale
      : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
