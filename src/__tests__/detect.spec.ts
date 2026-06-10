import { describe, it, expect, beforeEach, vi } from 'vitest'
import { detectLocale, LOCALE_STORAGE_KEY } from '@/i18n/detect'

function setBrowserLanguages(languages: string[]) {
  Object.defineProperty(navigator, 'languages', { value: languages, configurable: true })
  Object.defineProperty(navigator, 'language', { value: languages[0] ?? '', configurable: true })
}

describe('detectLocale', () => {
  beforeEach(() => {
    vi.spyOn(localStorage, 'getItem').mockReturnValue(null)
  })

  it('prefers a valid persisted choice over browser preferences', () => {
    vi.spyOn(localStorage, 'getItem').mockImplementation((key) =>
      key === LOCALE_STORAGE_KEY ? 'fr-FR' : null,
    )
    setBrowserLanguages(['de-DE'])
    expect(detectLocale()).toBe('fr-FR')
  })

  it('ignores an unsupported persisted value and falls back to the browser', () => {
    vi.spyOn(localStorage, 'getItem').mockReturnValue('es-ES')
    setBrowserLanguages(['de-DE'])
    expect(detectLocale()).toBe('de-DE')
  })

  it('matches an exact supported browser locale', () => {
    setBrowserLanguages(['de-DE', 'en-US'])
    expect(detectLocale()).toBe('de-DE')
  })

  it('maps a base language to a supported regional locale', () => {
    setBrowserLanguages(['fr'])
    expect(detectLocale()).toBe('fr-FR')
  })

  it('collapses any English variant to the base en catalog', () => {
    setBrowserLanguages(['en-NZ'])
    expect(detectLocale()).toBe('en')
  })

  it('falls back to en when no preference is supported', () => {
    setBrowserLanguages(['es-ES', 'ja-JP'])
    expect(detectLocale()).toBe('en')
  })
})
