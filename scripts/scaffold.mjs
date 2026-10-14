#!/usr/bin/env node
/**
 * Plugin repository scaffold — lays a CI-passing Cordis plugin repository skeleton into an **empty**
 * directory.
 *
 * This is the **executable form** of section 3 of the plugin conventions ("standard shapes for what
 * each repository keeps"): files that must be byte-identical are copied as bytes, everything else is
 * rendered from `{{token}}` placeholders. It only **seeds**; it never writes back into an existing
 * repository, so copies stay held together by byte-identity rather than by generation from here
 * (see .agents/notes/2026-10-12-scaffold-seeds-not-syncs.md).
 *
 * Usage:
 *   node scripts/scaffold.mjs <directory> [options]
 *   node scripts/scaffold.mjs check <repo directory>...
 *
 * Options:
 *   --name <package name>            Defaults to the target directory's base name
 *   --display-name <name>            Defaults to the package name
 *   --description <one line>         Defaults to a TODO
 *   --author <author>                Defaults to `git config user.name`
 *   --license-holder <line>          Defaults to `Copyright (c) <year> <author>`; repeatable
 *   --owner <GitHub organization>    Defaults to dsh-plugin-lab
 *   --version <version>              Defaults to 0.1.0
 *   --dsh-range <SemVer range>       Defaults to today's host line (it drifts — re-check before release)
 *   --host-only                      Skip the browser half (no src/client, no client build)
 *   --dry-run                        Print what would be written, write nothing
 *   --force                          Write even when the target directory is not empty
 *   --install                        Install afterwards, producing the lockfile (unfrozen: a fresh
 *                                    directory has no lockfile for a frozen install to check)
 *   --verify                         --install, then run the checks the generated repository's own CI
 *                                    runs. Needs the network; this is the acceptance test for a
 *                                    template edit.
 *   --help
 *
 * Exit codes: 0 = success / 1 = usage error or failed validation / 2 = precondition unmet.
 *
 * Zero dependencies: `node:` built-ins only. The artifact is itself a zero-dependency repository, so
 * pulling in a dependency tree to generate it would be self-defeating.
 */

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const TEMPLATES = path.join(HERE, '..', 'templates', 'plugin')

/**
 * The recipe. One, not a choice: the family standardises on pnpm (see the package manager section of
 * the plugin conventions), and `pnpm-lock.yaml` is therefore the only lockfile a seeded repository has.
 *
 * Two installs, deliberately: CI installs frozen (the lockfile is committed by then), while a freshly
 * seeded directory has no lockfile yet and must install unfrozen to produce one.
 */
const RECIPE = {
  // `--config.node-linker=hoisted` is a correctness switch, not an optimisation: see ci.yml's header.
  installFrozen: 'pnpm install --frozen-lockfile --config.node-linker=hoisted',
  installFresh: 'pnpm install --config.node-linker=hoisted',
  run: 'pnpm run',
  builderDeps:
    ',\n    "@vitest/coverage-v8": "^4.1.11",\n    "lightningcss": "^1.33.0",\n    "tsdown": "^0.22.2"',
  buildScript: 'tsdown',
  typecheckScript: 'tsc -p tsconfig.json && tsc -p tsconfig.client.json',
  typecheckHostOnly: 'tsc -p tsconfig.json',
}

/**
 * What `--verify` runs, in order, after the install.
 *
 * These are the checks the generated repository's own CI runs, so passing here means the skeleton
 * would pass there. They are **not** a second implementation of anything: the oracle is the
 * generated repository's toolchain, which is the only thing that can catch a template that renders
 * fine but does not compile, lint or format.
 */
const VERIFY_STEPS = ['check', 'lint', 'format:check']

