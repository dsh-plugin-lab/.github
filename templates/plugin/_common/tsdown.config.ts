import { transform } from 'lightningcss'
import type { Plugin, UserConfig } from 'tsdown'
import { readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { basename, dirname, resolve as resolvePath } from 'node:path'

const PLUGIN_ID = '{{name}}'

/** Read the version once so `src/version.ts` can pick it up at build time. */
const PACKAGE_VERSION = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))
  .version as string

/** Build-time define; `src/version.ts` reads `__DSH_PLUGIN_VERSION__`. */
const VERSION_DEFINE = { __DSH_PLUGIN_VERSION__: JSON.stringify(PACKAGE_VERSION) }

/**
 * Modules the host provides, kept out of the browser bundle.
 *
 * This list is a **guardrail, not documentation**: anything imported by value and *not* named here
 * gets **inlined**, and inlining a React runtime is fatal rather than merely fat. `react-dom`'s module
 * scope reads `process.env.NODE_ENV`, so inlining it grows the bundle to ~1 MB and then throws
 * `process is not defined` the moment the browser loads it — the plugin fails to activate and the
 * host reports nothing but an import error.
 */
const CLIENT_EXTERNALS = [
  'react',
  'react-dom',
  'react/jsx-runtime',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-locale/client',
] as const

/**
 * Virtual-id suffix. tsdown's own CSS guard matches ids ending in `.css`, so the virtual id must not
 * end that way — the whole point is to keep module CSS away from a pipeline that would need `@tsdown/css`.
 */
const CSS_VIRTUAL_PREFIX = '\0plugin-css:'
const CSS_VIRTUAL_SUFFIX = '.js'

/**
 * Emit a CSS Modules module: it injects the stylesheet when the factory runs and exports the class map.
 *
 * The style tag is idempotent by `data-plugin-css`: the browser bundle loads once per DSH page, but a
 * hot reload or a second plugin mounting the same module must not stack duplicate rules.
 */
function styleInjectionModule(
  id: string,
  fileId: string,
  css: string,
  classMap: Readonly<Record<string, string>>,
): string {
  const tagId = `${id}/${basename(fileId)}`
  return [
    `const css = ${JSON.stringify(css)};`,
    `const tagId = ${JSON.stringify(tagId)};`,
    "if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css=' + JSON.stringify(tagId) + ']') === null) {",
    "  const tag = document.createElement('style');",
    `  tag.dataset.plugin = ${JSON.stringify(id)};`,
    '  tag.dataset.pluginCss = tagId;',
    '  tag.textContent = css;',
    '  document.head.appendChild(tag);',
    '}',
    `export default ${JSON.stringify(classMap)};`,
  ].join('\n')
}

/**
 * CSS Modules for the browser bundle, the way DSH's own client packages build them: `x.module.css`
 * resolves to a virtual module that carries the compiled stylesheet and exports the hashed class map,
 * so component code writes `css.card` instead of an inline style object.
 */
function cssModulesPlugin(id: string): Plugin {
  return {
    name: 'plugin-css-modules',
    resolveId(source, importer) {
      if (!source.endsWith('.module.css')) return null
      const abs =
        importer !== undefined && source.startsWith('.')
          ? resolvePath(dirname(importer), source)
          : source
      return CSS_VIRTUAL_PREFIX + abs + CSS_VIRTUAL_SUFFIX
    },
    async load(virtualId) {
      if (!virtualId.startsWith(CSS_VIRTUAL_PREFIX)) return null
      const fileId = virtualId.slice(CSS_VIRTUAL_PREFIX.length, -CSS_VIRTUAL_SUFFIX.length)
      // The virtual id would otherwise hide the stylesheet from the watch graph.
      this.addWatchFile(fileId)
      const { code, exports: cssExports } = transform({
        filename: fileId,
        code: await readFile(fileId),
        cssModules: { pattern: '[hash]_[local]' },
        minify: true,
      })
      // Sort the keys: `cssExports` comes back in a non-deterministic order and the emitted JSON
      // preserves insertion order — without this, identical source produces a different artifact on
      // every build, and "did the artifact change?" becomes unanswerable.
      const classMap: Record<string, string> = {}
      for (const local of Object.keys(cssExports ?? {}).sort()) {
        classMap[local] = (cssExports as Record<string, { name: string }>)[local]!.name
      }
      return styleInjectionModule(id, fileId, code.toString(), classMap)
    },
  } as Plugin
}

export default [
  {
    entry: { index: 'src/index.ts' },
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    fixedExtension: false,
    dts: true,
    clean: true,
    define: VERSION_DEFINE,
    deps: {
      neverBundle: ['@deepseek-ai/cordis', '@deepseek-ai/schemastery'],
    },
  },
  {
    entry: { client: 'src/client/index.tsx' },
    outDir: 'lib',
    format: ['cjs'],
    platform: 'browser',
    dts: false,
    clean: false,
    define: VERSION_DEFINE,
    deps: { neverBundle: [...CLIENT_EXTERNALS] },
    plugins: [cssModulesPlugin(PLUGIN_ID)],
    outputOptions: {
      entryFileNames: 'client.js',
      banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(PLUGIN_ID)}, factory: (require) => {`,
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
] satisfies UserConfig[]
