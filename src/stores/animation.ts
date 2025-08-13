import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { AnimationState } from '@/types/approach'
import {
  calculateGlidepathAltitude,
  knotsToMetersPerSecond,
  GLIDESLOPE_ANGLE,
  FEET_PER_NM,
  TOUCHDOWN_ZONE_DISTANCE_FT,
} from '@/types/approach'
import { useApproachStore } from './approach'

export const useAnimationStore = defineStore('animation', () => {
  const isPlaying = ref(false)
  const isPaused = ref(false)
  const currentDistanceNm = ref(0) // Initialize to 0, will be set by watcher
  const hasBrokenOut = ref(false)
  const animationStartTime = ref<number | null>(null)
  const pausedTime = ref<number | null>(null)

  const approachStore = useApproachStore()

  // Calculate starting distance to achieve cloud breakout ~3 seconds into animation
  // Distance is measured from touchdown zone, not threshold
  const startingDistanceNm = computed((): number => {
    const ceiling = approachStore.effectiveCeiling
    const angleRadians = (GLIDESLOPE_ANGLE * Math.PI) / 180
    const speedKnots = approachStore.approachSpeed

    // Calculate distance to ceiling altitude
    const distanceToTDZAtCeiling = ceiling / (Math.tan(angleRadians) * FEET_PER_NM)
    const distanceFromThresholdAtCeiling =
      distanceToTDZAtCeiling + TOUCHDOWN_ZONE_DISTANCE_FT / FEET_PER_NM

    // Calculate how far we travel in 3 seconds at current speed
    const speedNmPerSecond = speedKnots / 3600 // knots to nm/second
    const distanceIn3Seconds = speedNmPerSecond * 3

    // Starting distance = ceiling distance + 3 seconds of travel
    const calculatedStart = distanceFromThresholdAtCeiling + distanceIn3Seconds

    // Ensure we start at least 50ft above ceiling (safety margin)
    const minAltitudeAboveCeiling = 50
    const minDistanceToTDZ =
      (ceiling + minAltitudeAboveCeiling) / (Math.tan(angleRadians) * FEET_PER_NM)
    const minDistance = minDistanceToTDZ + TOUCHDOWN_ZONE_DISTANCE_FT / FEET_PER_NM

    // Return the larger of calculated start or minimum distance
    return Math.max(calculatedStart, minDistance)
  })

  const currentAltitude = computed((): number => {
    // Check if this is a non-precision or circling approach
    const isNonPrecision =
      approachStore.selectedMinimumId === 'non-precision' ||
      approachStore.selectedMinimumId === 'circling'

    // Calculate altitude based on distance to touchdown zone
    const distanceToTDZ = Math.max(
      0,
      currentDistanceNm.value - TOUCHDOWN_ZONE_DISTANCE_FT / FEET_PER_NM,
    )
    const calculatedAltitude = calculateGlidepathAltitude(distanceToTDZ)

    // For non-precision approaches, level off at MDA (ceiling)
    if (isNonPrecision && calculatedAltitude < approachStore.effectiveCeiling) {
      return approachStore.effectiveCeiling
    }

    return calculatedAltitude
  })

  const progress = computed((): number => {
    const totalDistance = startingDistanceNm.value
    const distanceTraveled = startingDistanceNm.value - currentDistanceNm.value
    return Math.max(0, Math.min(100, (distanceTraveled / totalDistance) * 100))
  })

  const isAboveDecisionHeight = computed((): boolean => {
    return currentAltitude.value > approachStore.effectiveCeiling
  })

  // Initialize currentDistanceNm to match startingDistanceNm when it changes
  watch(
    startingDistanceNm,
    (newValue) => {
      if (!isPlaying.value) {
        currentDistanceNm.value = newValue
      }
    },
    { immediate: true },
  )

  const state = computed(
    (): AnimationState => ({
      isPlaying: isPlaying.value,
      currentDistance: currentDistanceNm.value,
      currentAltitude: currentAltitude.value,
      hasBrokenOut: hasBrokenOut.value,
      progress: progress.value,
    }),
  )

  function play() {
    if (!isPlaying.value) {
      reset()
      isPlaying.value = true
      isPaused.value = false
      animationStartTime.value = Date.now()
    } else if (isPaused.value) {
      isPaused.value = false
      if (pausedTime.value && animationStartTime.value) {
        const pauseDuration = Date.now() - pausedTime.value
        animationStartTime.value += pauseDuration
      }
      pausedTime.value = null
    }
  }

  function pause() {
    if (isPlaying.value && !isPaused.value) {
      isPaused.value = true
      pausedTime.value = Date.now()
    }
  }

  function stop() {
    isPlaying.value = false
    isPaused.value = false
    animationStartTime.value = null
    pausedTime.value = null
  }

  function reset() {
    stop()
    currentDistanceNm.value = startingDistanceNm.value
    hasBrokenOut.value = false
  }

  function updatePosition(deltaTime: number) {
    if (!isPlaying.value || isPaused.value) return

    // Check for test mode - speed up animation by 10x for faster CI tests
    const testMode = new URLSearchParams(window.location.search).has('testMode')
    const speedMultiplier = testMode ? 10 : 1

    const speedMs = knotsToMetersPerSecond(approachStore.approachSpeed)
    const speedNmPerMs = speedMs / 1852 / 1000
    const distanceChange = speedNmPerMs * deltaTime * speedMultiplier

    currentDistanceNm.value = Math.max(0, currentDistanceNm.value - distanceChange)

    // Check if we've broken out of clouds (at exact ceiling altitude)
    if (!hasBrokenOut.value && currentAltitude.value <= approachStore.effectiveCeiling) {
      hasBrokenOut.value = true
      // Breakout timing could be logged here for debugging if needed
    }

    // Continue to 10 ft above touchdown zone
    const minAltitude = 10
    const minDistanceToTDZ =
      minAltitude / (Math.tan((GLIDESLOPE_ANGLE * Math.PI) / 180) * FEET_PER_NM)
    const minDistanceToThreshold = minDistanceToTDZ + TOUCHDOWN_ZONE_DISTANCE_FT / FEET_PER_NM

    if (currentDistanceNm.value <= minDistanceToThreshold) {
      currentDistanceNm.value = minDistanceToThreshold
      stop()
    }
  }

  function setDistance(distance: number) {
    // Stop animation when manually setting position
    if (isPlaying.value && !isPaused.value) {
      stop()
    }

    // Calculate min distance (10 ft altitude)
    const minAltitude = 10
    const minDistanceToTDZ =
      minAltitude / (Math.tan((GLIDESLOPE_ANGLE * Math.PI) / 180) * FEET_PER_NM)
    const minDistanceToThreshold = minDistanceToTDZ + TOUCHDOWN_ZONE_DISTANCE_FT / FEET_PER_NM

    currentDistanceNm.value = Math.max(
      minDistanceToThreshold,
      Math.min(startingDistanceNm.value, distance),
    )
  }

  return {
    isPlaying,
    isPaused,
    currentDistanceNm,
    currentAltitude,
    hasBrokenOut,
    progress,
    isAboveDecisionHeight,
    startingDistanceNm,
    state,
    play,
    pause,
    stop,
    reset,
    updatePosition,
    setDistance,
  }
})
