import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import babylonjsCjsInterop from './build/vite-plugin-babylonjs-cjs-interop.ts'
import vue from '@vitejs/plugin-vue'
import vueI18n from '@intlify/unplugin-vue-i18n/vite'
import vueDevTools from 'vite-plugin-vue-devtools'
import csp from 'vite-plugin-csp-guard'
import { VitePWA } from 'vite-plugin-pwa'

// The CSP plugin should only run during `vite build` (production bundling). During
// `vite dev` it slows the server noticeably, and during vitest it isn't needed at
// all (and would run over every transformed file). Detect the build via the npm
// script lifecycle rather than Vite's `command`, because `vitest.config.ts` calls
// this config function itself and would otherwise pull the plugin into test runs.
// `npm_lifecycle_event` is set to `build-only` by the `build` script.
const isBuild = process.env.npm_lifecycle_event === 'build-only' || process.env.VITE_CSP === '1'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [
    babylonjsCjsInterop(),
    vue(),
    // Compile locale JSON to render functions at build time so vue-i18n needs
    // no runtime message compiler — keeps the strict CSP (no 'unsafe-eval').
    vueI18n({
      include: [fileURLToPath(new URL('./src/i18n/locales/**', import.meta.url))],
    }),
    command === 'serve' && vueDevTools({ launchEditor: process.env.VITE_LAUNCH_EDITOR }),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: false,
      injectRegister: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest,woff2}'],
        // PrimeIcons ships its glyphs in five formats; every browser that can
        // run this app picks the woff2. Precaching the SVG fallback alone
        // would cost 347 KB for a file nothing ever requests.
        globIgnores: ['**/primeicons-*.svg'],
        // This site has no client-side router, so an unknown path is a real 404.
        // vite-plugin-pwa otherwise defaults this to index.html, which makes the
        // service worker answer every unknown path with the home page.
        navigateFallback: undefined,
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        // BabylonJS pushes the main chunk well past Workbox's 2 MiB default;
        // raise the ceiling so the whole app shell precaches.
        maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
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
          'script-src-elem': ["'self'"],
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
    sourcemap: 'hidden',
    // The app hard-requires WebGL, so every browser that can run it is well
    // past ES2022. Pinning the target keeps Vite from down-levelling syntax
    // for browsers that could never render a frame anyway.
    target: 'es2022',
  },
  base: '/approach-visualizer/',
}))
