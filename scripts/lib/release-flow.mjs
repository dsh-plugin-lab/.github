/**
 * The release chain, judged from source rather than from a run.
 *
 * Two files, two questions. `judgeSharedFlow` asks whether the one copy in
 * `.github/workflows/release-publish.yml` still does all the things the family relies on;
 * `judgeCaller` asks whether a repository's thin `release.yml` still hands it the two literals npm
 * validates. Both are pure so the failures can be produced on purpose — a check that reads GitHub
 * cannot be tested by breaking a local file.
 *
 * Why the behavioural assertions moved here: they used to live in each plugin repository, reading
 * that repository's own `release.yml`. A thin caller contains none of the steps, so the same
 * assertions became vacuous there — green because there was nothing left to look at, which is worse
 * than red. They are kept, once, against the file that actually runs.
 */

/** The workflow a thin caller must name, and the only filename npm's trusted publisher accepts. */
export const SHARED_FLOW = 'dsh-plugin-lab/.github/.github/workflows/release-publish.yml'

/** A YAML source with its comments removed: every check below judges lines that would run. */
function withoutComments(source) {
  return source
    .split('\n')
    .filter((line) => !line.trim().startsWith('#'))
    .join('\n')
}

/**
 * Commands that would rewrite the version.
 *
 * Only **command positions** count: a comment saying "bump with `npm version`" is advice to a
 * maintainer, not a call, and a detector that cannot tell them apart fails its own documentation.
 */
export function versionWrites(source) {
  return withoutComments(source)
    .split('\n')
    .flatMap((line) =>
      line
        .replace(/^\s*(?:-\s*)?(?:run:\s*)?/, '')
        .split(/&&|;|\|\|/)
        .map((part) => part.trim())
        .filter((part) => /^(?:npm|pnpm|yarn)\s+(?:--?[\w-]+\s+)*version(?:\s|$)/.test(part)),
    )
}

/**
 * Everything the shared chain promises, judged from its text.
 * @param source - the shared workflow's source.
 * @returns the problems; empty means it still holds.
 */
export function judgeSharedFlow(source) {
  const text = withoutComments(source)
  const problems = []

  // The triggers live in the caller, not here: this file is `workflow_call` only, and a tag or a
  // manual dispatch reaches it through whichever repository called it. What it must still carry is
  // the gate for each of those two entry points.
  if (!/--exclude=\$\{\{\s*github\.ref_name\s*\}\}/u.test(text)) {
    problems.push('the release-noise baseline does not exclude the tag being released')
  }
  if (!/github\.event_name\s*==\s*'workflow_dispatch'\s*&&\s*github\.ref\s*!=\s*'refs\/heads\/main'/u.test(text)) {
    problems.push('the default-branch check has no event guard, so every tag release would fail it')
  }
  if (!/Verify the pushed tag matches the manifest version/u.test(text)) {
    problems.push('no tag/manifest agreement gate')
  }

  // The body: draft first, fallback second, and a warning when the draft cannot be read.
  if (!/gh release view next/u.test(text)) problems.push('the release body does not read the Drafter draft')
  if (!/--generate-notes/u.test(text)) problems.push('no fallback to --generate-notes')
  if (!/::warning::/u.test(text)) problems.push('a draft that cannot be read is not warned about')
  if (!/sed '\/Release Drafter\/d'/u.test(text)) {
    problems.push('the draft is not stripped by the action name, so a reworded notice breaks it silently')
  }

  // Retiring the draft: only a draft, never a formal release's tag.
  if (!/gh release delete/u.test(text)) problems.push('the draft is never retired')
  if (!/select\(\.isDraft\)/u.test(text)) problems.push('the retirement does not select drafts only')
  if (!/select\(startswith\("v"\) \| not\)/u.test(text)) {
    problems.push('the retirement does not exclude formal v-prefixed tags')
  }
  if (!/--cleanup-tag=false/u.test(text)) problems.push('the retirement would delete the tag as well')

  // The tag shape a machine reads, and the prerelease pairing.
  const tags = [...text.matchAll(/\btag="([^"]*)"/gu)].map((match) => match[1])
  if (tags.length === 0) problems.push('no tag assignment')
  if (tags.some((value) => !value.startsWith('v'))) problems.push('a tag assignment does not start with v')
  if (!/--match\s+['"]v\[0-9\]\*['"]/u.test(text)) {
    problems.push("the guard cannot see the tag shape: no git describe --match 'v[0-9]*'")
  }
  if (!/\*-\*/u.test(text) || !/--prerelease/u.test(text)) {
    problems.push('the prerelease marker is not paired with a prerelease version test')
  }

  // Build **before** publish. `main` and `exports` point at `lib/`, which is gitignored, so a
  // release that publishes first ships a tarball with no code in it — this failed once, and the
  // package installed without an entry point instead of failing loudly.
  const lines = text.split('\n')
  const buildAt = lines.findIndex((line) => /^\s*(-\s*)?run:\s*(npm|pnpm) run build\b/u.test(line))
  const publishAt = lines.findIndex((line) => /\b(npm|pnpm) publish\b/u.test(line))
  if (publishAt === -1) problems.push('no publish step, so this file is not the release chain')
  if (buildAt === -1 || publishAt === -1 || buildAt > publishAt) {
    problems.push('the build does not run before publish: the tarball would carry no code')
  }

  // OIDC, and no token anywhere.
  if (!/id-token:\s*write/u.test(text)) problems.push('id-token: write is not granted')
  for (const token of ['NPM_TOKEN', 'NODE_AUTH_TOKEN']) {
    if (new RegExp(`secrets\\.${token}|\\$\\{?\\{?\\s*${token}`, 'u').test(text)) {
      problems.push(`a long-lived ${token} is wired in`)
    }
  }

  if (versionWrites(source).length > 0) problems.push('the chain rewrites the version')
  return problems
}

/**
 * What a thin caller has to keep.
 *
 * The two literals are not style: npm answers a trusted-publisher mismatch with a 404 that names no
 * cause, so the filename and the environment name are load-bearing.
 * @param source - a repository's `release.yml`.
 * @param expected - the environment name that repository's trusted publisher names.
 * @returns the problems; empty means the call is intact.
 */
export function judgeCaller(source, { environment }) {
  const text = withoutComments(source)
  const problems = []

  if (!text.includes(`uses: ${SHARED_FLOW}@`)) {
    problems.push(`does not call ${SHARED_FLOW}; a repository that needs its own steps keeps a full copy and says so in AGENTS.md`)
  }
  if (!/workflow_dispatch:/u.test(text)) problems.push('no manual entry point')
  if (!/tags:\s*\n\s*-\s*'v\[0-9\]\*'/u.test(text)) problems.push('no tag entry point')
  if (!/id-token:\s*write/u.test(text)) problems.push('id-token: write is not forwarded to the called job')
  if (!new RegExp(`environment:\\s*${environment}\\b`, 'u').test(text)) {
    problems.push(`does not pass environment: ${environment} — npm's trusted publisher names that word, and a mismatch is a 404 with no cause`)
  }
  if (!/uses:.*release-publish\.yml@/u.test(text) && /workflow_call/u.test(text)) {
    problems.push('defines a called workflow in a plugin repository')
  }
  if (versionWrites(source).length > 0) problems.push('the caller rewrites the version')
  return problems
}
