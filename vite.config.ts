import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import legacy from '@vitejs/plugin-legacy'
import csp from 'vite-plugin-csp-guard'
import { VitePWA } from 'vite-plugin-pwa'

// The CSP plugin should only run during `vite build` (production bundling). During
// `vite dev` it slows the server noticeably, and during vitest it isn't needed at
// all (and would run over every transformed file). Detect the build command via the
// npm script lifecycle rather than the config callback form, because the callback
// form breaks vitest's `mergeConfig` (it can't merge a config returned by a
// function). `npm_lifecycle_event` is set to `build-only` by the `yarn build` script.
const isBuild = process.env.npm_lifecycle_event === 'build-only' || process.env.VITE_CSP === '1'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    process.env.NODE_ENV == 'development' ? vueDevTools({ launchEditor: 'rubymine' }) : false,
    legacy({
      targets: ['chrome >= 79', 'edge >= 79', 'safari >= 13', 'firefox >= 67'],
      modernPolyfills: ['es.object.has-own'],
    }),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: false,
      injectRegister: 'script',
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest,woff,woff2}'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api/, /\.map$/],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        // PrimeVue + flight visualization libs push the main chunk past 2 MiB,
        // and the legacy bundle is even larger. Raise from the default so the
        // whole app shell precaches.
        maximumFileSizeToCacheInBytes: 15 * 1024 * 1024,
      },
    }),
    isBuild &&
      csp({
        dev: { run: false },
        build: { sri: false },
        override: true,
        policy: {
          'default-src': ["'self'"],
          'script-src': ["'self'"],
          // Vite's modern-browser detector uses a data: module import; ensure 'self'
          // is preserved alongside the hashes the plugin injects for inline <script>s.
          'script-src-elem': ["'self'", 'data:'],
          // TODO: precompile the PrimeVue Aura theme to a static stylesheet so we can
          // drop 'unsafe-inline' here. PrimeVue 4 styled mode injects <style> tags at
          // runtime via @primeuix/themes; a nonce-less static host (GitHub Pages)
          // can't hash those.
          'style-src': ["'self'", "'unsafe-inline'"],
          // Required regardless of styled/unstyled mode: primevue#7575 emits style=""
          // attrs on DataTable/Tooltip/VirtualScroller, and Vue's :style bindings are
          // inline style attributes.
          'style-src-attr': ["'unsafe-inline'"],
          'img-src': ["'self'", 'data:', 'blob:'],
          'font-src': ["'self'", 'data:'],
          'connect-src': ["'self'", 'https://*.ingest.sentry.io', 'https://*.sentry.io'],
          'worker-src': ["'self'", 'blob:'],
          'child-src': ["'self'", 'blob:'],
          'object-src': ["'none'"],
          'base-uri': ["'self'"],
          'form-action': ["'self'"],
        },
      }),
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
