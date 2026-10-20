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
 *   node scripts/check-criteria.mjs                 # report; exit 1 when something fails
 *   node scripts/check-criteria.mjs --org <name>    # another organization
 *   node scripts/check-criteria.mjs --json          # machine-readable
 *   node scripts/check-criteria.mjs --update-baseline   # rewrite redlines-baseline.json from today
 */
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { discoverPlugins } from './lib/discover.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const BASELINE = join(ROOT, 'redlines-baseline.json')

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
      const { manifest, read } = repository
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
        if (await read(iconPath) === undefined) problems.push(`icon "${icon}" does not exist`)
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
      const { manifest, read, has } = repository
      const problems = []
      if (!(await has('pnpm-lock.yaml'))) problems.push('pnpm-lock.yaml is missing')

      // The declared signal wins over probing: `packageManager` says what this repository is built
      // with, and a second manager is then a contradiction to report rather than a file to hunt for.
      // No repository has this field yet, so today the probe below is what actually runs — but the
      // rule reads the declaration first, so adding the field later costs nothing here.
      const declared = typeof manifest.packageManager === 'string' ? manifest.packageManager.split('@')[0] : undefined
      if (declared && declared !== 'pnpm') problems.push(`packageManager declares ${declared}`)

      // Absence is the answer to look for, so it is read from the tree the sweep already fetched:
      // three rival lockfiles per repository, every week, is three 404s nobody should pay for.
      for (const rival of ['package-lock.json', 'yarn.lock', 'bun.lockb']) {
        if (await has(rival)) problems.push(`${rival} is present as well`)
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

async function main() {
  const baseline = await loadBaseline()
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

  if (flag('--json')) {
    line(JSON.stringify({ org: ORG, plugins: plugins.map((plugin) => plugin.name), redlines: redlineCounts, findings }, null, 2))
    process.exit(findings.length === 0 ? 0 : 1)
  }

  line(`checked ${plugins.length} plugin repositories in ${ORG}: ${plugins.map((plugin) => plugin.name).join(', ')}`)
  for (const entry of unreadable) line(`  could not read ${entry.fullName}: ${entry.reason}`)
  line('')

  line('redline files')
  for (const [name, counts] of Object.entries(redlineCounts)) {
    line(`  ${name.padEnd(24)} ${counts.file ?? 'MISSING'}  describe=${counts.describe ?? '-'} it=${counts.it ?? '-'}`)
  }
  line('')

  if (findings.length === 0) {
    line(`${CHECKS.length + 1} checks, 0 findings`)
    return
  }

  line(`${findings.length} finding(s):`)
  for (const finding of findings) {
    line('')
    line(`  ${finding.repository}  [${finding.check}]`)
    line(`    rule: ${finding.criterion}`)
    for (const problem of finding.problems) line(`    - ${problem}`)
  }
  process.exit(1)
}

await main()
