<script setup lang="ts">
import { computed, watch, onMounted, onUnmounted } from 'vue'
import Select from 'primevue/select'
import InputNumber from 'primevue/inputnumber'
import Button from 'primevue/button'
import Slider from 'primevue/slider'
import { useApproachStore } from '@/stores/approach'
import { useAnimationStore } from '@/stores/animation'
import { APPROACH_MINIMA, LIGHTING_TYPES } from '@/types/approach'

const VISIBILITY_OPTIONS = [
  { label: '300 RVR', value: 300, unit: 'RVR' },
  { label: '600 RVR', value: 600, unit: 'RVR' },
  { label: '1200 RVR', value: 1200, unit: 'RVR' },
  { label: '1800 RVR', value: 1800, unit: 'RVR' },
  { label: '2400 RVR', value: 2400, unit: 'RVR' },
  { label: '½ SM', value: 0.5, unit: 'SM' },
  { label: '1 SM', value: 1, unit: 'SM' },
  { label: '2 SM', value: 2, unit: 'SM' },
  { label: '5 SM', value: 5, unit: 'SM' },
]

const approachStore = useApproachStore()
const animationStore = useAnimationStore()

const selectedMinimum = computed({
  get: () => approachStore.selectedMinimumId,
  set: (value) => {
    approachStore.selectMinimum(value)
    animationStore.reset()
    animationStore.play()
  },
})

const customCeiling = computed({
  get: () => approachStore.effectiveCeiling,
  set: (value) => approachStore.setCustomCeiling(value),
})

const customVisibility = computed({
  get: () => {
    const currentValue = approachStore.effectiveVisibility
    const currentUnit = approachStore.visibilityUnit
    // Find matching option
    return (
      VISIBILITY_OPTIONS.find((opt) => opt.value === currentValue && opt.unit === currentUnit) ||
      VISIBILITY_OPTIONS[3]
    ) // Default to 2400 RVR
  },
  set: (option) => {
    if (option) {
      // Switch unit if needed
      if (option.unit !== approachStore.visibilityUnit) {
        approachStore.setVisibilityUnit(option.unit as 'RVR' | 'SM')
      }
      approachStore.setCustomVisibility(option.value)
    }
  },
})

const lightingType = computed({
  get: () => approachStore.lightingType,
  set: (value) => approachStore.setLightingType(value),
})

const approachSpeed = computed({
  get: () => approachStore.approachSpeed,
  set: (value) => approachStore.setApproachSpeed(value),
})

const playButtonLabel = computed(() => {
  if (!animationStore.isPlaying) return 'Play'
  if (animationStore.isPaused) return 'Resume'
  return 'Pause'
})

const playButtonIcon = computed(() => {
  if (!animationStore.isPlaying) return 'pi pi-play'
  if (animationStore.isPaused) return 'pi pi-play'
  return 'pi pi-pause'
})

function handlePlayClick() {
  if (!animationStore.isPlaying) {
    animationStore.play()
  } else if (animationStore.isPaused) {
    animationStore.play()
  } else {
    animationStore.pause()
  }
}

function handleReset() {
  animationStore.reset()
}

const positionSlider = computed({
  get: () => {
    // Convert current distance to percentage (0 = start, 100 = end)
    const totalDistance =
      animationStore.startingDistanceNm -
      (10 / (Math.tan((3 * Math.PI) / 180) * 6076) + 1000 / 6076)
    const distanceTraveled = animationStore.startingDistanceNm - animationStore.currentDistanceNm
    return Math.max(0, Math.min(100, (distanceTraveled / totalDistance) * 100))
  },
  set: (value) => {
    // Convert percentage to distance and set it
    const endDistanceNm = 10 / (Math.tan((3 * Math.PI) / 180) * 6076) + 1000 / 6076
    const totalDistance = animationStore.startingDistanceNm - endDistanceNm
    const targetDistance = animationStore.startingDistanceNm - (totalDistance * value) / 100
    animationStore.setDistance(targetDistance)
  },
})

