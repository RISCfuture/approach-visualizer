import { createApp } from 'vue'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import Aura from '@primeuix/themes/aura'
import Tooltip from 'primevue/tooltip'
import { initBugsnag } from './bugsnag'

import 'normalize.css'
import 'primeflex/primeflex.css'
import './styles/global.css'

import App from './App.vue'

const app = createApp(App)

initBugsnag(app)
app.use(createPinia())
app.use(PrimeVue, {
  theme: {
    preset: Aura,
  },
})

app.directive('tooltip', Tooltip)

app.mount('#app')
