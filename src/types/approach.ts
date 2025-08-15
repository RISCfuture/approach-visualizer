export interface ApproachMinimum {
  id: string
  label: string
  ceiling: number
  visibility: number
  visibilityUnit: 'SM' | 'RVR'
}

export interface ApproachSettings {
  minimumId: string
  customCeiling: number
  customVisibility: number
  visibilityUnit: 'SM' | 'RVR'
  lightingType: LightingType
  approachSpeed: number
  showREIL: boolean
  showRCLS: boolean
  showEdgeLights: boolean
  showPAPI: boolean
  showThresholdMarkings: boolean
  showTouchdownZone: boolean
  showSideStripes: boolean
  showAimPoint: boolean
}

export type LightingType =
  | 'ALSF-II'
  | 'ALSF-I'
  | 'MALSR'
  | 'SSALR'
  | 'MALS'
  | 'MALSF'
  | 'ODALS'
  | 'None'

export interface AnimationState {
  isPlaying: boolean
  currentDistance: number
  currentAltitude: number
  hasBrokenOut: boolean
  progress: number
}

export const APPROACH_MINIMA: ApproachMinimum[] = [
  {
    id: 'cat-i',
    label: 'ILS CAT I',
    ceiling: 200,
    visibility: 2400,
    visibilityUnit: 'RVR',
  },
  {
    id: 'cat-ii',
    label: 'ILS CAT II',
    ceiling: 100,
    visibility: 1200,
    visibilityUnit: 'RVR',
  },
  {
    id: 'cat-iiia',
    label: 'ILS CAT IIIa',
    ceiling: 50,
    visibility: 600,
    visibilityUnit: 'RVR',
  },
  {
    id: 'cat-iiib',
    label: 'ILS CAT IIIb',
    ceiling: 50,
    visibility: 300,
    visibilityUnit: 'RVR',
  },
  {
    id: 'non-precision',
    label: 'Non-Precision',
    ceiling: 400,
    visibility: 0.5,
    visibilityUnit: 'SM',
  },
  {
    id: 'circling',
    label: 'Circling',
    ceiling: 600,
    visibility: 2,
    visibilityUnit: 'SM',
  },
]

export const LIGHTING_TYPES: { value: LightingType; label: string }[] = [
  { value: 'ALSF-II', label: 'ALSF-II (CAT II/III)' },
  { value: 'ALSF-I', label: 'ALSF-I (CAT I)' },
  { value: 'MALSR', label: 'MALSR (CAT I)' },
  { value: 'SSALR', label: 'SSALR' },
  { value: 'MALS', label: 'MALS' },
  { value: 'MALSF', label: 'MALSF' },
  { value: 'ODALS', label: 'ODALS' },
  { value: 'None', label: 'None' },
]

export const GLIDESLOPE_ANGLE = 3
export const FAF_DISTANCE_NM = 5
export const RUNWAY_LENGTH_FT = 10000
export const RUNWAY_WIDTH_FT = 150
export const FEET_PER_NM = 6076.12
export const TOUCHDOWN_ZONE_DISTANCE_FT = 1000 // 1000 ft past threshold

export function rvrToStatuteMiles(rvr: number): number {
  return rvr / 5280
}

export function statuteMilesToMeters(sm: number): number {
  return sm * 1609.344
}

export function feetToMeters(feet: number): number {
  return feet * 0.3048
}

export function knotsToMetersPerSecond(knots: number): number {
  return knots * 0.514444
}

export function calculateGlidepathAltitude(distanceNm: number): number {
  const angleRadians = (GLIDESLOPE_ANGLE * Math.PI) / 180
  return Math.tan(angleRadians) * distanceNm * FEET_PER_NM
}
