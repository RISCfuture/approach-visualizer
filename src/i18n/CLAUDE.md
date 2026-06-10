# i18n guidelines

This app is localized with vue-i18n (Composition API). Messages are compiled
at build time by `@intlify/unplugin-vue-i18n` (see `vite.config.ts`), so no
runtime message compiler runs and the strict CSP needs no `unsafe-eval`.

## Layout

- `locales.ts` — the supported-locale list, the type guard, and
  `localeOptions()`, which derives the switcher's autonym labels from
  `Intl.DisplayNames` (no hardcoded label map). The single source of truth for
  which locales exist.
- `locales/en.json` — the base catalog and fallback. Always complete.
- `locales/{en-CA,en-AU,en-GB}.json` — delta-only: contain ONLY keys whose
  value differs from `en` (spelling/terminology). Resolved via `fallbackLocale`.
- `primevue/*.ts` — PrimeVue's own component strings (aria labels, empty
  messages, month names…). `fr-FR.ts` / `de-DE.ts` are complete locale objects;
  English variants reuse PrimeVue's English defaults.

## Translation rules

- Aviation/technical jargon stays in English unless an established
  target-locale term is in real-world use.
  When unsure how a term is rendered, search target-locale aviation sources
  (DGAC/SIA for FR, DFS/AIP for DE, CAA/NAV CANADA/CASA for English variants)
  and pilot forums; prefer what real speakers use over a literal translation.
- The `en-*` variants differ from base `en` only in spelling/terminology
  (e.g. "Visualiser", "Centreline"). Keep them minimal.

## Numbers and units

- Never convert units (aviation uses ft / NM everywhere); never hardcode a unit
  symbol or `number + unit` layout in code. Localize via `Intl.NumberFormat`
  where it supports the unit, else vue-i18n.
- `ft` measurements use Intl's `unit` style (`foot`) — it handles grouping,
  symbol, and spacing. Intl lacks `knot`/`nautical-mile`, so `kt`/`ft` label
  suffixes come from `units.kt`/`units.ft`, and a formatted `NM` value uses the
  `units.nauticalMiles` pattern (`"{value} NM"`, so locales control order/spacing).

## German + verbose languages

German compounds are long and the header/popovers have fixed-width controls and
a mobile layout. Labels use `overflow-wrap` / `hyphens: auto`; prefer concise
established terms (e.g. "Sicht" over "Sichtweite"). Validate de-DE at mobile
widths (~360px) for overflow/clipping after notable string changes — via the
Chrome DevTools MCP or the e2e suite.
