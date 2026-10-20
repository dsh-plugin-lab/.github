/**
 * Which repositories are plugin repositories, and what is in them — read once, reused by every check.
 *
 * The organization has three kinds of repository (see docs/plugin-conventions.md): plugin
 * repositories, this one, and the market. Discovery must name the first kind without help from a
 * hand-written list, because a list is a second source of truth that goes stale the moment a
 * repository is created or archived.
 *
 * **A repository is discovered by what it declares, never by what is being checked.** `dsh-` prefix
 * plus a `dsh` field in `package.json` — that is the declaration. The icon and `locale/` are
 * *obligations to check*, not admission tickets: if discovery required them, a repository that broke
 * that rule would quietly drop out of the check instead of failing it.
 *
 * Everything is fetched through `fetchOnce`, so one run spends one request per file no matter how
 * many criteria read it.
 */

import { trace } from './trace.mjs'

const API = 'https://api.github.com'
const RAW = 'https://raw.githubusercontent.com'

trace('discover', `fresh process at ${new Date().toISOString()}`)

/** Headers for the GitHub API. `GITHUB_TOKEN` is optional; without it the anonymous limit applies. */
function apiHeaders() {
  const headers = { accept: 'application/vnd.github+json', 'user-agent': 'dsh-plugin-lab-criteria' }
  if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`
  return headers
}

/** A per-run cache. One `fetchOnce` per key, so criteria never re-download what another already has. */
export function memo() {
  const cache = new Map()
  return function fetchOnce(key, load) {
    if (cache.has(key)) {
      trace('discover', `cache hit  ${key}`)
      return cache.get(key)
    }
    trace('discover', `fetch      ${key}`)
    cache.set(key, load())
    return cache.get(key)
  }
}

/**
 * Statuses worth a second attempt.
 *
 * Deliberately a set, not a comparison: `4xx` is the server telling us the answer, and retrying it
 * wastes time on every run forever. `429` is the exception — too many requests is an invitation to
 * wait, not an answer. Everything else in `4xx` returns immediately.
 */
const RETRYABLE = new Set([408, 425, 429, 500, 502, 503, 504])

/**
 * A GET with a bounded retry.
 *
 * The raw host is reached over one connection per file and an occasional reset is ordinary, not a
 * finding. Retrying here keeps a transient failure from being reported as "the repository is
 * broken" — the distinction the whole report rests on.
 */
async function get(url, init, attempts = 3) {
  let last
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let response
    try {
      response = await fetch(url, { ...init, signal: AbortSignal.timeout(30_000) })
    } catch (error) {
      last = error
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, attempt * 500))
      continue
    }
    if (!RETRYABLE.has(response.status)) return response
    last = new Error(`HTTP ${response.status}`)
    if (attempt === attempts) return response
    await new Promise((resolve) => setTimeout(resolve, attempt * 500))
  }
  throw last
}

/**
 * Every path in a repository, as a set.
 *
 * One request, and afterwards "does this file exist" costs nothing. The alternative — asking for a
 * file that is probably not there and reading a 404 — turns each *absence* into a round trip: the
 * lockfile rule alone would probe three missing files per repository, every week, forever.
 *
 * A truncated tree (GitHub's answer for very large repositories) is reported rather than ignored,
 * because a truncated tree would make absence check fail to be wrong: everything would look missing.
 */
async function treeOf(repository, branch, fetchOnce) {
  const fullName = repository.full_name
  return fetchOnce(`${fullName}/tree`, async () => {
    const response = await get(`${API}/repos/${fullName}/git/trees/${branch}?recursive=1`, {
      headers: apiHeaders(),
    })
    if (!response.ok) throw new Error(`listing the tree of ${fullName}: HTTP ${response.status}`)
    const body = await response.json()
    if (body.truncated) throw new Error(`the tree of ${fullName} is truncated; existence checks would be wrong`)
    return new Set((body.tree ?? []).filter((entry) => entry.type === 'blob').map((entry) => entry.path))
  })
}

/** Every public repository in an organization, following pagination. */
export async function organizationRepositories(org) {
  const repositories = []
  for (let page = 1; page <= 10; page += 1) {
    const response = await get(`${API}/orgs/${org}/repos?per_page=100&page=${page}&type=public`, {
      headers: apiHeaders(),
    })
    if (!response.ok) throw new Error(`listing ${org}: HTTP ${response.status}`)
    const batch = await response.json()
    repositories.push(...batch)
    if (batch.length < 100) break
  }
  return repositories
}

/**
 * A file from a repository's default branch, or `undefined` when it is not there.
 *
 * Absence is an ordinary outcome, not an error: most repositories have no `icon.svg`, and every
 * criterion has to be able to say "missing" rather than blow up.
 */
export async function fileOf(fullName, path, branch = 'main') {
  const response = await get(`${RAW}/${fullName}/${branch}/${path}`, {
    headers: { 'user-agent': 'dsh-plugin-lab-criteria' },
  })
  if (response.status === 404) return undefined
  if (!response.ok) throw new Error(`reading ${fullName}/${path}: HTTP ${response.status}`)
  return response.text()
}

/**
 * The plugin repositories of an organization, each with its manifest already in hand.
 *
 * Returns `{ name, fullName, branch, manifest, read }`, where `read(path)` is the memoised file
 * reader for that repository. Anything that fails to parse is reported as a finding rather than
 * thrown, so one broken repository does not hide the state of the others.
 */
export async function discoverPlugins(org, { fetchOnce = memo() } = {}) {
  const repositories = await organizationRepositories(org)
  trace('discover', `${org}: ${repositories.length} public repositories`)
  const plugins = []
  const unreadable = []

  for (const repository of repositories) {
    if (!repository.name.startsWith('dsh-')) continue
    const branch = repository.default_branch ?? 'main'
    const fullName = repository.full_name

    let manifest
    try {
      const text = await fetchOnce(`${fullName}/package.json`, () => fileOf(fullName, 'package.json', branch))
      if (text === undefined) {
        trace('discover', `skip ${repository.name}: no package.json`)
        continue
      }
      manifest = JSON.parse(text)
    } catch (error) {
      unreadable.push({ fullName, reason: error.message })
      continue
    }

    // A repository that ships a DSH plugin declares `dsh`. A `dsh-`-named repository that does not
    // is a workspace, a tool, or something else — not a plugin repository.
    if (!manifest.dsh) {
      trace('discover', `skip ${repository.name}: no dsh field`)
      continue
    }

    const read = (path) => fetchOnce(`${fullName}/${path}`, () => fileOf(fullName, path, branch))
    // Absence is answered from the tree where possible, so a rule about a file that should *not*
    // exist does not pay a round trip to discover that it does not.
    const has = async (path) => {
      try {
        return (await treeOf(repository, branch, fetchOnce)).has(path)
      } catch (error) {
        // A tree we cannot read degrades to a fetch: slower, but the answer is still true.
        trace('discover', `tree unavailable for ${repository.name}: ${error.message}`)
        return (await read(path)) !== undefined
      }
    }
    plugins.push({ name: repository.name, fullName, branch, manifest, read, has })
  }

  plugins.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
  trace('discover', `plugins: ${plugins.map((plugin) => plugin.name).join(', ') || 'none'}`)
  return { plugins, unreadable }
}
