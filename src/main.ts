import { createApp } from 'vue'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import Aura from '@primeuix/themes/aura'
import Tooltip from 'primevue/tooltip'
import * as Sentry from '@sentry/vue'
import { createSentryPiniaPlugin } from '@sentry/vue'

import { i18n, initLocale } from './i18n'
import { primeVueLocale } from './i18n/primevue'

import 'normalize.css'
import 'primeflex/primeflex.css'
import 'primeicons/primeicons.css'
import './styles/global.css'

import App from './App.vue'

// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
const app = createApp(App)

const sentryDSN = import.meta.env.VITE_SENTRY_DSN as string | undefined
Sentry.init({
  app,
  dsn: sentryDSN,
  sendDefaultPii: true,
  integrations: [
    Sentry.vueIntegration({
      tracingOptions: {
        trackComponents: true,
      },
    }),
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  tracesSampleRate: 1.0,
  enableLogs: true,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
})

const pinia = createPinia()
pinia.use(createSentryPiniaPlugin())
app.use(pinia)
app.use(i18n)

app.use(PrimeVue, {
  theme: {
    preset: Aura,
  },
  unstyled: false,
  locale: primeVueLocale,
})

app.directive('tooltip', Tooltip)

// Resolve the browser/stored locale (and lazily load its catalog) before the
// first paint so the UI never flashes the fallback language. A promise chain
// (not top-level await) is deliberate: the legacy build targets browsers
// without top-level-await support.
// oxlint-disable-next-line unicorn/prefer-top-level-await
void initLocale().finally(() => {
  app.mount('#app')
})