// Calculate slant distances for slider labels
const startSlantDistance = computed(() => {
  // Starting position: 200 ft above ceiling
  const startAltitude = approachStore.effectiveCeiling + 200
  const startDistanceNm = animationStore.startingDistanceNm
  const startDistanceFt = startDistanceNm * 6076
  const slantNm = Math.sqrt(Math.pow(startAltitude, 2) + Math.pow(startDistanceFt, 2)) / 6076
  return slantNm.toFixed(1) // Return in NM with 1 decimal
})

const endSlantDistance = computed(() => {
  // End position: 10 ft above runway
  const endAltitude = 10
  const endDistanceNm = 10 / (Math.tan((3 * Math.PI) / 180) * 6076) + 1000 / 6076
  const endDistanceFt = endDistanceNm * 6076
  const slantFt = Math.sqrt(Math.pow(endAltitude, 2) + Math.pow(endDistanceFt, 2))
  return Math.round(slantFt / 100) * 100 // Round to nearest 100 ft
})

// Calculate the slider position where we'll break out of clouds
const cloudBreakoutPosition = computed(() => {
  // Calculate the exact distance where altitude equals ceiling
  const ceiling = approachStore.effectiveCeiling
  const angleRadians = (3 * Math.PI) / 180 // 3 degree glideslope

  // Distance from touchdown zone to reach ceiling altitude
  const distanceToTDZAtCeiling = ceiling / (Math.tan(angleRadians) * 6076)
  // Distance from threshold to reach ceiling
  const distanceFromThresholdAtCeiling = distanceToTDZAtCeiling + 1000 / 6076

  // Calculate position as percentage of total animation
  const endDistanceNm = 10 / (Math.tan((3 * Math.PI) / 180) * 6076) + 1000 / 6076
  const totalDistance = animationStore.startingDistanceNm - endDistanceNm

  // Distance traveled from start to ceiling
  const distanceTraveled = animationStore.startingDistanceNm - distanceFromThresholdAtCeiling

  // Convert to percentage
  const percentage = (distanceTraveled / totalDistance) * 100

  // Clamp between 0 and 100
  return Math.max(0, Math.min(100, percentage))
})

// Helper function to calculate slider position for a given distance from threshold
function calculateSliderPosition(distanceFromThresholdFt: number): number {
  // Convert distance from threshold to distance from touchdown zone
  // Touchdown zone is 1000 ft past threshold
  // Positive distances are before threshold, negative are after
  const distanceFromTDZFt = distanceFromThresholdFt - 1000
  const distanceFromTDZNm = distanceFromTDZFt / 6076

  // Animation ends at 10 ft above runway, which is approximately at touchdown zone
  const endDistanceNm = 10 / (Math.tan((3 * Math.PI) / 180) * 6076)
  const totalDistance = animationStore.startingDistanceNm - endDistanceNm

  // Distance traveled from start
  const distanceTraveled = animationStore.startingDistanceNm - distanceFromTDZNm
  const percentage = (distanceTraveled / totalDistance) * 100

  return Math.max(0, Math.min(100, percentage))
}

