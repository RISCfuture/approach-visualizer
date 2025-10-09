import { createApp } from 'vue'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import Aura from '@primeuix/themes/aura'
import Tooltip from 'primevue/tooltip'
import * as Sentry from '@sentry/vue'
import { createSentryPiniaPlugin } from '@sentry/vue'

import 'normalize.css'
import 'primeflex/primeflex.css'
import 'primeicons/primeicons.css'
import './styles/global.css'

import App from './App.vue'

const app = createApp(App)

const sentryDSN = import.meta.env.VITE_SENTRY_DSN
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
    // Sentry.browserTracingIntegration({ router }),
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

app.use(PrimeVue, {
  theme: {
    preset: Aura,
  },
  unstyled: false,
})

app.directive('tooltip', Tooltip)

app.mount('#app')
