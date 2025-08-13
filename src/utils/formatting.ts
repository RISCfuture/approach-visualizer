// Number formatting utilities using Intl.NumberFormat

const locale = 'en-US'

// Formatters for different units
const formatters = {
  feet: new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: 'foot',
    unitDisplay: 'short',
    maximumFractionDigits: 0,
  }),

  nauticalMiles: new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }),

  statuteMiles: new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }),

  rvr: new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
  }),

  knots: new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
  }),

  plain: new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
  }),

  decimal: new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }),
}

export function formatFeet(value: number): string {
  return formatters.feet.format(value)
}

export function formatNauticalMiles(value: number): string {
  return `${formatters.nauticalMiles.format(value)} NM`
}

export function formatStatuteMiles(value: number): string {
  return `${formatters.statuteMiles.format(value)} SM`
}

export function formatRVR(value: number): string {
  return `${formatters.rvr.format(value)} RVR`
}

export function formatKnots(value: number): string {
  return `${formatters.knots.format(value)} kt`
}

export function formatPlain(value: number): string {
  return formatters.plain.format(value)
}

export function formatDecimal(value: number): string {
  return formatters.decimal.format(value)
}

// Format altitude with appropriate units
export function formatAltitude(value: number): string {
  return formatFeet(value)
}

// Format distance based on value magnitude
export function formatDistance(value: number, unit: 'NM' | 'ft' = 'NM'): string {
  if (unit === 'ft') {
    return formatFeet(value)
  }
  return formatNauticalMiles(value)
}

// Format visibility based on unit
export function formatVisibility(value: number, unit: 'RVR' | 'SM'): string {
  if (unit === 'RVR') {
    return formatRVR(value)
  }
  return formatStatuteMiles(value)
}