/**
 * Files that must be **byte-identical** across repositories.
 *
 * This is a criterion, not an implementation detail, so it is an explicit list: how these bytes get
 * written (whether a template contains `{{`) is derivable from the content, but "these must match"
 * is not.
 *
 * Deliberately **not** included, and why — both would otherwise look like identities:
 * - `.gitattributes` and `.pre-commit-config.yaml` carry prose, and the prose differs: the four
 *   repositories that already exist have it in Chinese, this template in English. They became
 *   different files the moment the template's prose was translated. Aligning the existing
 *   repositories is its own decision, not something a seeder does behind their backs.
 * - `ci.yml`, `release.yml`, `compat.yml` are byte-identical copies too, but each is either
 *   token-rendered per repository or (release / compat) not generated at all here.
 *
 * Measured 2026-10-12 over the reference repositories: `.node-version` and
 * `.github/workflows/release-drafter.yml` match across all of them; `.prettierignore` matches
 * repositories on pnpm.
 */
const IDENTITY_FILES = ['.node-version', '.github/workflows/release-drafter.yml', '.prettierignore']

const BIN = 'scaffold'

function die(message, code = 1) {
  process.stderr.write(`${BIN}: ${message}\n`)
  process.exit(code)
}

/** Recursively list every file under a directory (relative paths, sorted, so output is deterministic). */
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
 * `{{token}}` substitution.
 *
 * **Several passes**, not one: a fragment token's value (say `clientPeerDeps`) itself contains other
 * tokens (say `dshRange`), and a single pass would leave them unexpanded — while "left unexpanded"
 * and "meant to look like that" are indistinguishable in the result. So it loops until nothing
 * changes, and leaves the residual assertion to the caller.
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
 * Find `{{token}}` markers left over after rendering.
 *
 * Only **identifier-shaped** names (`\w+`) count, for two reasons:
 * 1. GitHub Actions expressions such as `${{ toJSON(needs) }}` are not placeholders.
 * 2. Neither is JSX's inline object form, `style={{ display: 'block' }}` — matching `\{\{...\}\}`
 *    naively flags every inline style in the browser half as an unexpanded marker. Measured.
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
    builderDeps: RECIPE.builderDeps,
    buildScript: RECIPE.buildScript,
    typecheckScript: hostOnly ? RECIPE.typecheckHostOnly : RECIPE.typecheckScript,
    clientPeerDeps,
    clientDevDeps,
    clientExport,
    dshClient,
  }
}

/**
 * Marker for "belongs to the browser half only".
 *
 * A **slice, not a layer**: the two halves have to stay orthogonal, so it lives inside the tree rather
 * than as a second top-level directory. With one recipe there is nothing for a top-level layer to
 * slice against anymore — `--host-only` now means "drop the `_client/` files", and nothing else.
 */
const CLIENT_MARKER = '_client/'

/**
 * Pure function: decide which files get written. Reads the template tree only; never touches the target.
 *
 * One layer, so there is no override decision to make and therefore no way for a file to come from two
 * places: the previous guard for that case was unreachable once the second recipe went away.
 */
function plan(opts) {
  const layer = '_common'
  const root = path.join(TEMPLATES, layer)
  if (!fs.existsSync(root)) die(`template layer does not exist: templates/plugin/${layer}`, 2)

  const files = []
  for (const raw of walk(root)) {
    const clientOnly = raw.startsWith(CLIENT_MARKER)
    if (clientOnly && opts.hostOnly) continue
    const rel = clientOnly ? raw.slice(CLIENT_MARKER.length) : raw
    files.push({ layer, rel, src: path.join(root, raw) })
  }
  return files
}

/**
 * Commit to disk.
 *
 * **Two phases**: render and validate everything in memory first, then write. A single phase (render
 * and write as you go) leaves **half a repository** behind when one template has an unexpanded
 * marker — and half a repository is worse than an empty directory: it looks like it worked, and a
 * rerun is refused by "target is not empty". Measured once.
 */
