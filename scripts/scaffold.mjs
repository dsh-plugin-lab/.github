#!/usr/bin/env node
/**
 * 插件仓脚手架 —— 给**空目录**铺一个能过 CI 的 Cordis 插件仓骨架。
 *
 * 这是[插件通用约定](../../docs/plugin-conventions.md)第三节「各仓自持各件的标准形状」的
 * **可执行形态**：把「逐字相同」「形状固定」两类分开处理，逐字件走字节拷贝，
 * 其余走 `{{token}}` 替换。它只**播种**，不回写已存在的仓 —— 副本之间照旧靠逐字相同互相约束，
 * 不由这里生成（见 [.agents/notes/2026-10-12-scaffold-seeds-not-syncs.md]）。
 *
 * 用法：
 *   node scripts/scaffold.mjs <目录> [选项]
 *   node scripts/scaffold.mjs check <仓目录>...
 *
 * 选项：
 *   --profile <npm-tsc|pnpm-tsdown>  构建/包管理器配方，默认 npm-tsc
 *   --name <包名>                    默认取目标目录名
 *   --display-name <显示名>          默认等于包名
 *   --description <一句话>           默认留 TODO
 *   --author <作者>                  默认取 git config user.name
 *   --license-holder <署名行>        默认 `Copyright (c) <年> <作者>`，可重复传入多行
 *   --owner <GitHub 组织>            默认 dsh-plugin-lab
 *   --version <版本号>               默认 0.1.0
 *   --dsh-range <SemVer 区间>        默认当前宿主兼容线（会漂，发布前现核）
 *   --host-only                      不生成浏览器半边（无 src/client、无 client 构建）
 *   --dry-run                        只打印将要写什么
 *   --force                          目标目录非空时也写
 *   --install                        写完后跑一次冻结安装，产出锁文件
 *   --help
 *
 * 退出码：0 = 成功 / 1 = 用法错或校验失败 / 2 = 前置条件不满足。
 *
 * 零依赖：只用 node: 内建模块。产物本身是零依赖仓，用一堆依赖去生成它自相矛盾。
 */

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const TEMPLATES = path.join(HERE, '..', 'templates', 'plugin')

/** 配方。改动这里就等于改所有新仓的起点。 */
const PROFILES = {
  'npm-tsc': {
    pm: 'npm',
    install: 'npm ci',
    run: 'npm run',
    pmSetup: '',
    builderDeps: ',\n    "esbuild": "^0.28.2"',
    buildScript: 'tsc && tsc -p tsconfig.client.json && node scripts/build-client.mjs',
    buildScriptHostOnly: 'tsc',
    typecheck:
      'tsc --noEmit && tsc -p tsconfig.client.json --noEmit && tsc -p tsconfig.test.json',
    typecheckHostOnly: 'tsc --noEmit && tsc -p tsconfig.test.json',
  },
  'pnpm-tsdown': {
    pm: 'pnpm',
    install: 'pnpm install --frozen-lockfile --config.node-linker=hoisted',
    run: 'pnpm run',
    pmSetup:
      '      # pnpm 必须在 setup-node 之前装好，`cache: pnpm` 才找得到 store。\n' +
      '      - uses: pnpm/action-setup@v4\n' +
      '        with:\n' +
      '          version: 11\n',
    builderDeps:
      ',\n    "@vitest/coverage-v8": "^4.1.11",\n    "lightningcss": "^1.33.0",\n    "tsdown": "^0.22.2"',
    buildScript: 'tsdown',
    buildScriptHostOnly: 'tsdown',
    typecheck: 'tsc -p tsconfig.json && tsc -p tsconfig.client.json',
    typecheckHostOnly: 'tsc -p tsconfig.json',
  },
}

/**
 * 跨仓**必须逐字节相同**的文件。
 *
 * 这是判据，不是实现细节，所以写成显式清单 —— 与「怎么写出这些字节」（含不含 `{{`）
 * 是两件事，后者可以从模板内容推出来，前者不能。
 *
 * 取值依据（2026-10-12 实测三仓）：前三条三仓逐字相同；后两条在**同一个包管理器**的
 * 仓之间逐字相同（npm 与 pnpm 各一份），所以比对时接受任一变体。
 */
