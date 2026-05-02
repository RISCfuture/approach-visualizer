/**
 * Runtime wrapper for the `babylonjs` UMD package.
 *
 * Why this exists: since v9, `babylonjs` ships a CJS UMD bundle that marks
 * itself as `__esModule: true` and attaches the entire runtime API to its
 * `module.exports.default`. When Vite/esbuild prebundles it, the resulting
 * ES module exposes only `default`/`core`/`__esModule` as named exports, so
 * `import * as BABYLON from 'babylonjs'` produces a namespace where
 * `BABYLON.Engine` (and friends) are `undefined`.
 *
 * This file imports the prebundled module's `default` export and re-exports
 * each member of it as a proper named export. The companion Vite plugin
 * (`vite-plugin-babylonjs-cjs-interop.ts`) generates the body of this file at
 * config-load time (so the export list always matches the installed Babylon
 * version) and rewrites `babylonjs` imports to point here.
 *
 * Do not edit the body — the plugin overwrites it on every build.
 */
// THIS FILE IS A PLACEHOLDER. The Vite plugin replaces its contents.
import * as ns from 'babylonjs'
const BABYLON = ns && ns.default ? ns.default : ns
export default BABYLON
