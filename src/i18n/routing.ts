import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  // All locales that are supported
  locales: ["fr", "en"],
  // Used when no locale matches
  defaultLocale: "fr",
  // No locale prefix in the URL — locale is driven by the `NEXT_LOCALE` cookie
  // (see src/i18n/request.ts). This keeps `/` as the single visible route.
  localePrefix: "never",
});

export type AppLocale = (typeof routing.locales)[number];
