import { createRequire } from 'node:module'

import type { Plugin } from 'vite'

const RESERVED_WORDS = new Set([
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'debugger',
  'default',
  'delete',
  'do',
  'else',
  'enum',
  'export',
  'extends',
  'false',
  'finally',
  'for',
  'function',
  'if',
  'import',
  'in',
  'instanceof',
  'new',
  'null',
  'return',
  'super',
  'switch',
  'this',
  'throw',
  'true',
  'try',
  'typeof',
  'var',
  'void',
  'while',
  'with',
  'yield',
  'let',
  'await',
])

/**
 * A runtime key is re-exportable as `export const <name>` only when it is a
 * valid JS identifier that isn't a reserved word (`default` always falls out
 * here, since we emit our own `export default`).
 */
const isReExportableName = (name: string): boolean =>
  /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) && !RESERVED_WORDS.has(name)

/**
 * Babylon.js (since v9) ships its UMD bundle with `module.exports.default`
 * holding the entire runtime API (`Engine`, `Scene`, `Vector3`, …). When
 * Vite/esbuild prebundles it, the resulting module has only
 * `default`/`core`/`__esModule` as enumerable exports, so
 * `import * as BABYLON from 'babylonjs'` produces a namespace where
 * `BABYLON.Engine` (and friends) are `undefined`.
 *
 * This plugin intercepts imports of `babylonjs` and serves a wrapper module
 * that re-exports every property of the package's `default` object as a
 * proper named export, restoring the namespace shape the rest of the
 * codebase expects.
 *
 * Implementation: at plugin-load time we `require('babylonjs')` in Node and
 * enumerate the keys of its runtime object directly. That yields the exact,
 * version-independent export list without parsing the minified bundle. The
 * wrapper then loads the real package via Vite's normal resolution +
 * prebundle pipeline (so we still get the optimized ESM build with a working
 * `default` export).
 */
export default function babylonjsCjsInterop(): Plugin {
  const PROXY_ID = '\0babylonjs-namespace-proxy'
  let exportNamesPromise: Promise<string[]> | null = null

  const resolveExportNames = async (): Promise<string[]> => {
    const require = createRequire(import.meta.url)
    const mod = require('babylonjs') as Record<string, unknown>
    const runtime = (mod.default ?? mod) as Record<string, unknown>
    return Object.keys(runtime).filter(isReExportableName)
  }

  return {
    name: 'babylonjs-cjs-interop',
    enforce: 'pre',
    resolveId(id, importer) {
      if (id === PROXY_ID) return id
      // Only redirect the *first* import of `babylonjs` to the proxy.
      // When the proxy itself imports `babylonjs`, let Vite's normal
      // resolution chain handle it (so we get the prebundled deps file
      // with a working `default` export).
      if (id === 'babylonjs' && importer !== PROXY_ID) {
        return PROXY_ID
      }
      return null
    },
    async load(id) {
      if (id !== PROXY_ID) return null
      exportNamesPromise ??= resolveExportNames()
      const exportNames = await exportNamesPromise
      const named = exportNames.map((k) => `export const ${k} = __real.${k};`).join('\n')
      return `
import __mod from 'babylonjs'
const __real = (__mod && __mod.default) ? __mod.default : __mod
export default __real
${named}
`
    },
  }
}
