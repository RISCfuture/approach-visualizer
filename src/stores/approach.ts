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

  const settings = computed(
    (): ApproachSettings => ({
      minimumId: selectedMinimumId.value,
      customCeiling: effectiveCeiling.value,
      customVisibility: effectiveVisibility.value,
      visibilityUnit: visibilityUnit.value,
      lightingType: lightingType.value,
      approachSpeed: approachSpeed.value,
    }),
  )

  function selectMinimum(minimumId: string) {
    selectedMinimumId.value = minimumId
    customCeiling.value = null
    customVisibility.value = null
    customVisibilityUnit.value = null // Reset custom unit
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
  }

  function setApproachSpeed(speed: number) {
    approachSpeed.value = Math.max(50, Math.min(200, speed))
  }

  return {
    selectedMinimumId,
    selectedMinimum,
    effectiveCeiling,
    effectiveVisibility,
    visibilityUnit,
    lightingType,
    approachSpeed,
    settings,
    selectMinimum,
    setCustomCeiling,
    setCustomVisibility,
    setVisibilityUnit,
    setLightingType,
    setApproachSpeed,
  }
})
