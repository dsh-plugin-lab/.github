/**
 * Bundle the browser half.
 *
 * The artifact has to be the lazy-CJS factory envelope the host's client module system wants: the
 * script only **registers** a factory, and the module body (with its side effects) waits for the first
 * require.
 *
 *     window.__ModuleLoader__.load({ id, factory: (require) => ({ ... }) })
 *
 * Upstream builds this envelope with `clientBundle()` from `packages/client/tsdown.client.ts`, but
 * that preset is not published to npm (the official cookbook states plainly that "a package outside
 * this repository has to reproduce the same output format itself"), so esbuild reproduces it here.
 *
 * Two things have to be wired up by hand:
 * 1. CSS Modules need an explicit `loader: { '.css': 'local-css' }`, otherwise `import css` yields `{}`.
 * 2. esbuild extracts CSS into a separate file, but DSH wants the styles injected when the factory
 *    runs, as `<style data-plugin="<package name>">` — HMR's `removeOwnedStyles` cleans up by matching
 *    that attribute literally.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { build } from 'esbuild'

// Path-collision guard: tsc compiles src/<name>.ts to lib/<name>.js with rootDir src and outDir lib.
// If src/client.ts existed it would claim the same path as this script's outfile, and whichever ran
// second would silently overwrite the other. That collision really happened: lib/client.js was
// replaced by the browser envelope, the host-side import picked up the envelope instead, and DSH died
// on startup with a SyntaxError.
for (const stale of ['src/client.ts', 'src/client.tsx']) {
  if (existsSync(stale)) {
    throw new Error(
      `${stale} collides with the browser half's output path lib/client.js: rename it, or move it into src/client/.`,
    )
  }
}

/** The bundle id must equal the package name: the module table is keyed by it. Truth is package.json's `name`. */
const BUNDLE_ID = JSON.parse(readFileSync('package.json', 'utf8')).name

/** The style tag id; the prefix must be the package name so it is traceable. */
const STYLE_TAG_ID = `${BUNDLE_ID}/client.css`

/** Baseline modules and peer packages the host provides; none of these get bundled. */
const HOST_PROVIDED = [
  'react',
  'react-dom',
  'react/jsx-runtime',
  'react-dom/client',
  '@deepseek-ai/*',
]

/** Build-time placeholder, replaced after the build with the real style-injection code. */
const CSS_PLACEHOLDER = '/*__DSB_STYLE_INJECTION__*/'

/**
 * Emit the style-injection code. The shape follows `packages/client/tsdown.client.ts:37-56`: a
 * querySelector blocks a repeated injection, and the tag carries both `data-plugin` (for HMR cleanup)
 * and `data-plugin-css` (the module system's bookkeeping).
 */
function styleInjection(cssText) {
  return [
    `var __dsbCss = ${JSON.stringify(cssText)};`,
    `var __dsbTagId = ${JSON.stringify(STYLE_TAG_ID)};`,
    `if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css="' + __dsbTagId + '"]') === null) {`,
    `  var __dsbTag = document.createElement('style');`,
    `  __dsbTag.dataset.plugin = ${JSON.stringify(BUNDLE_ID)};`,
    `  __dsbTag.dataset.pluginCss = __dsbTagId;`,
    `  __dsbTag.textContent = __dsbCss;`,
    `  document.head.appendChild(__dsbTag);`,
    `}`,
  ].join('\n')
}

const result = await build({
  entryPoints: ['src/client/index.tsx'],
  outfile: 'lib/client.js',
  bundle: true,
  write: false,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  jsx: 'automatic',
  legalComments: 'none',
  external: HOST_PROVIDED,
  loader: { '.css': 'local-css' },
  banner: {
    js: [
      'window.__ModuleLoader__.load({',
      `\tid: ${JSON.stringify(BUNDLE_ID)},`,
      '\tfactory: (require) => {',
      '\t\tvar module = { exports: {} };',
      '\t\tvar exports = module.exports;',
    ].join('\n'),
  },
  footer: { js: `\t\t${CSS_PLACEHOLDER}\n\t\treturn module.exports;\n\t}\n});` },
})

const jsOutput = result.outputFiles.find((file) => file.path.endsWith('.js'))
const cssOutput = result.outputFiles.find((file) => file.path.endsWith('.css'))
if (jsOutput === undefined) throw new Error('esbuild produced no JS file.')
if (!jsOutput.text.includes(CSS_PLACEHOLDER)) {
  throw new Error('footer placeholder lost: esbuild footer behaviour changed; check this script.')
}

const cssText = cssOutput?.text ?? ''
const bundle = jsOutput.text.replace(CSS_PLACEHOLDER, styleInjection(cssText))

mkdirSync('lib', { recursive: true })
writeFileSync('lib/client.js', bundle)

console.log(`built lib/client.js as module ${BUNDLE_ID} (styles inlined: ${cssText.length} bytes)`)