const IDENTITY_FILES = [
  '.gitattributes',
  '.node-version',
  '.github/workflows/release-drafter.yml',
  '.pre-commit-config.yaml',
  '.prettierignore',
]

const BIN = 'scaffold'

function die(message, code = 1) {
  process.stderr.write(`${BIN}: ${message}\n`)
  process.exit(code)
}

/** 递归列出目录下所有文件（相对路径、排序，保证输出确定）。 */
function walk(root, prefix = '') {
  const out = []
  for (const entry of fs.readdirSync(root, { withFileTypes: true }).sort((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
  )) {
    const rel = prefix === '' ? entry.name : `${prefix}/${entry.name}`
    if (entry.isDirectory()) out.push(...walk(path.join(root, entry.name), rel))
    else if (entry.isFile()) out.push(rel)
  }
  return out
}

function sha256(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex')
}

/**
 * `{{token}}` 替换。
 *
 * **多趟**而不是一趟：片段型 token（如 `clientPeerDeps`）的值里还含别的 token
 * （如 `dshRange`），一趟替换完会留下未展开的记号 —— 而「未展开」与「本来就该长这样」
 * 在结果里长得一样。所以循环到不再变化为止，再断言没有已知 token 残留。
 */
function render(content, ctx) {
  let out = content
  for (let pass = 0; pass < 5; pass += 1) {
    let changed = false
    for (const [key, value] of Object.entries(ctx)) {
      const token = `{{${key}}}`
      if (!out.includes(token)) continue
      out = out.split(token).join(value)
      changed = true
    }
    if (!changed) break
  }
  return out
}

/**
 * 找出渲染后仍然残留的 `{{token}}` 记号。
 *
 * 只认**标识符形状**的名字（`\w+`），两个原因：
 * ① GitHub Actions 的表达式 `${{ toJSON(needs) }}` 不是占位符；
 * ② JSX 的内联对象 `style={{ display: 'block' }}` **也不是** —— 它是双花括号语法，
 *    天真地匹配 `\{\{...\}\}` 会把每一处 JSX 内联样式都判成未展开的记号（实测踩过）。
 */
function leftoverTokens(content) {
  const found = []
  for (const match of content.matchAll(/\{\{(\w+)\}\}/g)) {
    if (match.index > 0 && content[match.index - 1] === '$') continue
    found.push(match[0])
  }
  return found
}

function buildContext(opts) {
  const profile = PROFILES[opts.profile]
  const hostOnly = opts.hostOnly
  const client = !hostOnly

  const clientPeerDeps = client
    ? [
        ',',
        `    "@deepseek-ai/dsh-client-ui-plugin-manager": "{{dshRange}}",`,
        `    "@deepseek-ai/dsh-client-ui-slots": "{{dshRange}}",`,
        '    "react": "^18.3.1",',
        '    "react-dom": "^18.3.1"',
      ].join('\n')
    : ''

  const clientDevDeps = client
    ? [
        ',',
        `    "@deepseek-ai/dsh-client-ui-plugin-manager": "{{dshRange}}",`,
        `    "@deepseek-ai/dsh-client-ui-slots": "{{dshRange}}",`,
        '    "@types/react": "~18.3.1",',
        '    "@types/react-dom": "~18.3.7",',
        '    "react": "^18.3.1",',
        '    "react-dom": "^18.3.1"',
      ].join('\n')
    : ''

  const clientExport = client
    ? [
        ',',
        '    "./client": {',
        '      "types": "./lib/types/client/index.d.ts",',
        '      "default": "./lib/client.js"',
        '    }',
      ].join('\n')
    : ''

  const dshClient = client
    ? [
        ',',
        '    "client": {',
        '      "platform": "web",',
        '      "inject": [',
        '        "@deepseek-ai/dsh-client-ui-plugin-manager"',
        '      ]',
        '    }',
      ].join('\n')
    : ''

  return {
    name: opts.name,
    displayName: opts.displayName,
    description: opts.description,
    author: opts.author,
    licenseHolder: opts.licenseHolder.join('\n'),
    owner: opts.owner,
    version: opts.version,
    dshRange: opts.dshRange,
    pm: profile.pm,
    install: profile.install,
    run: profile.run,
    pmSetup: profile.pmSetup,
    builderDeps: profile.builderDeps,
    buildScript: hostOnly ? profile.buildScriptHostOnly : profile.buildScript,
    typecheckScript: hostOnly ? profile.typecheckHostOnly : profile.typecheck,
    clientPeerDeps,
    clientDevDeps,
    clientExport,
    dshClient,
  }
}

/**
 * 「只属于浏览器半边」的标记。
 *
 * 为什么是**目录内的子目录**而不是顶层加一层：切片要正交。
 * 顶层加 `_client` 一层的话，`--host-only` 就得「跳过一个顶层层」，
 * 而 tsconfig.client.json / build-client.mjs 是**按包管理器不同**的 ——
 * 它们必须同时属于「client 切片」和「配方切片」，二维的切片塞不进一维的层序。
 * 放在每一层内部的 `_client/` 下，两个维度就都表达得出来。
 */
const CLIENT_MARKER = '_client/'

/** 纯函数：决定写哪些文件。只读模板目录，不碰目标目录。 */
function plan(opts) {
  const layers = ['_common', `_${opts.profile}`]

  const files = []
  const seen = new Map()
  for (const layer of layers) {
    const root = path.join(TEMPLATES, layer)
    if (!fs.existsSync(root)) die(`模板层不存在：templates/plugin/${layer}`, 2)
    for (const raw of walk(root)) {
      const clientOnly = raw.startsWith(CLIENT_MARKER)
      if (clientOnly && opts.hostOnly) continue
      const rel = clientOnly ? raw.slice(CLIENT_MARKER.length) : raw
      if (seen.has(rel)) {
        die(
          `模板层冲突：${rel} 同时来自 ${seen.get(rel)} 与 ${layer}/${raw} —— ` +
            `叠层只允许补充，不允许覆盖（覆盖会静默决定哪一个生效）`,
        )
      }
      seen.set(rel, `${layer}/${raw}`)
      files.push({ layer, rel, src: path.join(root, raw) })
    }
  }
  return files
}

/**
 * 落盘。
 *
 * **两段式**：先把全部文件在内存里渲染完并校验，再统一写。
 * 一段式（边渲染边写）在某个模板有未展开记号时，会在目标目录留下**半个仓** ——
 * 而半个仓比空目录更坏：它看起来像成了，且下次重跑会被「目标非空」挡住。
 * 实测踩过这一次。
 */
function write(files, destDir, ctx, { force }) {
  if (fs.existsSync(destDir) && !force) {
    const entries = fs.readdirSync(destDir).filter((name) => name !== '.git')
    if (entries.length > 0) {
      die(`目标目录非空：${destDir}\n（脚手架只给空目录用；确要写进去请加 --force）`)
    }
  }

  // 第一段：全部渲染 + 全部校验。这一段**不碰目标目录**。
  const outputs = []
  let copied = 0
  let rendered = 0
  for (const file of files) {
    const raw = fs.readFileSync(file.src, 'utf8')
    if (!raw.includes('{{')) {
      // 逐字件：拷字节，连进内存渲染都不做 —— 「逐字相同」在代码层面因此可审计。
      outputs.push({ rel: file.rel, bytes: fs.readFileSync(file.src) })
      copied += 1
      continue
    }
    const out = render(raw, ctx)
    const leftover = leftoverTokens(out)
    if (leftover.length > 0) {
      die(
        `模板 ${file.layer}/${file.rel} 里有未展开的记号：${leftover.join(' ')}\n` +
          `（要么补齐对应的 ctx 字段，要么它本来就不是占位符）\n` +
          `目标目录未被写入。`,
      )
    }    outputs.push({ rel: file.rel, bytes: Buffer.from(out, 'utf8') })
    rendered += 1
  }

  // 结构校验也放在第一段：产物里的 JSON 必须真的能解析。
  // 这一条是**实测逼出来的**：片段型 token 少写一个逗号，渲染照样「成功」，
  // 生成的是一个 JSON 语法都不对的 package.json —— 而它要到 `npm install` 才炸，
  // 那时人已经在看别的了。JSON 校验在这里是秒级的，所以在写盘前做。
  //
  // **例外：tsconfig*.json 走 JSONC**（TypeScript 官方允许注释，三个参考仓也都写了注释），
  // 用严格 JSON 去判它们会冤枉好人。例外写在这里而不是反过来列白名单：
  // 新加的 JSON 默认**被校验**，漏判比误判危险得多。
  for (const output of outputs) {
    if (!output.rel.endsWith('.json')) continue
    if (/^tsconfig(\.[\w.-]+)?\.json$/.test(output.rel)) continue
    try {
      JSON.parse(output.bytes.toString('utf8'))
    } catch (error) {
      die(`模板产出的 ${output.rel} 不是合法 JSON：${error.message}\n目标目录未被写入。`)
    }
  }

  // 第二段：写。
  for (const output of outputs) {
    const dest = path.join(destDir, output.rel)
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    fs.writeFileSync(dest, output.bytes)
  }
  process.stdout.write(`写入 ${files.length} 个文件（逐字拷贝 ${copied}，替换 ${rendered}）\n`)
}

function check(repos) {
  if (repos.length === 0) die('check 需要一个或多个仓目录', 1)

  // 变体：同一个文件在不同层里可能有多个来源（npm / pnpm 各一份），任一命中即算相同。
  const variants = new Map()
  for (const layer of fs.readdirSync(TEMPLATES).sort()) {
    const root = path.join(TEMPLATES, layer)
    if (!fs.statSync(root).isDirectory()) continue
    for (const rel of walk(root)) {
      if (!IDENTITY_FILES.includes(rel)) continue
      if (!variants.has(rel)) variants.set(rel, [])
      variants.get(rel).push({ layer, src: path.join(root, rel) })
    }
  }

  const missing = IDENTITY_FILES.filter((rel) => !variants.has(rel))
  if (missing.length > 0) die(`模板里找不到这些应当逐字相同的文件：${missing.join(', ')}`, 2)

  let bad = 0
  for (const repo of repos) {
    if (!fs.existsSync(repo)) die(`仓目录不存在：${repo}`, 2)
    process.stdout.write(`\n${repo}\n`)
    for (const rel of IDENTITY_FILES) {
      const target = path.join(repo, rel)
      if (!fs.existsSync(target)) {
        process.stdout.write(`  MISSING  ${rel}\n`)
        bad += 1
        continue
      }
      const got = sha256(target)
      const hit = variants.get(rel).find((v) => sha256(v.src) === got)
      if (hit) {
        process.stdout.write(`  OK       ${rel}  (匹配 ${hit.layer})\n`)
      } else {
        const layers = variants.get(rel).map((v) => v.layer).join(' / ')
        process.stdout.write(`  DIFF     ${rel}  (与 ${layers} 都不同)\n`)
        bad += 1
      }
    }
  }

  process.stdout.write(
    `\n判定：${bad === 0 ? '全部逐字相同' : `${bad} 处不一致`}\n` +
      `不一致不必然是缺陷 —— 这几个文件里有些是逐仓参数（分号、锁文件名）。\n` +
      `要的是「知道它不同」，不是「强行一样」。\n`,
  )
  if (bad > 0) process.exit(1)
}

function usage() {
  process.stdout.write(
    `${BIN} —— 给空目录铺一个 Cordis 插件仓骨架\n\n` +
      `  node scripts/scaffold.mjs <目录> [选项]\n` +
      `  node scripts/scaffold.mjs check <仓目录>...\n\n` +
      `选项：\n` +
      `  --profile <npm-tsc|pnpm-tsdown>  默认 npm-tsc\n` +
      `  --name / --display-name / --description / --author / --license-holder\n` +
      `  --owner / --version / --dsh-range\n` +
      `  --host-only    不生成浏览器半边\n` +
      `  --dry-run      只打印将要写什么\n` +
      `  --force        目标非空也写\n` +
      `  --install      写完跑一次冻结安装，产出锁文件\n`,
  )
}

function parseCliArgs(argv) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      profile: { type: 'string', default: 'npm-tsc' },
      name: { type: 'string' },
      'display-name': { type: 'string' },
      description: { type: 'string' },
      author: { type: 'string' },
      'license-holder': { type: 'string', multiple: true },
      owner: { type: 'string', default: 'dsh-plugin-lab' },
      version: { type: 'string', default: '0.1.0' },
      // 这是**会漂的值**：默认值只是「今天这条线」，发布前要现核。
      'dsh-range': { type: 'string', default: '^0.1.7-rc.1 || ^0.2.0-rc.1' },
      'host-only': { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
      force: { type: 'boolean', default: false },
      install: { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
  })
  return { values, positionals }
}

