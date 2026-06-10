// Locale-aware number formatting. Aviation uses feet and nautical miles
// worldwide, so units are never converted — only digit grouping and the
// localized unit symbol follow the active locale (e.g. de-DE "1.000 ft").
//
// `ft` is rendered by Intl's `unit` style (it supports `foot`). Intl has no
// `knot` or `nautical-mile` unit, so the `NM` symbol comes from the i18n
// catalog (`units.nm`) instead.

import { i18n } from '@/i18n'

function activeLocale(): string {
  return i18n.global.locale.value
}

const feetFormatters = new Map<string, Intl.NumberFormat>()
const nauticalMileFormatters = new Map<string, Intl.NumberFormat>()

function feetFormatter(locale: string): Intl.NumberFormat {
  let formatter = feetFormatters.get(locale)
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      style: 'unit',
      unit: 'foot',
      unitDisplay: 'short',
      maximumFractionDigits: 0,
    })
    feetFormatters.set(locale, formatter)
  }
  return formatter
}

// Intl has no nautical-mile unit, so the number is grouped per-locale and the
// "NM" symbol is appended by hand.
function nauticalMileFormatter(locale: string): Intl.NumberFormat {
  let formatter = nauticalMileFormatters.get(locale)
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })
    nauticalMileFormatters.set(locale, formatter)
  }
  return formatter
}

export function formatFeet(value: number): string {
  return feetFormatter(activeLocale()).format(value)
}

export function formatNauticalMiles(value: number): string {
  // Intl has no nautical-mile unit, so the number↔symbol layout lives in the
  // catalog (`units.nauticalMiles`) rather than being assembled here.
  return i18n.global.t('units.nauticalMiles', {
    value: nauticalMileFormatter(activeLocale()).format(value),
  })
}

// Format altitude with appropriate units
export function formatAltitude(value: number): string {
  return formatFeet(value)
}
