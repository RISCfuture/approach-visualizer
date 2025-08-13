<script setup lang="ts">
import { onMounted } from 'vue'
import AppHeader from '@/components/AppHeader.vue'
import RunwayViewer from '@/components/RunwayViewer.vue'
import { useDarkMode } from '@/composables/useDarkMode'

const { initDarkMode } = useDarkMode()

onMounted(() => {
  initDarkMode()
})
</script>

<template>
  <div class="app">
    <AppHeader />
    <main class="main-content">
      <RunwayViewer />
    </main>
  </div>
</template>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

.main-content {
  position: relative;
  flex: 1;
  overflow: hidden;
}
</style>
