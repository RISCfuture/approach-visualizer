import type { App } from 'vue'
import Bugsnag, { type Plugin } from '@bugsnag/js'
import BugsnagPluginVue from '@bugsnag/plugin-vue'
import BugsnagPerformance from '@bugsnag/browser-performance'

const bugsnagApiKey = import.meta.env.VITE_BUGSNAG_API_KEY
const isProduction = import.meta.env.PROD

let isInitialized = false

export function initBugsnag(app: App) {
  if (isInitialized) return

  if (bugsnagApiKey && isProduction) {
    const vuePlugin = new BugsnagPluginVue() as Plugin
    Bugsnag.start({
      apiKey: bugsnagApiKey,
      plugins: [vuePlugin],
      releaseStage: isProduction ? 'production' : 'development',
      enabledReleaseStages: ['production'],
    })
    BugsnagPerformance.start({ apiKey: bugsnagApiKey })

    const bugsnagVue = Bugsnag.getPlugin('vue')
    if (bugsnagVue) {
      app.use(bugsnagVue)
    }

    isInitialized = true
  } else if (!isProduction) {
    console.info('Bugsnag disabled in development mode')
  } else {
    console.warn('Bugsnag API key not configured')
  }
}