// Calculate positions for visibility tick marks
const visibilityTickMarks = computed(() => {
  const marks = []

  // Get visibility in feet
  let visibilityFt: number
  if (approachStore.visibilityUnit === 'RVR') {
    visibilityFt = approachStore.effectiveVisibility
  } else {
    // Convert SM to feet (1 SM = 5280 ft)
    visibilityFt = approachStore.effectiveVisibility * 5280
  }

  const lightingType = approachStore.lightingType
  const cloudBreakout = cloudBreakoutPosition.value

  // Cloud breakout tick mark
  marks.push({
    position: cloudBreakout,
    label: 'Breakout',
    class: 'breakout-tick',
  })

  // Runway threshold (1000 ft before TDZ)
  // Becomes visible when we're visibilityFt + 1000 ft from TDZ
  // In threshold coordinates: visibilityFt + 2000 ft from threshold
  const thresholdVisibilityDistance = visibilityFt + 2000
  const thresholdPosition = calculateSliderPosition(thresholdVisibilityDistance)

  if (thresholdPosition > cloudBreakout && thresholdPosition <= 100) {
    marks.push({
      position: thresholdPosition,
      label: 'Runway threshold visible',
      class: 'tick-threshold',
    })
  }

  // Decision bar (1000 ft before threshold, 2000 ft before TDZ)
  if (['ALSF-II', 'ALSF-I', 'MALSR', 'SSALR'].includes(lightingType)) {
    const decisionBarVisibilityDistance = visibilityFt + 3000
    const decisionBarPosition = calculateSliderPosition(decisionBarVisibilityDistance)

    if (decisionBarPosition > cloudBreakout && decisionBarPosition <= 100) {
      marks.push({
        position: decisionBarPosition,
        label: 'Decision bar visible: Visual bank reference',
        class: 'tick-decision-bar',
      })
    }
  }

  // Sequenced flashers (2400 ft before threshold, 3400 ft before TDZ)
  if (['ALSF-II', 'ALSF-I', 'MALSR', 'SSALR'].includes(lightingType)) {
    const flashersVisibilityDistance = visibilityFt + 4400
    const flashersPosition = calculateSliderPosition(flashersVisibilityDistance)

    if (flashersPosition > cloudBreakout && flashersPosition <= 100) {
      marks.push({
        position: flashersPosition,
        label: 'Sequenced flashers visible: Visual lateral deviation reference',
        class: 'tick-flashers',
      })
    }
  }

  // PAPI (at touchdown zone, 1000 ft past threshold)
  const papiVisibilityDistanceFromThreshold = 1000 + visibilityFt
  const papiPosition = calculateSliderPosition(papiVisibilityDistanceFromThreshold)

  if (papiPosition > cloudBreakout && papiPosition <= 100) {
    marks.push({
      position: papiPosition,
      label: 'PAPI visible: Visual vertical deviation reference',
      class: 'tick-papi',
    })
  }

  // Red side bars at 1000 ft (ALSF-II only) - covered by decision bar tick

  // Alert Height at 100 ft for CAT IIIa/b approaches
  if (
    approachStore.selectedMinimumId === 'cat-iiia' ||
    approachStore.selectedMinimumId === 'cat-iiib'
  ) {
    // Calculate distance for 100 ft altitude on glidepath
    const angleRadians = (3 * Math.PI) / 180 // 3 degree glideslope
    const distanceFor100ft = 100 / (Math.tan(angleRadians) * 6076.12) // distance in nm
    const distanceFromThreshold = distanceFor100ft + 1000 / 6076.12 // add touchdown zone distance
    const alertHeightPosition = calculateSliderPosition(distanceFromThreshold * 6076.12)

    if (alertHeightPosition >= 0 && alertHeightPosition <= 100) {
      marks.push({
        position: alertHeightPosition,
        label: 'Alert Height (100 ft)',
        class: 'tick-alert-height',
      })
    }
  }

  return marks
})

watch(
  () => approachStore.settings,
  () => {
    if (animationStore.isPlaying && !animationStore.isPaused) {
      animationStore.reset()
      animationStore.play()
    }
  },
  { deep: true },
)

// Add spacebar handler for play/pause
function handleKeyDown(event: KeyboardEvent) {
  if (event.code === 'Space') {
    event.preventDefault() // Prevent page scroll
    handlePlayClick()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)

  // Auto-play animation after 1 second
  setTimeout(() => {
    if (!animationStore.isPlaying) {
      animationStore.play()
    }
  }, 1000)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})
</script>

