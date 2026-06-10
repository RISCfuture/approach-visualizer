import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  isSupportedLocale,
  type SupportedLocale,
} from './locales'

export const LOCALE_STORAGE_KEY = 'approach-visualizer.locale'

/**
 * Resolve a single browser language tag (e.g. `en-US`, `fr`, `de-AT`) to the
 * closest supported locale, or `null` if none matches. Tries an exact match
 * first, then falls back to the first supported locale sharing the same base
 * language (`fr-CA` -> `fr-FR`, `en-NZ` -> `en`).
 */
function resolveTag(tag: string): SupportedLocale | null {
  const normalized = tag.toLowerCase()

  const exact = SUPPORTED_LOCALES.find((locale) => locale.toLowerCase() === normalized)
  if (exact) return exact

  const base = normalized.split('-')[0]
  if (base === 'en') return DEFAULT_LOCALE
  const byBase = SUPPORTED_LOCALES.find((locale) => locale.toLowerCase().startsWith(`${base}-`))
  return byBase ?? null
}

/**
 * Determine the initial locale: a persisted user choice wins, otherwise the
 * first of the browser's preferred languages that maps to a supported locale,
 * otherwise {@link DEFAULT_LOCALE}.
 */
export function detectLocale(): SupportedLocale {
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY)
  if (stored && isSupportedLocale(stored)) return stored

  const preferred = navigator.languages.length ? navigator.languages : [navigator.language]
  for (const tag of preferred) {
    if (!tag) continue
    const resolved = resolveTag(tag)
    if (resolved) return resolved
  }

  return DEFAULT_LOCALE
}
