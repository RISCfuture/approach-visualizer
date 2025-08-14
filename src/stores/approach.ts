import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ApproachSettings, ApproachMinimum, LightingType } from '@/types/approach'
import { APPROACH_MINIMA } from '@/types/approach'

export const useApproachStore = defineStore('approach', () => {
  const selectedMinimumId = ref<string>('cat-i')
  const customCeiling = ref<number | null>(null)
  const customVisibility = ref<number | null>(null)
  const customVisibilityUnit = ref<'SM' | 'RVR' | null>(null) // Track unit separately
  const lightingType = ref<LightingType>('ALSF-II')
  const approachSpeed = ref<number>(120)

  // Runway lighting components
  const showREIL = ref<boolean>(true)
  const showRCLS = ref<boolean>(true)
  const showEdgeLights = ref<boolean>(true)
  const showPAPI = ref<boolean>(true)

  // Runway markings
  const showThresholdMarkings = ref<boolean>(true)
  const showTouchdownZone = ref<boolean>(true)
  const showSideStripes = ref<boolean>(true)
  const showAimPoint = ref<boolean>(true)

  // Apply initial preset configuration
  function initializePresets() {
    applyLightingPreset(lightingType.value)
  }

  const selectedMinimum = computed((): ApproachMinimum | undefined => {
    return APPROACH_MINIMA.find((m) => m.id === selectedMinimumId.value)
  })

  const effectiveCeiling = computed((): number => {
    return customCeiling.value ?? selectedMinimum.value?.ceiling ?? 200
  })

  const effectiveVisibility = computed((): number => {
    return customVisibility.value ?? selectedMinimum.value?.visibility ?? 2400
  })

  const visibilityUnit = computed((): 'SM' | 'RVR' => {
    // Use custom unit if set, otherwise use minimum's unit
    return customVisibilityUnit.value ?? selectedMinimum.value?.visibilityUnit ?? 'RVR'
  })

  const isPrecisionApproach = computed((): boolean => {
    // ALSF-I, ALSF-II, and MALSR are used for precision approaches
    return ['ALSF-II', 'ALSF-I', 'MALSR'].includes(lightingType.value)
  })

  const settings = computed(
    (): ApproachSettings => ({
      minimumId: selectedMinimumId.value,
      customCeiling: effectiveCeiling.value,
      customVisibility: effectiveVisibility.value,
      visibilityUnit: visibilityUnit.value,
      lightingType: lightingType.value,
      approachSpeed: approachSpeed.value,
      showREIL: showREIL.value,
      showRCLS: showRCLS.value,
      showEdgeLights: showEdgeLights.value,
      showPAPI: showPAPI.value,
      showThresholdMarkings: showThresholdMarkings.value,
      showTouchdownZone: showTouchdownZone.value,
      showSideStripes: showSideStripes.value,
      showAimPoint: showAimPoint.value,
    }),
  )

  function selectMinimum(minimumId: string) {
    selectedMinimumId.value = minimumId
    // Reset custom values to use preset values
    customCeiling.value = null
    customVisibility.value = null
    customVisibilityUnit.value = null
  }

  function setCustomCeiling(ceiling: number | null) {
    customCeiling.value = ceiling
  }

  function setCustomVisibility(visibility: number | null) {
    customVisibility.value = visibility
  }

  function setVisibilityUnit(unit: 'RVR' | 'SM') {
    customVisibilityUnit.value = unit
  }

  function setLightingType(type: LightingType) {
    lightingType.value = type
    // Apply preset configuration based on lighting type
    applyLightingPreset(type)
  }

  function applyLightingPreset(type: LightingType) {
    // Configure lighting and markings based on preset
    switch (type) {
      case 'ALSF-II':
      case 'ALSF-I':
        // Full precision approach configuration
        showREIL.value = false // ALSF systems have their own runway identification
        showRCLS.value = true
        showEdgeLights.value = true
        showPAPI.value = true
        showThresholdMarkings.value = true
        showTouchdownZone.value = true
        showSideStripes.value = true
        showAimPoint.value = true
        break
      case 'MALSR':
        // Precision approach with medium intensity
        showREIL.value = true
        showRCLS.value = false // MALSR typically doesn't have RCLS
        showEdgeLights.value = true
        showPAPI.value = true
        showThresholdMarkings.value = true
        showTouchdownZone.value = true
        showSideStripes.value = true
        showAimPoint.value = true
        break
      case 'SSALR':
      case 'MALS':
      case 'MALSF':
        // Non-precision approach lighting
        showREIL.value = true
        showRCLS.value = false
        showEdgeLights.value = true
        showPAPI.value = true
        showThresholdMarkings.value = true
        showTouchdownZone.value = false
        showSideStripes.value = false
        showAimPoint.value = false
        break
      case 'ODALS':
        // Basic omnidirectional approach lighting
        showREIL.value = false // ODALS includes its own threshold side lights
        showRCLS.value = false
        showEdgeLights.value = true
        showPAPI.value = false
        showThresholdMarkings.value = true
        showTouchdownZone.value = false
        showSideStripes.value = false
        showAimPoint.value = false
        break
      case 'None':
        // No approach lighting
        showREIL.value = false
        showRCLS.value = false
        showEdgeLights.value = false
        showPAPI.value = false
        showThresholdMarkings.value = true // Always show threshold
        showTouchdownZone.value = false
        showSideStripes.value = false
        showAimPoint.value = false
        break
    }
  }

  function setApproachSpeed(speed: number) {
    approachSpeed.value = Math.max(50, Math.min(200, speed))
  }

  // Setters for individual lighting components
  function setShowREIL(show: boolean) {
    showREIL.value = show
  }

  function setShowRCLS(show: boolean) {
    showRCLS.value = show
  }

  function setShowEdgeLights(show: boolean) {
    showEdgeLights.value = show
  }

  function setShowPAPI(show: boolean) {
    showPAPI.value = show
  }

  // Setters for runway markings
  function setShowThresholdMarkings(show: boolean) {
    showThresholdMarkings.value = show
  }

  function setShowTouchdownZone(show: boolean) {
    showTouchdownZone.value = show
  }

  function setShowSideStripes(show: boolean) {
    showSideStripes.value = show
  }

  function setShowAimPoint(show: boolean) {
    showAimPoint.value = show
  }

  // Initialize with default presets
  initializePresets()

  return {
    selectedMinimumId,
    selectedMinimum,
    effectiveCeiling,
    effectiveVisibility,
    visibilityUnit,
    lightingType,
    approachSpeed,
    isPrecisionApproach,
    showREIL,
    showRCLS,
    showEdgeLights,
    showPAPI,
    showThresholdMarkings,
    showTouchdownZone,
    showSideStripes,
    showAimPoint,
    settings,
    selectMinimum,
    setCustomCeiling,
    setCustomVisibility,
    setVisibilityUnit,
    setLightingType,
    setApproachSpeed,
    setShowREIL,
    setShowRCLS,
    setShowEdgeLights,
    setShowPAPI,
    setShowThresholdMarkings,
    setShowTouchdownZone,
    setShowSideStripes,
    setShowAimPoint,
  }
})
