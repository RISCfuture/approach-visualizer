import { reactive } from 'vue'
import { defaultOptions } from 'primevue/config'
import type { SupportedLocale } from '../locales'

/**
 * PrimeVue's built-in component strings (aria labels, empty/selection
 * messages, etc.) are configured through a single reactive locale object. We
 * seed it with PrimeVue's English defaults and layer per-language overrides so
 * third-party component chrome is localized alongside our own strings.
 *
 * `fr-FR` / `de-DE` ship complete locale objects (see the sibling files); the
 * English-variant locales reuse PrimeVue's English defaults unchanged.
 */
type PrimeVueLocale = Record<string, unknown>

// PrimeVue types its locale as a fixed interface; we treat it as an open record
// so we can clone/merge arbitrary language overrides over the English defaults.
const ENGLISH = (defaultOptions.locale ?? {}) as unknown as PrimeVueLocale

/** The live object handed to `app.use(PrimeVue, { locale: primeVueLocale })`. */
export const primeVueLocale = reactive<PrimeVueLocale>(structuredClone(ENGLISH))

const loaders: Partial<Record<SupportedLocale, () => Promise<{ default: PrimeVueLocale }>>> = {
  'fr-FR': () => import('./fr-FR'),
  'de-DE': () => import('./de-DE'),
}

const cache = new Map<SupportedLocale, PrimeVueLocale>()

/** Swap PrimeVue's active locale, lazily loading non-English overrides on demand. */
export async function applyPrimeVueLocale(locale: SupportedLocale): Promise<void> {
  const loader = loaders[locale]
  let override: PrimeVueLocale = {}
  if (loader) {
    if (!cache.has(locale)) {
      const mod = await loader()
      cache.set(locale, mod.default)
    }
    override = cache.get(locale) ?? {}
  }

  // English is spread first so switching back to an English variant restores
  // every default key; overrides only ever translate existing keys, so no
  // stale keys can linger and nothing needs deleting.
  Object.assign(primeVueLocale, structuredClone(ENGLISH), override)
}
