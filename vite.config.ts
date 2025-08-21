import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import legacy from '@vitejs/plugin-legacy'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    process.env.NODE_ENV == 'development' ? vueDevTools({ launchEditor: 'rubymine' }) : false,
    legacy({
      targets: ['chrome >= 79', 'edge >= 79', 'safari >= 13', 'firefox >= 67'],
      modernPolyfills: ['es.object.has-own']
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    sourcemap: true,
  },
  base: '/approach-visualizer',
})
