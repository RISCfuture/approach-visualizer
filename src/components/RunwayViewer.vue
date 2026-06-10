<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { SceneManager } from '@/scene/SceneManager'
import { useApproachStore } from '@/stores/approach'
import { useAnimationStore } from '@/stores/animation'
import { formatAltitude, formatNauticalMiles } from '@/utils/formatting'

const { t } = useI18n({ useScope: 'global' })

const canvas = ref<HTMLCanvasElement>()
const sceneManager = ref<SceneManager | null>(null)
const webGLError = ref<string | null>(null)
const approachStore = useApproachStore()
const animationStore = useAnimationStore()

// Check if we're within visibility range
const isWithinVisibility = computed(() => {
  const visibilityNm =
    approachStore.visibilityUnit === 'SM'
      ? approachStore.effectiveVisibility
      : approachStore.effectiveVisibility / 5280 // Convert RVR feet to statute miles then to NM (roughly)

  // Convert statute miles to nautical miles (1 SM = 0.869 NM)
  const visibilityInNm = visibilityNm * 0.869

  return animationStore.currentDistanceNm <= visibilityInNm
})

onMounted(() => {
  if (canvas.value) {
    try {
      sceneManager.value = new SceneManager(canvas.value)
    } catch (error) {
      console.error('Failed to initialize 3D scene:', error)
      webGLError.value = 'WebGL is not supported in your browser'
    }
  }
})

onUnmounted(() => {
  if (sceneManager.value) {
    sceneManager.value.dispose()
  }
})

watch(
  () => approachStore.settings,
  () => {
    if (sceneManager.value) {
      sceneManager.value.updateSettings()
    }
  },
  { deep: true },
)

watch(
  () => animationStore.currentDistanceNm,
  () => {
    if (sceneManager.value && !animationStore.isPlaying) {
      sceneManager.value.updateSettings()
    }
  },
)
</script>

<template>
  <div class="runway-viewer">
    <canvas
      ref="canvas"
      class="babylon-canvas"
      role="img"
      :aria-label="t('a11y.canvasLabel')"
      aria-describedby="canvas-description"
    ></canvas>
    <p id="canvas-description" class="sr-only">
      {{ t('a11y.canvasDescription') }}
    </p>

    <!-- WebGL Error Message -->
    <div v-if="webGLError" class="webgl-error">
      <div class="error-content">
        <h3>{{ t('webgl.title') }}</h3>
        <p>{{ t('webgl.intro') }}</p>
        <p class="suggestions-title">{{ t('webgl.tryTitle') }}</p>
        <ul class="suggestions">
          <li>{{ t('webgl.tryModernBrowser') }}</li>
          <li>{{ t('webgl.tryHardwareAcceleration') }}</li>
          <li>{{ t('webgl.tryUpdateDrivers') }}</li>
          <li>{{ t('webgl.trySecuritySoftware') }}</li>
        </ul>
      </div>
    </div>

    <!-- Status Overlay -->
    <div v-else class="status-overlay">
      <div class="status-item">
        <span class="status-label">{{ t('status.altitude') }}</span>
        <span
          class="status-value"
          :class="{
            'below-ceiling': animationStore.currentAltitude <= approachStore.effectiveCeiling,
          }"
          >{{ formatAltitude(animationStore.currentAltitude) }}</span
        >
      </div>
      <div class="status-item">
        <span class="status-label">{{ t('status.distance') }}</span>
        <span class="status-value" :class="{ 'within-visibility': isWithinVisibility }">{{
          formatNauticalMiles(animationStore.currentDistanceNm)
        }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.runway-viewer {
  position: relative;
  width: 100%;
  height: 100%;
  background: #000;
}

.babylon-canvas {
  display: block;
  width: 100%;
  height: 100%;
  outline: none;
}

/* Visually hidden but available to assistive technology */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}

.status-overlay {
  position: absolute;
  top: 1rem;
  left: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  font-family: monospace;
  font-size: 0.875rem;
  color: white;
  pointer-events: none;
  user-select: none;
  background: rgb(0 0 0 / 70%);
  border-radius: 0.5rem;
  backdrop-filter: blur(4px);
}

.status-item {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.status-label {
  font-weight: 600;
  color: #aaa;
}

.status-value {
  font-weight: bold;
  color: #0f0;
  transition: color 0.3s ease;
}

.status-value.below-ceiling,
.status-value.within-visibility {
  color: #ff0; /* Yellow when below ceiling or within visibility */
}

.webgl-error {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 90%;
  max-width: 500px;
  padding: 2rem;
  color: #333;
  background: rgb(255 255 255 / 95%);
  border-radius: 0.5rem;
  box-shadow: 0 4px 6px rgb(0 0 0 / 10%);
  transform: translate(-50%, -50%);
}

.error-content h3 {
  margin: 0 0 1rem;
  font-size: 1.5rem;
  color: #d32f2f;
}

.error-content p {
  margin: 0.5rem 0;
  line-height: 1.6;
}

.suggestions-title {
  margin-top: 1rem !important;
  font-weight: 600;
}

.suggestions {
  padding: 0;
  margin: 0.5rem 0 0 1.5rem;
  list-style-type: disc;
}

.suggestions li {
  margin: 0.5rem 0;
  line-height: 1.5;
}

@media (prefers-color-scheme: dark) {
  .webgl-error {
    color: #eee;
    background: rgb(40 40 40 / 95%);
  }

  .error-content h3 {
    color: #ff6b6b;
  }
}

@media (width <= 768px) {
  .status-overlay {
    padding: 0.5rem 0.75rem;
    font-size: 0.75rem;
  }

  .webgl-error {
    width: 95%;
    padding: 1.5rem;
  }

  .error-content h3 {
    font-size: 1.25rem;
  }
}
</style>
