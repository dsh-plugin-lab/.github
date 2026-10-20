#!/usr/bin/env node
/**
 * Check that the criteria in docs/criteria.md still hold across every plugin repository.
 *
 * The criteria document makes claims about other repositories: "each repository carries a redline
 * assertion for this", "the lockfile's URLs point at the official registry". Nothing in this
 * organization could verify those claims — the plugin repositories' own CI sees one repository each,
 * and this one had no CI at all. A claim with no execution body rots silently, which is the failure
 * the criteria document itself is written against.
 *
 * So this checks the **machine-decidable subset only**, in four groups:
 *
 *   - package.json  — what a repository declares about itself;
 *   - package contents — what it would ship;
 *   - lockfile      — where its dependencies come from;
 *   - workflows     — what its release actually does.
 *
 * It deliberately does **not** check what cannot be decided from files:
 *
 *   - whether a merged version actually reached npm (that needs the registry, and the market's
 *     drift report already looks at it);
 *   - how the tooling behaves when a peer is missing, or which TypeScript switches should be on
 *     (those are judgements about a running build);
 *   - anything repository-specific. The plugin repositories hold far more assertions than this file
 *     lists on purpose — a plugin's own redlines are its business, and re-checking them here would
 *     duplicate 9,000 lines to gain nothing.
 *
 * Usage:
 *   node scripts/check-criteria.mjs                    # report; exit 1 on a **new** finding
 *   node scripts/check-criteria.mjs --org <name>       # another organization
 *   node scripts/check-criteria.mjs --json             # machine-readable
 *   node scripts/check-criteria.mjs --json-out <file>  # also write the report as JSON
 *   node scripts/check-criteria.mjs --update-baseline  # rewrite redlines-baseline.json from today
 *   node scripts/check-criteria.mjs --trace            # show fetching and cache reuse
 *
 * Exits 1 only for a finding that is **not** in known-findings.json. A tracked finding is printed
 * and keeps the tracking issue open, but it does not fail the run: a run that is red every week for
 * a known reason is indistinguishable from a run that is red because something broke.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { discoverPlugins } from './lib/discover.mjs'
import { judgeTsconfigFloor } from './lib/tsconfig-floor.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const BASELINE = join(ROOT, 'redlines-baseline.json')
const KNOWN_FINDINGS = join(ROOT, 'known-findings.json')

const argv = process.argv.slice(2)
const flag = (name) => argv.includes(name)
const option = (name, fallback) => {
  const index = argv.indexOf(name)
  return index === -1 ? fallback : argv[index + 1]
}

const ORG = option('--org', 'dsh-plugin-lab')

// --- helpers ---------------------------------------------------------------------------------

const line = (message) => process.stdout.write(`${message}\n`)

/** Count the `describe(` / `it(` calls in a test file. Cheap, and enough to notice a deletion. */
function countTests(source) {
  const describe = (source.match(/^\s*describe\s*\(/gmu) ?? []).length
  const it = (source.match(/^\s*(?:it|test)\s*\(/gmu) ?? []).length
  return { describe, it }
}

/**
 * A semver range we accept as an engines declaration.
 *
 * A union of ranges is the normal shape here (`^a || ^b || ^c` — one family per line the family
 * supports), and prerelease tags carry letters (`-rc.1`). Neither is a defect, so each alternative
 * is validated on its own after splitting, not against one flat character class.
 */
const SEMVER_ALTERNATIVE = /^[~^]?v?\d+(?:\.(?:\d+|[xX*])){0,2}(?:-[0-9A-Za-z][0-9A-Za-z.-]*)?$/u

function isSemverRange(value) {
  if (typeof value !== 'string' || value.trim() === '') return false
  if (value.includes('workspace:')) return false
  return value.split('||').every((part) => SEMVER_ALTERNATIVE.test(part.trim()))
}

/**
 * A workflow source with its YAML comments removed.
 *
 * Comments are where these workflows explain the very traps they guard against — "`npm version`
 * adds a v, so we add the prefix ourselves", "there is no NPM_TOKEN". Grepping the raw file reports
 * the explanation as the violation.
 */
function withoutComments(source) {
  return source
    .split('\n')
    .map((text) => {
      const index = text.indexOf('#')
      return index === -1 ? text : text.slice(0, index)
    })
    .join('\n')
}

/** Every `http(s)` URL in a lockfile. pnpm v9 records integrity, not tarball URLs — so any URL at
 *  all is a leftover from a lockfile generated against a mirror. */
function urlsIn(text) {
  return [...new Set(text.match(/https?:\/\/[^\s"',)]+/gu) ?? [])]
}


/**
 * A `tsconfig*.json` parsed whole — `compilerOptions` *and* `extends` — tolerating the comments and
 * trailing commas editors and humans leave in one. `JSON.parse` alone rejects both, and reading a
 * config is not the place to insist on a dialect the file is not required to be written in.
 *
 * Returns the whole document rather than just `compilerOptions` because whether a config inherits
 * decides whether it is judged at all: a file that `extends` another gets its switches from there.
 */
function parsedConfigOf(source) {
  const stripped = source
    // Line comments, but not the `//` inside a URL string.
    .replace(/^\s*\/\/.*$/gmu, '')
    .replace(/\/\*[\s\S]*?\*\//gu, '')
    .replace(/,(\s*[}\]])/gu, '$1')
  try {
    return JSON.parse(stripped)
  } catch {
    return undefined
  }
}

// --- the checks ------------------------------------------------------------------------------
//
// `id` is what the report prints; `criterion` is a short paraphrase of the row in docs/criteria.md
// so a failure can be traced back to the rule that was broken.

const CHECKS = [
  {
    id: 'package-inputs',
    criterion: 'A published package carries the four inputs (§2): locale with an en entry, a declared icon shipped by files, engines.dsh, author',
    group: 'package.json',
    async run(repository) {
      const { manifest, read, hasTopLevel } = repository
      const problems = []

      const locale = await read('locale/en.json')
      if (locale === undefined) problems.push('locale/en.json is missing')
      else {
        try {
          const parsed = JSON.parse(locale)
          if (!parsed?.meta?.title) problems.push('locale/en.json has no meta.title')
          if (!parsed?.meta?.description) problems.push('locale/en.json has no meta.description')
        } catch {
          problems.push('locale/en.json is not valid JSON')
        }
      }

      const icon = manifest.icon
      if (typeof icon !== 'string' || icon === '') problems.push('package.json declares no icon')
      else {
        const iconPath = icon.replace(/^\.\//u, '')
        if (!(await hasTopLevel(iconPath))) problems.push(`icon "${icon}" does not exist`)
        const files = manifest.files ?? []
        if (!files.includes(iconPath)) problems.push(`files does not list "${iconPath}"`)
      }

      if (!isSemverRange(manifest.engines?.dsh)) problems.push('engines.dsh is missing or is not a SemVer range')
      if (typeof manifest.author !== 'string' && typeof manifest.author !== 'object') problems.push('package.json declares no author')

      return problems
    },
  },
  {
    id: 'package-not-readme-images',
    criterion: 'A published package does not carry the images only the README shows; they live in the repository and are referenced relatively',
    group: 'package contents',
    async run(repository) {
      const { manifest, read } = repository
      const problems = []
      const files = manifest.files ?? []

      // Two ways to get this wrong, and the second one is the quiet one:
      //  - listing nothing from assets/ while the README shows images from it is fine (they live in
      //    the repository, and both surfaces that render a README resolve the relative path);
      //  - listing the whole directory and negating the current images means the *next* screenshot
      //    ships by default. The published exception is a list of specific files, not of the
      //    directory, precisely so that adding an image cannot silently enter the package.
      if (files.includes('assets') || files.includes('assets/')) {
        const negations = files.filter((entry) => entry.startsWith('!assets/'))
        problems.push(
          negations.length === 0
            ? 'files ships the whole assets/ directory'
            : `files ships the whole assets/ directory, negating ${negations.length} file(s) by name — a newly added image would ship`,
        )
      }

      const readme = await read('README.md')
      if (readme !== undefined && /!\[[^\]]*\]\(\s*(?:https?:)?\/\/[^)]*\/assets\//u.test(readme)) {
        problems.push('README references its images by URL instead of a relative path')
      }

      return problems
    },
  },
  {
    id: 'lockfile-official-registry',
    criterion: "The lockfile's URLs point at the official registry",
    group: 'lockfile',
    async run(repository) {
      const lock = await repository.read('pnpm-lock.yaml')
      if (lock === undefined) return ['pnpm-lock.yaml is missing']
      const foreign = urlsIn(lock).filter((url) => !/^https?:\/\/registry\.npmjs\.org\//u.test(url))
      return foreign.length === 0 ? [] : [...new Set(foreign.map((url) => `foreign registry URL: ${url}`))]
    },
  },
  {
    id: 'one-package-manager',
    criterion: 'One package manager only: pnpm, with pnpm-lock.yaml as the sole lockfile',
    group: 'lockfile',
    async run(repository) {
      const { manifest, read, hasTopLevel } = repository
      const problems = []
      if (!(await hasTopLevel('pnpm-lock.yaml'))) problems.push('pnpm-lock.yaml is missing')

      // The declared signal wins over probing: `packageManager` says what this repository is built
      // with, and a second manager is then a contradiction to report rather than a file to hunt for.
      // No repository has this field yet, so today the probe below is what actually runs — but the
      // rule reads the declaration first, so adding the field later costs nothing here.
      const declared = typeof manifest.packageManager === 'string' ? manifest.packageManager.split('@')[0] : undefined
      if (declared && declared !== 'pnpm') problems.push(`packageManager declares ${declared}`)

      // Absence is the answer to look for, so it is read from the tree the sweep already fetched:
      // three rival lockfiles per repository, every week, is three 404s nobody should pay for.
      for (const rival of ['package-lock.json', 'yarn.lock', 'bun.lockb']) {
        if (await hasTopLevel(rival)) problems.push(`${rival} is present as well`)
      }

      // A manifest that still points at a rival's lockfile is a second manager in everything but name.
      if (await read('pnpm-lock.yaml') === undefined && !problems.some((problem) => problem.includes('pnpm-lock.yaml'))) {
        problems.push('pnpm-lock.yaml could not be read')
      }
      return problems
    },
  },
  {
    id: 'peer-dev-versions',
    criterion: 'peer and dev versions must agree',
    group: 'package.json',
    async run(repository) {
      const { manifest } = repository
      const peer = manifest.peerDependencies ?? {}
      const dev = manifest.devDependencies ?? {}
      const problems = []
      for (const [name, range] of Object.entries(peer)) {
        if (!dev[name]) problems.push(`${name} is a peer but is not in devDependencies`)
        else if (dev[name] !== range) problems.push(`${name}: peer "${range}" but dev "${dev[name]}"`)
      }
      return problems
    },
  },
  {
    id: 'dead-code-switches',
    criterion:
      'Four dead-code switches are a floor: noUnusedLocals, noUnusedParameters, noImplicitReturns, noFallthroughCasesInSwitch read true in every repository',
    group: 'tsconfig',
    async run(repository) {
      const { read, topLevelFiles } = repository

      // Every `tsconfig*.json` at the repository root is a candidate, and the rule is per *file that
      // does not inherit*: a config that `extends` another one gets the switches from it, so demanding
      // a repeat there would be demanding noise. `dsh-workbuddy-bridge` is why this is not simply
      // "read tsconfig.json": its client config declares no `extends`, so it is a second independent
      // list, and reading only the root would leave half that repository unguarded while reporting
      // green.
      //
      // The judging itself is `judgeTsconfigFloor`, kept pure so it can be made to fail on purpose —
      // this checker reads GitHub, so breaking a local file would prove nothing.
      const candidates = (await topLevelFiles()).filter((path) => /^tsconfig.*\.json$/u.test(path))
      const configs = []
      for (const path of candidates) {
        const source = await read(path)
        configs.push({ path, parsed: source === undefined ? undefined : parsedConfigOf(source) })
      }
      return judgeTsconfigFloor(configs)
    },
  },
  {
    id: 'engines-self-consistent',
    criterion: 'The host compatibility declaration is self-consistent',
    group: 'package.json',
    async run(repository) {
      const { manifest } = repository
      const engines = manifest.engines?.dsh
      if (!isSemverRange(engines)) return ['engines.dsh is missing or is not a SemVer range']
      const problems = []
      for (const field of ['peerDependencies', 'devDependencies']) {
        for (const [name, range] of Object.entries(manifest[field] ?? {})) {
          if (!name.startsWith('@deepseek-ai/dsh-')) continue
          if (range !== engines) problems.push(`${field}.${name} is "${range}", engines.dsh is "${engines}"`)
        }
      }
      return problems
    },
  },
  {
    id: 'dependency-category',
    criterion: "A dependency's category follows our relationship to it: an official package is never a runtime dependency",
    group: 'package.json',
    async run(repository) {
      const dependencies = repository.manifest.dependencies ?? {}
      const official = Object.keys(dependencies).filter((name) => name.startsWith('@deepseek-ai/'))
      return official.map((name) => `${name} is in dependencies; an official package belongs in peer + dev`)
    },
  },
  {
    id: 'release-no-version-bump',
    criterion: 'The release flow must not bump the version',
    group: 'workflows',
    async run(repository) {
      const release = await repository.read('.github/workflows/release.yml')
      if (release === undefined) return ['.github/workflows/release.yml is missing']
      const body = withoutComments(release)
      const problems = []
      for (const pattern of [/npm\s+version/u, /pnpm\s+version/u, /npm\s+pkg\s+set\s+version/u]) {
        if (pattern.test(body)) problems.push(`release.yml mutates the version (${pattern})`)
      }
      return problems
    },
  },
  {
    id: 'release-two-entry-points',
    criterion: 'Both entry points, manual and tag, can trigger the release',
    group: 'workflows',
    async run(repository) {
      const release = await repository.read('.github/workflows/release.yml')
      if (release === undefined) return ['.github/workflows/release.yml is missing']
      const problems = []
      if (!/workflow_dispatch:/u.test(release)) problems.push('release.yml has no workflow_dispatch trigger')
      if (!/tags:/u.test(release)) problems.push('release.yml has no tag trigger')
      return problems
    },
  },
  {
    id: 'release-oidc',
    criterion: 'npm publishing goes through OIDC, no token at any point',
    group: 'workflows',
    async run(repository) {
      const release = await repository.read('.github/workflows/release.yml')
      if (release === undefined) return ['.github/workflows/release.yml is missing']
      const body = withoutComments(release)
      const problems = []
      if (!/id-token:\s*write/u.test(body)) problems.push('release.yml does not request id-token: write')
      // A token would have to be wired in to be used: as a secret, or as an environment variable the
      // publish step reads. Mentioning the name in prose is not a finding.
      for (const token of ['NPM_TOKEN', 'NODE_AUTH_TOKEN']) {
        if (new RegExp(`secrets\\.${token}|\\$\\{?\\{?\\s*${token}`, 'u').test(body)) {
          problems.push(`release.yml wires ${token} in`)
        }
      }
      return problems
    },
  },
  {
    id: 'release-tag-shape',
    criterion: 'A release tag is v plus the manifest version, so a machine can read it',
    group: 'workflows',
    async run(repository) {
      const release = await repository.read('.github/workflows/release.yml')
      if (release === undefined) return ['.github/workflows/release.yml is missing']
      // A `tags:` entry is a **glob**, so `v[0-9]*` is the correct shape for "v followed by a
      // number"; only a pattern that cannot start with a literal v is a defect.
      const tags = [...release.matchAll(/^\s*-\s*'([^']*)'/gmu)].map((match) => match[1])
      if (tags.length === 0) return ['release.yml declares no tag pattern']
      const shaped = tags.filter((tag) => tag.startsWith('v'))
      return shaped.length === 0 ? [`tag patterns are ${tags.join(', ')}; none starts with a literal v`] : []
    },
  },
  {
    id: 'draft-workflow-present',
    criterion: 'Draft releases are maintained by one workflow per repository',
    group: 'workflows',
    async run(repository) {
      const draft = await repository.read('.github/workflows/release-drafter.yml')
      if (draft === undefined) return ['.github/workflows/release-drafter.yml is missing']
      const problems = []
      if (!/release-drafter\/release-drafter@/u.test(draft)) problems.push('the draft workflow does not use the release-drafter action')
      if (!/runs-on:\s*ubuntu/u.test(draft)) problems.push('the draft workflow is not pinned to an ubuntu runner')
      return problems
    },
  },
]

/** The redline files, and how big they were the last time somebody looked. */
async function loadBaseline() {
  try {
    return JSON.parse(await readFile(BASELINE, 'utf8'))
  } catch {
    return {}
  }
}

async function checkRedlines(repository, baseline) {
  const { name, read } = repository
  const candidates = ['test/redlines.test.ts', 'test/redlines.spec.ts', 'tests/redlines.test.ts', 'tests/redlines.spec.ts']
  let file
  let source
  for (const candidate of candidates) {
    const text = await read(candidate)
    if (text !== undefined) {
      file = candidate
      source = text
      break
    }
  }
  if (file === undefined) return { problems: ['no test/redlines.* file'], file: undefined, counts: undefined }

  const counts = countTests(source)
  const expected = baseline[name]
  if (expected === undefined) return { problems: [], file, counts, unrecorded: true }

  const problems = []
  for (const kind of ['describe', 'it']) {
    if (counts[kind] < expected[kind]) {
      problems.push(`${counts[kind]} ${kind} now, ${expected[kind]} at the baseline — something was deleted`)
    }
  }
  return { problems, file, counts }
}

// --- report ----------------------------------------------------------------------------------

/**
 * Findings someone has already read, decided about, and filed. `known-findings.json` is that list.
 *
 * The point is the distinction the criteria document itself draws: a run that is red every week is
 * indistinguishable from a run that is red because something broke. A known finding is not news —
 * it is printed, and it keeps the tracking issue open, but it does not fail the run. **A finding
 * that is not on this list does.**
 *
 * The list has to be maintained, or it becomes the place findings go to be forgotten: a known entry
 * whose finding no longer appears is reported as resolved, so removing it is the obvious next step.
 */
async function loadKnown() {
  try {
    const known = JSON.parse(await readFile(KNOWN_FINDINGS, 'utf8'))
    return Array.isArray(known) ? known : []
  } catch {
    return []
  }
}

const keyOf = (finding) => `${finding.repository}/${finding.check}`

/**
 * The tracking issue's body, built from a report.
 *
 * In the script rather than in the workflow: the workflow would otherwise carry a page of string
 * escaping inside YAML, where it cannot be run or read, and every edit to the wording would be an
 * edit to a shell heredoc.
 */
function issueBody(report, runUrl) {
  const blocks = []
  const section = (heading, findings, describe) => {
    if (findings.length === 0) return
    blocks.push(`## ${heading}`, '')
    for (const finding of findings) {
      blocks.push(`**${finding.repository}** — \`${finding.check}\``, '')
      const note = describe?.(finding)
      if (note) blocks.push(`> ${note}`, '')
      for (const problem of finding.problems) blocks.push(`- ${problem}`)
      blocks.push('')
    }
  }

  section('Still failing, not yet fixed', report.known ?? [], (finding) => finding.reason)
  section('New — this is why the run is red', report.fresh ?? [])

  if ((report.stale ?? []).length > 0) {
    blocks.push('## Resolved — delete these from `known-findings.json`', '')
    for (const entry of report.stale) blocks.push(`- ${entry.repository} \`${entry.check}\``)
    blocks.push('')
  }

  blocks.push(`Last run: ${runUrl}`)
  return blocks.join('\n')
}

async function main() {
  const baseline = await loadBaseline()
  const known = await loadKnown()
  const knownKeys = new Map(known.map((entry) => [`${entry.repository}/${entry.check}`, entry]))
  const { plugins, unreadable } = await discoverPlugins(ORG)

  if (plugins.length === 0) {
    line(`no plugin repository found in ${ORG} — discovery is broken, not the plugins`)
    process.exit(2)
  }

  const findings = []
  const redlineCounts = {}

  for (const plugin of plugins) {
    for (const check of CHECKS) {
      let problems
      try {
        problems = await check.run(plugin)
      } catch (error) {
        problems = [`could not be checked: ${error.message}`]
      }
      if (problems.length > 0) findings.push({ repository: plugin.name, check: check.id, criterion: check.criterion, problems })
    }

    const redlines = await checkRedlines(plugin, baseline)
    redlineCounts[plugin.name] = { file: redlines.file, ...(redlines.counts ?? {}) }
    if (redlines.problems.length > 0) {
      findings.push({
        repository: plugin.name,
        check: 'redlines-present',
        criterion: 'Every rule is held by an assertion, not by prose alone',
        problems: redlines.problems,
      })
    }
  }

  if (flag('--update-baseline')) {
    const next = {}
    for (const [name, counts] of Object.entries(redlineCounts)) {
      if (counts.file) next[name] = counts
    }
    await writeFile(BASELINE, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
    line(`baseline updated: ${Object.keys(next).length} repositories`)
    return
  }

  const fresh = findings.filter((finding) => !knownKeys.has(keyOf(finding)))
  const tracked = findings.filter((finding) => knownKeys.has(keyOf(finding)))
  const stale = known.filter((entry) => !findings.some((finding) => keyOf(finding) === `${entry.repository}/${entry.check}`))

  const report = {
    org: ORG,
    plugins: plugins.map((plugin) => plugin.name),
    redlines: redlineCounts,
    known: tracked.map((finding) => ({ ...finding, reason: knownKeys.get(keyOf(finding)).reason })),
    fresh,
    stale,
  }

  const outPath = option('--json-out', undefined)
  if (outPath) await writeFile(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')

  // The tracking issue is rendered here, next to the data it describes, so the workflow only has to
  // move text around.
  const bodyPath = option('--issue-body', undefined)
  if (bodyPath) {
    await writeFile(bodyPath, `${issueBody(report, process.env.RUN_URL ?? '(no run url)')}\n`, 'utf8')
  }

  if (flag('--json')) {
    line(JSON.stringify(report, null, 2))
    process.exit(fresh.length === 0 ? 0 : 1)
  }

  line(`checked ${plugins.length} plugin repositories in ${ORG}: ${plugins.map((plugin) => plugin.name).join(', ')}`)
  for (const entry of unreadable) line(`  could not read ${entry.fullName}: ${entry.reason}`)
  line('')

  line('redline files')
  for (const [name, counts] of Object.entries(redlineCounts)) {
    line(`  ${name.padEnd(24)} ${counts.file ?? 'MISSING'}  describe=${counts.describe ?? '-'} it=${counts.it ?? '-'}`)
  }
  line('')

  if (tracked.length > 0) {
    line(`${tracked.length} known finding(s) — tracked, not news:`)
    for (const finding of tracked) {
      line('')
      line(`  ${finding.repository}  [${finding.check}]  ${knownKeys.get(keyOf(finding)).trackedIn}`)
      for (const problem of finding.problems) line(`    - ${problem}`)
    }
    line('')
  }

  if (stale.length > 0) {
    line(`${stale.length} known finding(s) no longer occur — delete them from known-findings.json:`)
    for (const entry of stale) line(`  ${entry.repository}  [${entry.check}]  ${entry.trackedIn}`)
    line('')
  }

  if (fresh.length === 0) {
    line(`${CHECKS.length + 1} checks, 0 new findings`)
    return
  }

  line(`${fresh.length} NEW finding(s):`)
  for (const finding of fresh) {
    line('')
    line(`  ${finding.repository}  [${finding.check}]`)
    line(`    rule: ${finding.criterion}`)
    for (const problem of finding.problems) line(`    - ${problem}`)
  }
  line('')
  line('A new finding: either fix it, or add it to known-findings.json with a reason and a tracking issue.')
  process.exit(1)
}

await main()