function write(files, destDir, ctx, { force }) {
  if (fs.existsSync(destDir) && !force) {
    const entries = fs.readdirSync(destDir).filter((name) => name !== '.git')
    if (entries.length > 0) {
      die(
        `target directory is not empty: ${destDir}\n` +
          `(the scaffold is for empty directories; pass --force to write anyway)`,
      )
    }
  }

  // Phase one: render everything and validate everything. This phase **does not touch the target**.
  const outputs = []
  let copied = 0
  let rendered = 0
  for (const file of files) {
    const raw = fs.readFileSync(file.src, 'utf8')
    if (!raw.includes('{{')) {
      // An identity file: copy the bytes, without even rendering them in memory — which is what makes
      // "byte-identical" auditable at the code level.
      outputs.push({ rel: file.rel, bytes: fs.readFileSync(file.src) })
      copied += 1
      continue
    }
    const out = render(raw, ctx)
    const leftover = leftoverTokens(out)
    if (leftover.length > 0) {
      die(
        `template ${file.layer}/${file.rel} has unexpanded markers: ${leftover.join(' ')}\n` +
          `(either supply the matching ctx field, or it was never a placeholder)\n` +
          `nothing was written to the target directory.`,
      )
    }
    outputs.push({ rel: file.rel, bytes: Buffer.from(out, 'utf8') })
    rendered += 1
  }

  // Structural validation also belongs to phase one: produced JSON has to actually parse.
  // This one was **forced by measurement**: a fragment token missing a comma still renders
  // "successfully" and yields a package.json that is not valid JSON — and that only explodes at
  // `npm install`, by which point attention has moved on. Parsing JSON here costs milliseconds.
  //
  // **Exception: tsconfig*.json is JSONC.** TypeScript permits comments there and every reference
  // repository writes them, so judging those with strict JSON would convict the innocent. The
  // exception is named here rather than turning the rule into an allowlist: newly added JSON is
  // validated by default, and a miss is far more dangerous than a false alarm.
  for (const output of outputs) {
    if (!output.rel.endsWith('.json')) continue
    if (/^tsconfig(\.[\w.-]+)?\.json$/.test(output.rel)) continue
    try {
      JSON.parse(output.bytes.toString('utf8'))
    } catch (error) {
      die(
        `${output.rel} produced by the template is not valid JSON: ${error.message}\n` +
          `nothing was written to the target directory.`,
      )
    }
  }

  // Phase two: write.
  for (const output of outputs) {
    const dest = path.join(destDir, output.rel)
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    fs.writeFileSync(dest, output.bytes)
  }
  process.stdout.write(
    `wrote ${files.length} files (byte copies ${copied}, rendered ${rendered})\n`,
  )
}

function check(repos) {
  if (repos.length === 0) die('check needs one or more repository directories', 1)

  // One source per file: a single layer means there is no variant to match against.
  const sources = new Map()
  for (const rel of IDENTITY_FILES) sources.set(rel, path.join(TEMPLATES, '_common', rel))

  const missing = IDENTITY_FILES.filter((rel) => !fs.existsSync(sources.get(rel)))
  if (missing.length > 0) {
    die(`these files should be byte-identical but are missing from the templates: ${missing.join(', ')}`, 2)
  }

  let bad = 0
  for (const repo of repos) {
    if (!fs.existsSync(repo)) die(`repository directory does not exist: ${repo}`, 2)
    process.stdout.write(`\n${repo}\n`)
    for (const rel of IDENTITY_FILES) {
      const target = path.join(repo, rel)
      if (!fs.existsSync(target)) {
        process.stdout.write(`  MISSING  ${rel}\n`)
        bad += 1
        continue
      }
      if (sha256(target) === sha256(sources.get(rel))) {
        process.stdout.write(`  OK       ${rel}\n`)
      } else {
        process.stdout.write(`  DIFF     ${rel}\n`)
        bad += 1
      }
    }
  }

  process.stdout.write(
    `\nverdict: ${bad === 0 ? 'all byte-identical' : `${bad} differ`}\n` +
      `A difference is not necessarily a defect — some of these files carry per-repository\n` +
      `parameters (semicolons, lockfile name). The point is to *know* it differs, not to force it equal.\n`,
  )
  if (bad > 0) process.exit(1)
}