<template>
  <header class="app-header">
    <div class="header-content">
      <h1 class="app-title">Approach Visualizer</h1>
      <div class="form-controls">
        <div class="form-field form-field-select">
          <label for="approach-minimum">Approach Minimum</label>
          <Select
            v-model="selectedMinimum"
            :options="APPROACH_MINIMA"
            option-label="label"
            option-value="id"
            placeholder="Select minimum"
            input-id="approach-minimum"
          />
        </div>

        <div class="form-field form-field-number">
          <label for="ceiling">Ceiling (ft)</label>
          <InputNumber v-model="customCeiling" input-id="ceiling" :min="0" :max="1000" :step="50" />
        </div>

        <div class="form-field form-field-select-small">
          <label for="visibility">Visibility</label>
          <Select
            v-model="customVisibility"
            :options="VISIBILITY_OPTIONS"
            option-label="label"
            placeholder="Select visibility"
            input-id="visibility"
          />
        </div>

        <div class="form-field form-field-select">
          <label for="lighting">Runway Lighting</label>
          <Select
            v-model="lightingType"
            :options="LIGHTING_TYPES"
            option-label="label"
            option-value="value"
            placeholder="Select lighting"
            input-id="lighting"
          />
        </div>

        <div class="form-field form-field-number">
          <label for="speed">Speed (kt)</label>
          <InputNumber v-model="approachSpeed" input-id="speed" :min="50" :max="200" :step="5" />
        </div>

        <div class="form-buttons">
          <Button
            :label="playButtonLabel"
            :icon="playButtonIcon"
            @click="handlePlayClick"
            :severity="animationStore.isPlaying && !animationStore.isPaused ? 'warning' : 'primary'"
          />
          <Button
            label="Reset"
            icon="pi pi-refresh"
            @click="handleReset"
            severity="secondary"
            :disabled="!animationStore.isPlaying && animationStore.currentDistanceNm === 5"
          />
        </div>
      </div>

      <div style="margin-top: 1rem">
        <div class="slider-labels">
          <span>{{ startSlantDistance }} NM</span>
          <span>{{ endSlantDistance.toLocaleString() }} ft</span>
        </div>
        <div class="slider-container">
          <Slider
            v-model="positionSlider"
            style="width: 100%"
            :min="0"
            :max="100"
            :step="0.1"
            :disabled="animationStore.isPlaying && !animationStore.isPaused"
          />
          <!-- All tick marks (cloud breakout and visibility markers) -->
          <div
            v-for="(mark, index) in visibilityTickMarks"
            :key="`tick-${index}`"
            class="visibility-tick"
            :class="mark.class"
            :style="{ left: `${mark.position}%` }"
            v-tooltip.top="mark.label"
          >
            <div class="tick-line"></div>
          </div>
        </div>
      </div>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  padding: 1.25rem 1rem;
  color: white;
  user-select: none;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  box-shadow: 0 2px 8px rgb(0 0 0 / 15%);
}

.header-content {
  max-width: 1600px;
  padding: 0 1rem;
  margin: 0 auto;
}

.app-title {
  margin: 0 0 1.25rem;
  font-size: 1.875rem;
  font-weight: 600;
  text-align: center;
  letter-spacing: 0.5px;
  user-select: none;
}

/* Form controls layout */
.form-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: flex-end;
  justify-content: center;
  padding: 0 0.5rem;
}

.form-field {
  display: flex;
  flex-shrink: 0;
  flex-direction: column;
}

.form-field label {
  display: block;
  margin-bottom: 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  user-select: none;
  opacity: 0.95;
}

/* Control field widths with deep selectors */
.form-field-select :deep(.p-select) {
  width: 180px !important;
}

.form-field-select-small :deep(.p-select) {
  width: 140px !important;
}

.form-field-number :deep(.p-inputnumber) {
  width: 80px !important;
}

.form-field-number :deep(.p-inputnumber-input) {
  width: 80px !important;
}

.form-buttons {
  display: flex;
  gap: 0.5rem;
  align-items: flex-end;
  padding-left: 0 !important;
  margin-left: 0 !important;
}

/* Fix button alignment and icon spacing */
.form-buttons :deep(.p-button) {
  margin-left: 0 !important;
}

.form-buttons :deep(.p-button-icon-left:empty) {
  display: none !important;
}

.form-buttons :deep(.p-button-label) {
  margin-left: 0 !important;
}

/* Slider labels should not be selectable */
.slider-labels {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  user-select: none;
}

/* Slider container for positioning tick mark */
.slider-container {
  position: relative;
}

/* All tick marks */
.visibility-tick {
  position: absolute;
  top: 50%;
  z-index: 9;
  padding: 0 6px;
  cursor: help;
  transform: translate(-50%, -50%);
}

