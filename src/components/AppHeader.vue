<script setup lang="ts">
import { computed, watch, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useEventListener, useTimeoutFn } from '@vueuse/core'
import Select from 'primevue/select'
import InputNumber from 'primevue/inputnumber'
import Button from 'primevue/button'
import Slider from 'primevue/slider'
import Popover from 'primevue/popover'
import Checkbox from 'primevue/checkbox'
import LocaleSwitcher from '@/components/LocaleSwitcher.vue'
import { useApproachStore } from '@/stores/approach'
import { useAnimationStore } from '@/stores/animation'
import { APPROACH_MINIMA, LIGHTING_TYPES, GLIDESLOPE_ANGLE, FEET_PER_NM } from '@/types/approach'
import { formatFeet, formatNauticalMiles } from '@/utils/formatting'

const { t } = useI18n({ useScope: 'global' })

const VISIBILITY_OPTIONS = [
  { label: '150 RVR', value: 150, unit: 'RVR' },
  { label: '300 RVR', value: 300, unit: 'RVR' },
  { label: '600 RVR', value: 600, unit: 'RVR' },
  { label: '700 RVR', value: 700, unit: 'RVR' },
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

// Localized Select options. Every approach minimum has a `minima.*` key; pure
// jargon entries (ILS CAT I/II/III) keep their English value in each catalog,
// while Non-Precision / Circling get real translations. Lighting labels are
// jargon and stay as-is apart from "None".
const approachMinimaOptions = computed(() =>
  APPROACH_MINIMA.map((minimum) => ({
    id: minimum.id,
    label: t(`minima.${minimum.id}`),
  })),
)

const lightingOptions = computed(() =>
  LIGHTING_TYPES.map((type) => ({
    value: type.value,
    label: type.value === 'None' ? t('lighting.none') : type.label,
  })),
)

// Popover refs
const approachPopover = ref()
const lightingPopover = ref()

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
  set: (value) => {
    approachStore.setCustomCeiling(value)
  },
})

const customVisibility = computed({
  get: () => {
    const currentValue = approachStore.effectiveVisibility
    const currentUnit = approachStore.visibilityUnit
    // Find matching option
    return (
      VISIBILITY_OPTIONS.find((opt) => opt.value === currentValue && opt.unit === currentUnit) ??
      VISIBILITY_OPTIONS[6]
    ) // Default to 2400 RVR
  },
  set: (option) => {
    // Switch unit if needed
    if (option.unit !== approachStore.visibilityUnit) {
      approachStore.setVisibilityUnit(option.unit as 'RVR' | 'SM')
    }
    approachStore.setCustomVisibility(option.value)
  },
})

const lightingType = computed({
  get: () => approachStore.lightingType,
  set: (value) => {
    approachStore.setLightingType(value)
  },
})

const approachSpeed = computed({
  get: () => approachStore.approachSpeed,
  set: (value) => {
    approachStore.setApproachSpeed(value)
  },
})

// Computed properties for runway lighting components
const showREIL = computed({
  get: () => approachStore.showREIL,
  set: (value) => {
    approachStore.setShowREIL(value)
  },
})

// REIL checkbox should be disabled for systems with built-in runway identification
const reilDisabled = computed(() => {
  return ['ALSF-II', 'ALSF-I', 'ODALS'].includes(approachStore.lightingType)
})

const showRCLS = computed({
  get: () => approachStore.showRCLS,
  set: (value) => {
    approachStore.setShowRCLS(value)
  },
})

const showEdgeLights = computed({
  get: () => approachStore.showEdgeLights,
  set: (value) => {
    approachStore.setShowEdgeLights(value)
  },
})

const showPAPI = computed({
  get: () => approachStore.showPAPI,
  set: (value) => {
    approachStore.setShowPAPI(value)
  },
})

// Computed properties for runway markings
const showThresholdMarkings = computed({
  get: () => approachStore.showThresholdMarkings,
  set: (value) => {
    approachStore.setShowThresholdMarkings(value)
  },
})

const showTouchdownZone = computed({
  get: () => approachStore.showTouchdownZone,
  set: (value) => {
    approachStore.setShowTouchdownZone(value)
  },
})

const showSideStripes = computed({
  get: () => approachStore.showSideStripes,
  set: (value) => {
    approachStore.setShowSideStripes(value)
  },
})

const showAimPoint = computed({
  get: () => approachStore.showAimPoint,
  set: (value) => {
    approachStore.setShowAimPoint(value)
  },
})

