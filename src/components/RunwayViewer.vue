<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch, computed } from 'vue'
import { SceneManager } from '@/scene/SceneManager'
import { useApproachStore } from '@/stores/approach'
import { useAnimationStore } from '@/stores/animation'
import { formatAltitude, formatNauticalMiles } from '@/utils/formatting'

const canvas = ref<HTMLCanvasElement>()
const sceneManager = ref<SceneManager | null>(null)
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
    sceneManager.value = new SceneManager(canvas.value)
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
    <canvas ref="canvas" class="babylon-canvas"></canvas>
    <div class="status-overlay">
      <div class="status-item">
        <span class="status-label">Altitude:</span>
        <span
          class="status-value"
          :class="{
            'below-ceiling': animationStore.currentAltitude <= approachStore.effectiveCeiling,
          }"
          >{{ formatAltitude(animationStore.currentAltitude) }}</span
        >
      </div>
      <div class="status-item">
        <span class="status-label">Distance:</span>
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

@media (width <= 768px) {
  .status-overlay {
    padding: 0.5rem 0.75rem;
    font-size: 0.75rem;
  }
}
</style>
