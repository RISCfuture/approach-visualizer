import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'

import type { Plugin } from 'vite'

/**
 * Babylon.js (since v9) ships its UMD bundle with `module.exports.default`
 * holding the entire runtime API (`Engine`, `Scene`, `Vector3`, …) and sets
 * `module.exports.__esModule = true`. When Vite/esbuild prebundles it, the
 * resulting module has only `default`/`core`/`__esModule` as enumerable
 * exports, so `import * as BABYLON from 'babylonjs'` produces a namespace
 * where `BABYLON.Engine` (and friends) are `undefined`.
 *
 * This plugin intercepts imports of `babylonjs` and serves a wrapper module
 * that re-exports every property of the package's `default` object as a
 * proper named export, restoring the namespace shape the rest of the
 * codebase expects.
 *
 * Implementation: at module-load time we parse the UMD bundle's `gge` table
 * (a `var gge = { __proto__: null, ClassA: ..., ClassB: ..., }` literal that
 * names the entire public API) directly out of the source. That gives us a
 * static export list without evaluating any code. The wrapper then loads
 * the real package via a query-suffixed specifier we keep routed through
 * Vite's normal resolution + prebundle pipeline (so we still get the
 * optimized ESM build with a working `default` export).
 */
export default function babylonjsCjsInterop(): Plugin {
  const PROXY_ID = '\0babylonjs-namespace-proxy'
  let exportNamesPromise: Promise<string[]> | null = null

  const resolveExportNames = async (): Promise<string[]> => {
    const require = createRequire(import.meta.url)
    const entry = require.resolve('babylonjs')
    const code = await readFile(entry, 'utf8')
    // Find the runtime export table — a literal of the shape
    //   gge = { __proto__: null, A: <id>, B: <id>, get C() { return X }, ... }
    // emitted by the rollup-built UMD. Babylon names every public class as a
    // key in this object. We can't use a single regex because some values
    // are getter functions whose bodies contain `{}` braces; track depth
    // manually instead.
    const startMarker = /gge\s*=\s*\{\s*__proto__\s*:\s*null\s*,/
    const startMatch = startMarker.exec(code)
    if (!startMatch) {
      throw new Error(
        'babylonjs-cjs-interop: could not locate the runtime export table in babylonjs/babylon.js',
      )
    }
    let depth = 1
    let i = startMatch.index + startMatch[0].length
    const tableStart = i
    let inSingle = false
    let inDouble = false
    let inBacktick = false
    let inLineComment = false
    let inBlockComment = false
    while (i < code.length && depth > 0) {
      const c = code[i]
      const prev = code[i - 1]
      if (inLineComment) {
        if (c === '\n') inLineComment = false
      } else if (inBlockComment) {
        if (c === '/' && prev === '*') inBlockComment = false
      } else if (inSingle) {
        if (c === "'" && prev !== '\\') inSingle = false
      } else if (inDouble) {
        if (c === '"' && prev !== '\\') inDouble = false
      } else if (inBacktick) {
        if (c === '`' && prev !== '\\') inBacktick = false
      } else if (c === '/' && code[i + 1] === '/') {
        inLineComment = true
      } else if (c === '/' && code[i + 1] === '*') {
        inBlockComment = true
      } else if (c === "'") {
        inSingle = true
      } else if (c === '"') {
        inDouble = true
      } else if (c === '`') {
        inBacktick = true
      } else if (c === '{') {
        depth++
      } else if (c === '}') {
        depth--
      }
      i++
    }
    if (depth !== 0) {
      throw new Error(
        'babylonjs-cjs-interop: failed to parse runtime export table braces in babylonjs/babylon.js',
      )
    }
    const tableBody = code.substring(tableStart, i - 1)
    const names = new Set<string>()
    // Walk the table body to capture only top-level keys. Each key sits at
    // brace-depth 0, either at the start of the body or right after a
    // top-level comma. Property shorthand isn't used, so every key is
    // followed by `:` (data) or `(` (getter/setter, with the optional
    // `get `/`set ` prefix).
    const keyAtDepth0 = (offset: number): string | null => {
      const m = /^\s*(?:get\s+|set\s+)?([A-Za-z_$][A-Za-z0-9_$]*)\s*[(:]/.exec(
        tableBody.slice(offset),
      )
      return m ? m[1] : null
    }
    let pos = 0
    let bDepth = 0
    let single = false
    let dbl = false
    let tick = false
    let lineCmt = false
    let blockCmt = false
    let expectKey = true
    while (pos < tableBody.length) {
      const ch = tableBody[pos]
      const nx = tableBody[pos + 1]
      const pv = tableBody[pos - 1]
      if (lineCmt) {
        if (ch === '\n') lineCmt = false
      } else if (blockCmt) {
        if (ch === '/' && pv === '*') blockCmt = false
      } else if (single) {
        if (ch === "'" && pv !== '\\') single = false
      } else if (dbl) {
        if (ch === '"' && pv !== '\\') dbl = false
      } else if (tick) {
        if (ch === '`' && pv !== '\\') tick = false
      } else if (ch === '/' && nx === '/') {
        lineCmt = true
      } else if (ch === '/' && nx === '*') {
        blockCmt = true
      } else if (ch === "'") {
        single = true
      } else if (ch === '"') {
        dbl = true
      } else if (ch === '`') {
        tick = true
      } else if (ch === '{' || ch === '(' || ch === '[') {
        bDepth++
      } else if (ch === '}' || ch === ')' || ch === ']') {
        bDepth--
      } else if (bDepth === 0 && ch === ',') {
        expectKey = true
      } else if (bDepth === 0 && expectKey && /\S/.test(ch)) {
        const key = keyAtDepth0(pos)
        if (key) names.add(key)
        expectKey = false
      }
      pos++
    }
    // `default` is reserved — we always emit our own `export default` below.
    names.delete('default')
    return [...names]
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