const playButtonLabel = computed(() => {
  if (!animationStore.isPlaying) return t('controls.play')
  if (animationStore.isPaused) return t('controls.resume')
  return t('controls.pause')
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
    const angleRadians = (GLIDESLOPE_ANGLE * Math.PI) / 180
    const totalDistance =
      animationStore.startingDistanceNm -
      (10 / (Math.tan(angleRadians) * FEET_PER_NM) + 1000 / FEET_PER_NM)
    const distanceTraveled = animationStore.startingDistanceNm - animationStore.currentDistanceNm
    return Math.max(0, Math.min(100, (distanceTraveled / totalDistance) * 100))
  },
  set: (value) => {
    // Convert percentage to distance and set it
    const angleRadians = (GLIDESLOPE_ANGLE * Math.PI) / 180
    const endDistanceNm = 10 / (Math.tan(angleRadians) * FEET_PER_NM) + 1000 / FEET_PER_NM
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
  const startDistanceFt = startDistanceNm * FEET_PER_NM
  const slantNm = Math.sqrt(Math.pow(startAltitude, 2) + Math.pow(startDistanceFt, 2)) / FEET_PER_NM
  return slantNm // NM; formatted for display by the template
})

const endSlantDistance = computed(() => {
  // End position: 10 ft above runway
  const endAltitude = 10
  const angleRadians = (GLIDESLOPE_ANGLE * Math.PI) / 180
  const endDistanceNm = 10 / (Math.tan(angleRadians) * FEET_PER_NM) + 1000 / FEET_PER_NM
  const endDistanceFt = endDistanceNm * FEET_PER_NM
  const slantFt = Math.sqrt(Math.pow(endAltitude, 2) + Math.pow(endDistanceFt, 2))
  return Math.round(slantFt / 100) * 100 // Round to nearest 100 ft
})

