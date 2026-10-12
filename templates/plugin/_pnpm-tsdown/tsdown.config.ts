import { transform } from 'lightningcss'
import type { Plugin, UserConfig } from 'tsdown'
import { readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { basename, dirname, resolve as resolvePath } from 'node:path'

const PLUGIN_ID = '{{name}}'

/** 读一次版本号，让 `src/version.ts` 在构建期拿到它。 */
const PACKAGE_VERSION = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))
  .version as string

/** 构建期占位符；`src/version.ts` 读 `__DSH_PLUGIN_VERSION__`。 */
const VERSION_DEFINE = { __DSH_PLUGIN_VERSION__: JSON.stringify(PACKAGE_VERSION) }

/**
 * 宿主提供的模块，一律不进浏览器包。
 *
 * 这张清单是**护栏，不是文档**：被值导入却没写在这里的模块会被**内联**，
 * 而内联一份 React 运行时是致命的，不只是变胖 —— react-dom 的模块作用域读
 * `process.env.NODE_ENV`，内联后包会胀到 1MB 并在浏览器里报 `process is not defined`，
 * 插件直接激活失败，而宿主只会报一句 import error。
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
 * 虚拟 id 后缀。tsdown 自己的 CSS 护栏按 `.css` 结尾匹配，所以虚拟 id 不能以它结尾 ——
 * 整个目的就是把模块 CSS 挡在那条需要 `@tsdown/css` 的流水线之外。
 */
const CSS_VIRTUAL_PREFIX = '\0plugin-css:'
const CSS_VIRTUAL_SUFFIX = '.js'

/**
 * 产出一个 CSS Modules 模块：在工厂执行时注入样式表，并导出类名映射。
 *
 * 样式标签按 `data-plugin-css` 幂等：浏览器包每个 DSH 页面只加载一次，
 * 但热重载或第二个插件挂载同一模块时不能重复堆规则。
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
 * 浏览器包的 CSS Modules：与 DSH 自己的客户端包同形 —— `x.module.css` 解析成一个
 * 虚拟模块，携带编译后的样式表并导出哈希类名，组件里写 `css.card` 而不是内联样式对象。
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
      // 虚拟 id 否则会把样式表藏出 watch 图。
      this.addWatchFile(fileId)
      const { code, exports: cssExports } = transform({
        filename: fileId,
        code: await readFile(fileId),
        cssModules: { pattern: '[hash]_[local]' },
        minify: true,
      })
      // 键要排序：`cssExports` 的返回顺序不确定，而产出的 JSON 保留插入顺序 ——
      // 不排的话同一份源码每次构建都会得到不同的产物，「产物变了吗」这个问题就没法回答。
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
