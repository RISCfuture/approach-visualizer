/**
 * Supported UI locales. `en` is the base catalog; the `en-*` variants are
 * delta-only files that fall back to `en`, and `fr-FR` / `de-DE` are full
 * translations. Keep this list, the catalog files in `./locales/`, and the
 * PrimeVue locale registry in `./primevue/` in sync.
 */
export const SUPPORTED_LOCALES = ['en', 'en-CA', 'en-AU', 'en-GB', 'fr-FR', 'de-DE'] as const

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]

/** The locale used when no browser preference matches and as the fallback chain root. */
export const DEFAULT_LOCALE: SupportedLocale = 'en'

function autonym(locale: SupportedLocale): string {
  const displayNames = new Intl.DisplayNames([locale], {
    type: 'language',
    languageDisplay: 'standard',
  })
  const name = displayNames.of(locale)
  if (!name) return locale
  return name.charAt(0).toLocaleUpperCase(locale) + name.slice(1)
}

/**
 * The selectable options for the locale switcher menu, each labelled with its
 * own autonym (e.g. `Français (France)`, `Deutsch (Deutschland)`).
 */
export function localeOptions(): { value: SupportedLocale; label: string }[] {
  return SUPPORTED_LOCALES.map((locale) => ({ value: locale, label: autonym(locale) }))
}

/** Type guard narrowing an arbitrary string to a supported locale. */
export function isSupportedLocale(value: string): value is SupportedLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value)
}