// Calculate the slider position where we'll break out of clouds
const cloudBreakoutPosition = computed(() => {
  // Calculate the exact distance where altitude equals ceiling
  const ceiling = approachStore.effectiveCeiling
  const angleRadians = (GLIDESLOPE_ANGLE * Math.PI) / 180

  // Distance from touchdown zone to reach ceiling altitude
  const distanceToTDZAtCeiling = ceiling / (Math.tan(angleRadians) * FEET_PER_NM)
  // Distance from threshold to reach ceiling
  const distanceFromThresholdAtCeiling = distanceToTDZAtCeiling + 1000 / FEET_PER_NM

  // Calculate position as percentage of total animation
  const endDistanceNm = 10 / (Math.tan(angleRadians) * FEET_PER_NM) + 1000 / FEET_PER_NM
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
  // Convert distance from threshold to nautical miles
  const distanceFromThresholdNm = distanceFromThresholdFt / FEET_PER_NM

  // Animation ends at 10 ft above runway, which is approximately at touchdown zone
  const angleRadians = (GLIDESLOPE_ANGLE * Math.PI) / 180
  const endDistanceNm = 10 / (Math.tan(angleRadians) * FEET_PER_NM) + 1000 / FEET_PER_NM
  const totalDistance = animationStore.startingDistanceNm - endDistanceNm

  // Distance traveled from start to reach this threshold distance
  const distanceTraveled = animationStore.startingDistanceNm - distanceFromThresholdNm
  const percentage = (distanceTraveled / totalDistance) * 100

  return Math.max(0, Math.min(100, percentage))
}

// Calculate positions for visibility tick marks
const visibilityTickMarks = computed(() => {
  const marks = []

  // Get visibility in feet
  const visibilityFt =
    approachStore.visibilityUnit === 'RVR'
      ? approachStore.effectiveVisibility
      : // Convert SM to feet (1 SM = 5280 ft)
        approachStore.effectiveVisibility * 5280

  const currentLightingType = approachStore.lightingType
  const cloudBreakout = cloudBreakoutPosition.value

  // Cloud breakout tick mark
  marks.push({
    position: cloudBreakout,
    label: t('ticks.breakout'),
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
      label: t('ticks.thresholdVisible'),
      class: 'tick-threshold',
    })
  }

  // Decision bar (1000 ft before threshold, 2000 ft before TDZ)
  if (['ALSF-II', 'ALSF-I', 'MALSR', 'SSALR'].includes(currentLightingType)) {
    const decisionBarVisibilityDistance = visibilityFt + 3000
    const decisionBarPosition = calculateSliderPosition(decisionBarVisibilityDistance)

    if (decisionBarPosition > cloudBreakout && decisionBarPosition <= 100) {
      marks.push({
        position: decisionBarPosition,
        label: t('ticks.decisionBar'),
        class: 'tick-decision-bar',
      })
    }
  }

  // Sequenced flashers (2400 ft before threshold, 3400 ft before TDZ)
  if (['ALSF-II', 'ALSF-I', 'MALSR', 'SSALR'].includes(currentLightingType)) {
    const flashersVisibilityDistance = visibilityFt + 4400
    const flashersPosition = calculateSliderPosition(flashersVisibilityDistance)

    if (flashersPosition > cloudBreakout && flashersPosition <= 100) {
      marks.push({
        position: flashersPosition,
        label: t('ticks.flashers'),
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
      label: t('ticks.papi'),
      class: 'tick-papi',
    })
  }

  // Red side bars at 1000 ft (ALSF-II only) - covered by decision bar tick

  // Alert Height at 100 ft for CAT IIIa/b approaches
  if (
    approachStore.selectedMinimumId === 'cat-iiia' ||
    approachStore.selectedMinimumId === 'cat-iiib'
  ) {
    // Calculate distance for 100 ft altitude on glidepath using the same formula as animation store
    const angleRadians = (GLIDESLOPE_ANGLE * Math.PI) / 180
    // Distance from touchdown zone to reach 100 ft altitude (in nautical miles)
    const distanceFromTDZNm = 100 / (Math.tan(angleRadians) * FEET_PER_NM)
    // Convert to distance from threshold (add touchdown zone distance)
    const distanceFromThresholdNm = distanceFromTDZNm + 1000 / FEET_PER_NM
    const alertHeightPosition = calculateSliderPosition(distanceFromThresholdNm * FEET_PER_NM)

    if (alertHeightPosition >= 0 && alertHeightPosition <= 100) {
      marks.push({
        position: alertHeightPosition,
        label: t('ticks.alertHeight', { unit: t('units.ft') }),
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

useEventListener(window, 'keydown', handleKeyDown)

useTimeoutFn(() => {
  if (!animationStore.isPlaying) {
    animationStore.play()
  }
}, 1000)
</script>

<template>
  <header class="app-header">
    <div class="header-content">
      <div class="header-toolbar">
        <LocaleSwitcher />
      </div>
      <h1 class="app-title">{{ t('app.title') }}</h1>
      <div class="form-controls">
        <div class="form-field-group">
          <div class="form-field form-field-select">
            <label for="approach-minimum" data-testid="approach-minimum-label">{{
              t('controls.approachMinimum')
            }}</label>
            <Select
              v-model="selectedMinimum"
              :options="approachMinimaOptions"
              option-label="label"
              option-value="id"
              :placeholder="t('controls.selectMinimum')"
              input-id="approach-minimum"
            />
          </div>
          <Button
            icon="pi pi-cog"
            severity="secondary"
            rounded
            @click="(event: Event) => approachPopover.toggle(event)"
            :aria-label="t('controls.configureApproachMinimum')"
            class="config-button"
          />
        </div>

        <div class="form-field-group">
          <div class="form-field form-field-select">
            <label for="lighting">{{ t('controls.runwayLighting') }}</label>
            <Select
              v-model="lightingType"
              :options="lightingOptions"
              option-label="label"
              option-value="value"
              :placeholder="t('controls.selectLighting')"
              input-id="lighting"
            />
          </div>
          <Button
            icon="pi pi-cog"
            severity="secondary"
            rounded
            @click="(event: Event) => lightingPopover.toggle(event)"
            :aria-label="t('controls.configureRunwayLighting')"
            class="config-button"
          />
        </div>

        <div class="form-field form-field-number">
          <label for="speed">{{ t('controls.speed', { unit: t('units.kt') }) }}</label>
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
            :label="t('controls.reset')"
            icon="pi pi-refresh"
            @click="handleReset"
            severity="secondary"
            :disabled="!animationStore.isPlaying && animationStore.currentDistanceNm === 5"
          />
        </div>
      </div>

      <div class="slider-section">
        <div class="slider-labels">
          <span>{{ formatNauticalMiles(startSlantDistance) }}</span>
          <span>{{ formatFeet(endSlantDistance) }}</span>
        </div>
        <div class="slider-container">
          <Slider
            v-model="positionSlider"
            class="full-width-slider"
            data-testid="position-slider"
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
            :data-testid="mark.class === 'breakout-tick' ? 'breakout-tick' : undefined"
            :style="{ left: `${mark.position}%` }"
            v-tooltip.top="mark.label"
          >
            <div class="tick-line"></div>
          </div>
        </div>
      </div>
    </div>
  </header>

  <!-- Approach Minimum Configuration Popover -->
  <Popover ref="approachPopover">
    <div class="popover-content">
      <h3 class="popover-title">{{ t('popover.approachTitle') }}</h3>

      <div class="popover-field">
        <label for="popover-ceiling">{{ t('popover.ceiling', { unit: t('units.ft') }) }}</label>
        <InputNumber
          v-model="customCeiling"
          input-id="popover-ceiling"
          :min="0"
          :max="1000"
          :step="50"
          :placeholder="t('popover.presetValue')"
        />
      </div>

      <div class="popover-field">
        <label for="popover-visibility">{{ t('popover.visibility') }}</label>
        <Select
          v-model="customVisibility"
          :options="VISIBILITY_OPTIONS"
          option-label="label"
          :placeholder="t('popover.presetValue')"
          input-id="popover-visibility"
        />
      </div>
    </div>
  </Popover>

  <!-- Runway Lighting Configuration Popover -->
  <Popover ref="lightingPopover">
    <div class="popover-content">
      <h3 class="popover-title">{{ t('popover.lightingTitle') }}</h3>

      <div class="popover-section">
        <h4 class="popover-subtitle">{{ t('popover.lightingComponents') }}</h4>

        <div class="checkbox-field">
          <Checkbox v-model="showREIL" input-id="check-reil" binary :disabled="reilDisabled" />
          <label for="check-reil" :class="{ 'disabled-label': reilDisabled }">
            {{ t('popover.reil') }}
          </label>
        </div>

        <div class="checkbox-field">
          <Checkbox v-model="showRCLS" input-id="check-rcls" binary />
          <label for="check-rcls">{{ t('popover.rcls') }}</label>
        </div>

        <div class="checkbox-field">
          <Checkbox v-model="showEdgeLights" input-id="check-edge" binary />
          <label for="check-edge">{{ t('popover.edgeLights') }}</label>
        </div>

        <div class="checkbox-field">
          <Checkbox v-model="showPAPI" input-id="check-papi" binary />
          <label for="check-papi">{{ t('popover.papi') }}</label>
        </div>
      </div>

      <div class="popover-section">
        <h4 class="popover-subtitle">{{ t('popover.runwayMarkings') }}</h4>

        <div class="checkbox-field">
          <Checkbox v-model="showThresholdMarkings" input-id="check-threshold" binary />
          <label for="check-threshold">{{ t('popover.thresholdMarkings') }}</label>
        </div>

        <div class="checkbox-field">
          <Checkbox v-model="showTouchdownZone" input-id="check-tdz" binary />
          <label for="check-tdz">{{ t('popover.touchdownZoneMarkings') }}</label>
        </div>

        <div class="checkbox-field">
          <Checkbox v-model="showSideStripes" input-id="check-stripes" binary />
          <label for="check-stripes">{{ t('popover.sideStripes') }}</label>
        </div>

        <div class="checkbox-field">
          <Checkbox v-model="showAimPoint" input-id="check-aim" binary />
          <label for="check-aim">{{ t('popover.aimPointMarkings') }}</label>
        </div>
      </div>
    </div>
  </Popover>
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
  position: relative;
  max-width: 1600px;
  padding: 0 1rem;
  margin: 0 auto;
}

.header-toolbar {
  position: absolute;
  top: 0;
  right: 1rem;
  z-index: 1;
}

.app-title {
  /* Symmetric inline padding keeps the centered title clear of the
     absolutely-positioned locale switcher instead of running under it. */
  padding: 0 2.75rem;
  margin: 0 0 1.25rem;
  font-size: 1.875rem;
  font-weight: 600;
  text-align: center;
  letter-spacing: 0.5px;
  overflow-wrap: break-word;
  user-select: none;
}

@media (width <= 480px) {
  .app-title {
    font-size: 1.4rem;
  }
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

.form-field-group {
  display: flex;
  gap: 0.25rem;
  align-items: flex-end;
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

/* Long compound labels (notably de-DE) must wrap and hyphenate instead of
   overflowing their fixed-width controls. */
.form-field label,
.checkbox-field label,
.popover-title,
.popover-subtitle,
.popover-field label {
  overflow-wrap: break-word;
  hyphens: auto;
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

.slider-section {
  margin-top: 1rem;
}

.full-width-slider {
  width: 100%;
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
  height: 16px;
  background: rgb(255 200 100 / 80%);
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

/* Configure button styling */
.config-button {
  width: 32px !important;
  height: 32px !important;
  opacity: 1;
}

/* Popover content styling */
.popover-content {
  min-width: 300px;
  padding: 1rem;
}

.popover-title {
  margin: 0 0 1rem;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--p-text-color);
}

.popover-section {
  margin-bottom: 1.25rem;
}

.popover-section:last-child {
  margin-bottom: 0;
}

.popover-subtitle {
  margin: 0 0 0.75rem;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--p-text-muted-color);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.popover-field {
  margin-bottom: 1rem;
}

.popover-field:last-child {
  margin-bottom: 0;
}

.popover-field label {
  display: block;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--p-text-color);
}

.checkbox-field {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin-bottom: 0.5rem;
}

.checkbox-field:last-child {
  margin-bottom: 0;
}

.checkbox-field label {
  margin: 0;
  font-size: 0.875rem;
  color: var(--p-text-color);
  cursor: pointer;
  user-select: none;
}

.checkbox-field label.disabled-label {
  cursor: not-allowed;
  opacity: 0.6;
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
