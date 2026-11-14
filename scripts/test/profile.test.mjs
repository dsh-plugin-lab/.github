import assert from 'node:assert/strict'
import { test } from 'node:test'

import { judgeProfile, linkedRepositories, tableRows } from '../lib/profile.mjs'

const row = (name) =>
  `| <a href="https://github.com/dsh-plugin-lab/${name}"><img src="https://raw.githubusercontent.com/dsh-plugin-lab/${name}/main/icon.svg" alt="${name}"></a> | [${name}](https://github.com/dsh-plugin-lab/${name}) | does a thing |`

const page = (names) =>
  [
    '## Plugins',
    '',
    '| | Plugin | Purpose |',
    '|---|---|---|',
    ...names.map(row),
    '',
    '## In [dsh-plugin-lab/.github](https://github.com/dsh-plugin-lab/.github)',
    '',
    '| Looking for | File |',
    '|---|---|',
    '| How to contribute | [CONTRIBUTING.md](https://github.com/dsh-plugin-lab/.github/blob/main/CONTRIBUTING.md) |',
  ].join('\n')

test('a table that matches discovery passes', () => {
  const rows = tableRows(page(['a-plugin', 'b-plugin']))
  assert.deepEqual(judgeProfile({ rows, plugins: ['a-plugin', 'b-plugin'] }), [])
})

test('a plugin repository with no row is a defect, and it is named', () => {
  // This is the failure that shipped: a repository existed, the index listed it, and the profile page
  // — the one page every visitor sees — did not. Nothing else in the repository noticed.
  const rows = tableRows(page(['a-plugin']))
  const problems = judgeProfile({ rows, plugins: ['a-plugin', 'b-plugin'] })
  assert.equal(problems.length, 1)
  assert.match(problems[0], /b-plugin is a plugin repository but the table has no row/)
})

test('a row for something that is not a plugin repository is also a defect', () => {
  const rows = tableRows(page(['a-plugin', 'gone-plugin']))
  const problems = judgeProfile({ rows, plugins: ['a-plugin'] })
  assert.equal(problems.length, 1)
  assert.match(problems[0], /gone-plugin.*the row is stale/u)
})

test('the "In this repository" table at the bottom is not mistaken for plugin rows', () => {
  // Those rows link to files under `.github`, not to plugin repositories. A check that counted every
  // repository link on the page would report the organization repository as a missing plugin.
  const rows = tableRows(page(['a-plugin']))
  assert.deepEqual(rows, ['a-plugin'])
})

test('a page with no table rows is reported, not silently accepted', () => {
  const problems = judgeProfile({ rows: tableRows('## Plugins\n'), plugins: ['a-plugin'] })
  assert.equal(problems.length, 1)
})

test('linked repositories include the files section, tableRows does not', () => {
  const page_ = page(['a-plugin'])
  assert.ok(linkedRepositories(page_).includes('.github'))
  assert.deepEqual(tableRows(page_), ['a-plugin'])
})
