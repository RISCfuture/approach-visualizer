import { createI18n } from 'vue-i18n'
import en from './locales/en.json'
import { applyPrimeVueLocale } from './primevue'
import { detectLocale, LOCALE_STORAGE_KEY } from './detect'
import { DEFAULT_LOCALE, type SupportedLocale } from './locales'

/**
 * The base `en` catalog is bundled eagerly because it is always needed as the
 * fallback. Every other locale's messages are code-split and fetched on demand
 * by {@link setLocale}, so a first paint only ships the active locale plus `en`.
 *
 * The message schema is intentionally not pinned as a generic: a few lookups use
 * runtime-computed keys (e.g. `minima.${id}`), which strict key typing rejects.
 */
export const i18n = createI18n<false>({
  legacy: false,
  locale: DEFAULT_LOCALE,
  fallbackLocale: DEFAULT_LOCALE,
  messages: { en },
})

type LazyLocale = Exclude<SupportedLocale, 'en'>
interface LocaleModule {
  default: Record<string, unknown>
}

// Explicit per-locale loaders (rather than a templated dynamic import) so the
// eagerly-bundled `en` catalog isn't also pulled into a dynamic chunk.
const loaders: Record<LazyLocale, () => Promise<LocaleModule>> = {
  'en-CA': () => import('./locales/en-CA.json'),
  'en-AU': () => import('./locales/en-AU.json'),
  'en-GB': () => import('./locales/en-GB.json'),
  'fr-FR': () => import('./locales/fr-FR.json'),
  'de-DE': () => import('./locales/de-DE.json'),
}

const loaded = new Set<SupportedLocale>([DEFAULT_LOCALE])

async function loadMessages(locale: SupportedLocale): Promise<void> {
  if (loaded.has(locale)) return
  const { default: messages } = await loaders[locale as LazyLocale]()
  i18n.global.setLocaleMessage(locale, messages)
  loaded.add(locale)
}

/**
 * Activate a locale across the whole app: lazy-load its message catalog and
 * PrimeVue strings, switch vue-i18n, reflect the choice on `<html lang>` and
 * the document title, and persist it so the next visit restores it.
 */
export async function setLocale(locale: SupportedLocale): Promise<void> {
  await Promise.all([loadMessages(locale), applyPrimeVueLocale(locale)])
  i18n.global.locale.value = locale
  document.documentElement.setAttribute('lang', locale)
  document.title = i18n.global.t('app.title')
  localStorage.setItem(LOCALE_STORAGE_KEY, locale)
}

/** Resolve and apply the initial locale from storage / browser preferences. */
export function initLocale(): Promise<void> {
  return setLocale(detectLocale())
}
