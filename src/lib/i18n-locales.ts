/**
 * Helpers i18n partagés — mapping entre locales applicatives (next-intl)
 * et tags BCP-47 utilisés par `Intl.DateTimeFormat` / `Date.toLocaleDateString`.
 *
 * Centralise la logique auparavant dupliquée dans les composants tennis
 * (cf. ancienne `DATE_LOCALE` locale à `match-detail-dialog.tsx`).
 *
 * Pour ajouter une langue : étendre `DATE_LOCALE` et `getLocaleTag`.
 */

/**
 * Locale par défaut (fallback) si la locale courante n'est pas mappée.
 * Conserve la compatibilité ascendante (valeur historiquement attendue).
 */
export const DEFAULT_DATE_LOCALE_TAG = "fr-FR";

/**
 * Map locale next-intl ("fr" | "en") → tag BCP-47 pour Intl.
 * `en: "en-GB"` (et non "en-US") pour préserver le formatage anglais
 * historique (ex. "20 Jul 2026") déjà rendu par match-detail-dialog.
 */
export const DATE_LOCALE: Readonly<Record<string, string>> = {
  fr: "fr-FR",
  en: "en-GB",
};

/**
 * Retourne le tag BCP-47 à passer à `Intl.DateTimeFormat` / `toLocaleDateString`
 * pour une locale next-intl donnée. Fallback sûr vers `DEFAULT_DATE_LOCALE_TAG`.
 *
 * @example
 *   const locale = useLocale();              // "en"
 *   const tag = getDateLocaleTag(locale);    // "en-GB"
 *   new Intl.DateTimeFormat(tag, { ... }).format(date);
 */
export function getDateLocaleTag(locale: string | undefined): string {
  if (locale && DATE_LOCALE[locale]) return DATE_LOCALE[locale];
  return DEFAULT_DATE_LOCALE_TAG;
}