function usage() {
  process.stdout.write(
    `${BIN} — lay a Cordis plugin repository skeleton into an empty directory\n\n` +
      `  node scripts/scaffold.mjs <directory> [options]\n` +
      `  node scripts/scaffold.mjs check <repo directory>...\n\n` +
      `Options:\n` +
      `  --name / --display-name / --description / --author / --license-holder\n` +
      `  --owner / --version / --dsh-range\n` +
      `  --host-only     skip the browser half\n` +
      `  --dry-run       print what would be written, write nothing\n` +
      `  --force         write even when the target is not empty\n` +
      `  --install       install afterwards, producing the lockfile\n` +
      `  --verify        --install, then run the generated repository's own CI checks\n`,
  )
}

function parseCliArgs(argv) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      name: { type: 'string' },
      'display-name': { type: 'string' },
      description: { type: 'string' },
      author: { type: 'string' },
      'license-holder': { type: 'string', multiple: true },
      owner: { type: 'string', default: 'dsh-plugin-lab' },
      version: { type: 'string', default: '0.1.0' },
      // A **drifting value**: the default is only "today's line" and has to be re-checked before release.
      'dsh-range': { type: 'string', default: '^0.1.7-rc.1 || ^0.2.0-rc.1' },
      'host-only': { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
      force: { type: 'boolean', default: false },
      install: { type: 'boolean', default: false },
      verify: { type: 'boolean', default: false },
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

/**
 * Run one command line in the target directory, loudly.
 *
 * The output is inherited rather than captured: a captured failure that ends up empty reads exactly
 * like a pass, and this script exists to make template rot loud.
 *
 * `shell` only on Windows, where `npm` / `pnpm` are `.cmd` shims that `spawnSync` cannot find by
 * itself. That is the single platform branch in this file.
 */
function run(command, cwd, failureNote) {
  process.stdout.write(`\n$ ${command}\n`)
  const [bin, ...args] = command.split(' ')
  const result = spawnSync(bin, args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  if (result.status !== 0) die(`${failureNote} (${command})`, 2)
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
    die('no target directory given', 1)
  }

  const target = path.resolve(dest)
  const name = values.name ?? path.basename(target)
  const author = values.author ?? gitUserName()
  const year = new Date().getFullYear()

  const opts = {
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
    process.stdout.write(`would write ${files.length} files to ${target}:\n`)
    for (const file of files) process.stdout.write(`  ${file.rel}\n`)
    return
  }

  write(files, target, buildContext(opts), { force: values.force })

  // `--verify` implies `--install`: there is nothing to check without a dependency tree.
  if (values.install || values.verify) {
    run(RECIPE.installFresh, target, 'install failed — no lockfile was produced, and CI goes red')

    if (values.verify) {
      for (const step of VERIFY_STEPS) {
        run(`${RECIPE.run} ${step}`, target, `${step} failed on the generated repository`)
      }
      process.stdout.write(`\nverified: ${VERIFY_STEPS.join(', ')} all green\n`)
    }
  }

  process.stdout.write(
    `\nnext steps (the scaffold does not do these for you):\n` +
      `  1. Replace icon.svg — it is a placeholder shape, and publishing needs artwork you made or\n` +
      `     are licensed to use. Follow the icon criteria in the plugin conventions.\n` +
      `  2. Write the "What it offers" section of README.md, and every TODO in AGENTS.md.\n` +
      `  3. Adjust the dependency list to the host services actually used — the starting set is\n` +
      `     unverified, and none of it was validated against this plugin.\n` +
      `  4. Install and run \`${RECIPE.run} check\`.\n`,
  )
}

main()
