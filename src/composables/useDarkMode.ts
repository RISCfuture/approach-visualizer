import { usePreferredDark } from '@vueuse/core'
import { watch } from 'vue'

const isDarkMode = usePreferredDark()

function updateTheme(dark: boolean) {
  const themeLink = document.getElementById('theme-link') as HTMLLinkElement | null
  if (themeLink) {
    themeLink.href = dark
      ? themeLink.href.replace('lara-light', 'lara-dark')
      : themeLink.href.replace('lara-dark', 'lara-light')
  }

  if (dark) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

function initDarkMode() {
  watch(isDarkMode, updateTheme, { immediate: true })
}

export function useDarkMode() {
  return {
    isDarkMode,
    initDarkMode,
  }
}
