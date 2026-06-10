<script setup lang="ts">
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import AppHeader from '@/components/AppHeader.vue'
import RunwayViewer from '@/components/RunwayViewer.vue'
import { useDarkMode } from '@/composables/useDarkMode'

const { t } = useI18n({ useScope: 'global' })
const { initDarkMode } = useDarkMode()

onMounted(() => {
  initDarkMode()
})
</script>

<template>
  <a href="#main-content" class="skip-link">{{ t('a11y.skipToMain') }}</a>
  <div class="app">
    <AppHeader />
    <main id="main-content" class="main-content" tabindex="-1">
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

.main-content:focus {
  outline: none;
}

/* Skip link: visually hidden until focused */
.skip-link {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 10000;
  padding: 0.75rem 1rem;
  font-weight: 600;
  color: #fff;
  text-decoration: none;
  background: #1a2547;
  border-radius: 0 0 0.25rem;
  transform: translateY(-110%);
  transition: transform 0.15s ease-in-out;
}

.skip-link:focus,
.skip-link:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 2px;
  transform: translateY(0);
}
</style>
