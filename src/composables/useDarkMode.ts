import { ref, computed } from 'vue'

const isDarkMode = ref(false)

// Check and watch for dark mode changes
function initDarkMode() {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

  // Set initial value
  isDarkMode.value = mediaQuery.matches

  // Listen for changes
  mediaQuery.addEventListener('change', (e) => {
    isDarkMode.value = e.matches
    updateTheme(e.matches)
  })

  // Set initial theme
  updateTheme(isDarkMode.value)
}

// Update PrimeVue theme
function updateTheme(dark: boolean) {
  const themeLink = document.getElementById('theme-link') as HTMLLinkElement
  if (themeLink) {
    if (dark) {
      themeLink.href = themeLink.href.replace('lara-light', 'lara-dark')
    } else {
      themeLink.href = themeLink.href.replace('lara-dark', 'lara-light')
    }
  }

  // Update document class for CSS
  if (dark) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

export function useDarkMode() {
  return {
    isDarkMode: computed(() => isDarkMode.value),
    initDarkMode,
  }
}
