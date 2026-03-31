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
}

export function formatFeet(value: number): string {
  return formatters.feet.format(value)
}

export function formatNauticalMiles(value: number): string {
  return `${formatters.nauticalMiles.format(value)} NM`
}

// Format altitude with appropriate units
export function formatAltitude(value: number): string {
  return formatFeet(value)
}
