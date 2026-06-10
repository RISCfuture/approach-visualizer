import { describe, it, expect, afterEach } from 'vitest'
import { i18n } from '@/i18n'
import { formatFeet, formatNauticalMiles } from '@/utils/formatting'

// formatFeet/formatNauticalMiles read the active i18n locale. These tests pin
// the localization contract for this app: digit grouping follows the locale,
// the aviation units (ft / NM) are kept, and values are never converted.
function withLocale(locale: 'en' | 'de-DE') {
  i18n.global.locale.value = locale
}

describe('locale-aware formatting', () => {
  afterEach(() => {
    i18n.global.locale.value = 'en'
  })

  it('groups thousands per locale while keeping the foot unit', () => {
    withLocale('en')
    expect(formatFeet(1200)).toBe('1,200 ft')
    withLocale('de-DE')
    expect(formatFeet(1200)).toBe('1.200 ft')
  })

  it('keeps the NM symbol and localizes the decimal separator without converting', () => {
    withLocale('en')
    expect(formatNauticalMiles(5)).toBe('5.0 NM')
    withLocale('de-DE')
    expect(formatNauticalMiles(5)).toBe('5,0 NM')
  })
})
