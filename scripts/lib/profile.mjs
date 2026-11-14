/**
 * The organization profile page against the repositories that actually exist.
 *
 * Split out for the reason this directory exists: a check that reads GitHub cannot be tested by
 * breaking a local file. Keeping the comparison pure lets the failure be produced on purpose.
 *
 * The profile table is the one hand-written list left in this repository, and it is hand-written on
 * purpose — it is a showcase, not a census. What is not allowed is for it to **quietly** disagree
 * with reality: a plugin repository that exists and is missing from the table is invisible to every
 * visitor, and nothing else in this repository would ever notice.
 *
 * Only one direction is a defect. A name in the table that is not a plugin repository is a **stale
 * row**, and that is also a defect — the page advertises something that is not there.
 */

/**
 * The repository names a profile page links to.
 * @param source - the profile page's markdown.
 * @returns the names, in the order they appear, without duplicates.
 */
export function linkedRepositories(source) {
  const found = source.matchAll(/github\.com\/dsh-plugin-lab\/([A-Za-z0-9._-]+)/gu)
  return [...new Set([...found].map((match) => match[1]))]
}

/**
 * The plugin names a profile page's table lists, one per row.
 *
 * A row is `| <a href=…>…</a> | [name](…) | purpose |`. Matching rows rather than every link keeps
 * the "In this repository" section at the bottom — which links to files, not repositories — out of it.
 * @param source - the profile page's markdown.
 * @returns the plugin names the table lists.
 */
export function tableRows(source) {
  const rows = source.split('\n').filter((text) => /^\|\s*<a href="https:\/\/github\.com\/dsh-plugin-lab\//u.test(text))
  return [...new Set(rows.map((text) => /^\|\s*<a href="https:\/\/github\.com\/dsh-plugin-lab\/([A-Za-z0-9._-]+)"/u.exec(text)[1]))]
}

/**
 * Every plugin repository appears in the table, and the table names nothing else.
 * @param rows - the plugin names the table lists.
 * @param plugins - the plugin repository names discovery found.
 * @returns the problems, empty when the two agree.
 */
export function judgeProfile({ rows, plugins }) {
  const listed = new Set(rows)
  const actual = new Set(plugins)
  const problems = []
  for (const name of [...actual].sort()) {
    if (!listed.has(name)) {
      problems.push(`${name} is a plugin repository but the table has no row for it — a visitor cannot see it`)
    }
  }
  for (const name of [...listed].sort()) {
    if (!actual.has(name)) {
      problems.push(`the table lists ${name}, which is not a plugin repository — the row is stale`)
    }
  }
  return problems
}