function gitUserName() {
  const result = spawnSync('git', ['config', 'user.name'], { encoding: 'utf8' })
  const name = (result.stdout ?? '').trim()
  return name === '' ? 'TODO' : name
}

function main() {
  const { values, positionals } = parseCliArgs(process.argv.slice(2))

  if (values.help) {
    usage()
    return
  }

  if (positionals[0] === 'check') {
    check(positionals.slice(1).map((p) => path.resolve(p)))
    return
  }

  const dest = positionals[0]
  if (dest === undefined) {
    usage()
    die('缺少目标目录', 1)
  }
  if (!(values.profile in PROFILES)) {
    die(`未知配方：${values.profile}（可选：${Object.keys(PROFILES).join(' / ')}）`, 1)
  }

  const target = path.resolve(dest)
  const name = values.name ?? path.basename(target)
  const author = values.author ?? gitUserName()
  const year = new Date().getFullYear()

  const opts = {
    profile: values.profile,
    name,
    displayName: values['display-name'] ?? name,
    description: values.description ?? 'TODO: one line on what this plugin does.',
    author,
    licenseHolder: values['license-holder'] ?? [`Copyright (c) ${year} ${author}`],
    owner: values.owner,
    version: values.version,
    dshRange: values['dsh-range'],
    hostOnly: values['host-only'],
  }

  const files = plan(opts)

  if (values['dry-run']) {
    process.stdout.write(`将写入 ${target}（${files.length} 个文件，配方 ${opts.profile}）：\n`)
    for (const file of files) process.stdout.write(`  ${file.rel}\n`)
    return
  }

  write(files, target, buildContext(opts), { force: values.force })

  if (values.install) {
    const profile = PROFILES[opts.profile]
    const [command, ...args] = profile.install.split(' ')
    process.stdout.write(`\n${profile.install}\n`)
    const result = spawnSync(command, args, { cwd: target, stdio: 'inherit', shell: process.platform === 'win32' })
    if (result.status !== 0) die('安装失败 —— 锁文件没产出，CI 的冻结安装会直接红', 2)
  }

  process.stdout.write(
    `\n下一步（脚手架不替你做）：\n` +
      `  1. 换掉 icon.svg（现在是一个占位图形，发布前必须是自制或有授权的图）\n` +
      `  2. 写 README.md 的「提供什么」一节，以及 AGENTS.md 里每一个 TODO\n` +
      `  3. 依赖清单按实际用到的宿主服务改（现在只有起步那几条，没有一条是验证过的）\n` +
      `  4. 装依赖并跑 \`${PROFILES[opts.profile].run} check\`\n`,
  )
}

main()
