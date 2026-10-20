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
 * A GET with a bounded retry.
 *
 * The raw host is reached over one connection per file and an occasional reset is ordinary, not a
 * finding. Retrying here keeps a transient failure from being reported as "the repository is
 * broken" — the distinction the whole report rests on.
 */
async function get(url, init, attempts = 3) {
  let last
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { ...init, signal: AbortSignal.timeout(30_000) })
      // 5xx is worth another attempt; 4xx is the answer.
      if (response.status < 500) return response
      last = new Error(`HTTP ${response.status}`)
    } catch (error) {
      last = error
    }
    if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, attempt * 500))
  }
  throw last
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
    plugins.push({ name: repository.name, fullName, branch, manifest, read })
  }

  plugins.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
  trace('discover', `plugins: ${plugins.map((plugin) => plugin.name).join(', ') || 'none'}`)
  return { plugins, unreadable }
}