.visibility-tick .tick-line {
  width: 2px;
  height: 14px;
  background: rgb(255 255 100 / 50%);
  box-shadow: 0 0 2px rgb(0 0 0 / 20%);
}

/* Cloud breakout tick mark (taller and more prominent) */
.breakout-tick {
  z-index: 10;
  padding: 0 8px; /* Larger hit area for tooltip */
}

.breakout-tick .tick-line {
  height: 20px;
  background: rgb(255 255 255 / 60%);
  box-shadow: 0 0 3px rgb(0 0 0 / 30%);
}

/* Different colors for different tick types */
.tick-flashers .tick-line {
  background: rgb(100 200 255 / 60%);
}

.tick-alert-height .tick-line {
  background: rgb(255 200 100 / 80%);
  height: 16px;
}

.tick-red-bars .tick-line {
  background: rgb(255 100 100 / 60%);
}

.tick-decision-bar .tick-line {
  background: rgb(200 255 100 / 60%);
}

.tick-threshold .tick-line {
  background: rgb(100 255 100 / 60%);
}

.tick-papi .tick-line {
  background: rgb(255 200 100 / 60%);
}

/* Light mode (default) */
:deep(.p-slider) {
  position: relative;
  background: linear-gradient(90deg, #e8eeff 0%, #f5e8ff 50%, #ffe8f5 100%);
  border: 1px solid rgb(200 200 220 / 50%);
  border-radius: 4px;
}

:deep(.p-slider::before) {
  position: absolute;
  inset: 0;
  pointer-events: none;
  content: '';
  background: linear-gradient(
    90deg,
    rgb(102 126 234 / 15%) 0%,
    rgb(118 75 162 / 15%) 50%,
    rgb(162 75 118 / 15%) 100%
  );
  border-radius: 4px;
}

:deep(.p-slider-range) {
  background: transparent;
  box-shadow: none;
}

:deep(.p-slider-handle) {
  width: 20px;
  height: 20px;
  margin-top: -8px;
  background: linear-gradient(135deg, #fff 0%, #fff 45%, #e0e0e0 55%, #d0d0d0 100%);
  border: 2px solid rgb(118 75 162 / 60%);
  box-shadow:
    0 2px 6px rgb(0 0 0 / 30%),
    0 0 8px rgb(118 75 162 / 30%),
    inset 0 1px 2px rgb(255 255 255 / 80%);
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

:deep(.p-slider-handle:hover) {
  box-shadow:
    0 3px 8px rgb(0 0 0 / 40%),
    0 0 12px rgb(118 75 162 / 50%),
    inset 0 1px 2px rgb(255 255 255 / 90%);
  transform: scale(1.1);
}

:deep(.p-slider-handle:active) {
  transform: scale(1.05);
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  :deep(.p-slider) {
    background: linear-gradient(90deg, #1a2547 0%, #2a1a3d 50%, #3d1a2a 100%);
    border: 1px solid rgb(100 100 150 / 30%);
  }

  :deep(.p-slider::before) {
    background: linear-gradient(
      90deg,
      rgb(60 80 170 / 25%) 0%,
      rgb(80 50 110 / 25%) 50%,
      rgb(110 50 80 / 25%) 100%
    );
  }

  :deep(.p-slider-range) {
    background: transparent;
    box-shadow: none;
  }

  :deep(.p-slider-handle) {
    background: linear-gradient(135deg, #4a4a4a 0%, #4a4a4a 45%, #333 55%, #2a2a2a 100%);
    border: 2px solid rgb(80 50 110 / 80%);
    box-shadow:
      0 2px 8px rgb(0 0 0 / 60%),
      0 0 10px rgb(60 80 170 / 40%),
      inset 0 1px 1px rgb(255 255 255 / 10%);
  }

  :deep(.p-slider-handle:hover) {
    box-shadow:
      0 3px 10px rgb(0 0 0 / 70%),
      0 0 15px rgb(60 80 170 / 60%),
      inset 0 1px 1px rgb(255 255 255 / 15%);
  }
}
</style>
