import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { routing, type AppLocale } from "./routing";

/**
 * Locale resolution for next-intl in a cookie-based setup (no URL prefix).
 *
 * Ordre :
 *  1 `NEXT_LOCALE` cookie (set by the LanguageToggle button)
 *  2 `requestLocale` passed by next-intl (carry useful for system routes
 *     like `/_not-found` that are prerendered without a real request)
 *  3 Fallback to `routing.defaultLocale`
 *
 * This config MUST never throw nor return `undefined` messages during static
 * prerendering: `cookies()` throws outside of a request scope (e.g. `/_not-found`),
 * so we guard it. The dynamic JSON import is also guarded and falls back to the
 * default locale, then to an empty object.
 *
 * No middleware is required because we are NOT using locale prefixes in the URL —
 * the only visible route remains `/`, which preserves the PostHog session.
 */
export default getRequestConfig(
  async ({ locale: requestLocale }: { locale?: string }) => {
    const validate = (l: string | undefined): l is AppLocale =>
      !!l && routing.locales.includes(l as AppLocale);

    // 1. Locale fournie par next-intl (SSR / prerender), 2. cookie, 3. défault.
    let locale: AppLocale = validate(requestLocale)
      ? (requestLocale as AppLocale)
      : routing.defaultLocale;

    try {
      const cookieStore = await cookies();
      const cookieLocale = cookieStore.get("NEXT_LOCALE")?.value as
        | AppLocale
        | undefined;
      if (validate(cookieLocale)) locale = cookieLocale;
    } catch {
      // Hors d'une requete (prerender statique / build) : cookies() Throw.
      // On garde la locale resolue (requestLocale || defaultLocale).
    }

    let messages: Record<string, unknown> = {};
    try {
      messages = (await import(`../messages/${locale}.json`)).default ?? {};
    } catch {
      // Fichier de traduction absent : on retente avec la locale par défaut,
      // puis avec un objet vide plutot que de planter le prerender.
      try {
        messages =
          (await import(`../messages/${routing.defaultLocale}.json`)).default ?? {};
      } catch {
        messages = {};
      }
    }

    return { locale, messages };
  }
);
