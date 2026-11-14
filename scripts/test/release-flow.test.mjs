import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

import { judgeCaller, judgeSharedFlow, versionWrites } from '../lib/release-flow.mjs'

const ROOT = join(import.meta.dirname, '..', '..')
const SHARED = readFileSync(join(ROOT, '.github', 'workflows', 'release-publish.yml'), 'utf8')

const caller = (environment = 'release') => `name: Release

on:
  workflow_dispatch:
    inputs:
      force:
        type: boolean
  push:
    tags:
      - 'v[0-9]*'

permissions:
  contents: write
  id-token: write

jobs:
  release:
    uses: dsh-plugin-lab/.github/.github/workflows/release-publish.yml@main
    with:
      environment: ${environment}
      force: \${{ inputs.force || false }}
`

test('the shared flow as it stands passes', () => {
  assert.deepEqual(judgeSharedFlow(SHARED), [])
})

test('a shared flow that stops excluding the released tag is caught', () => {
  // The failure this guards is the nastiest kind: a perfectly normal release is judged
  // "nothing to release", and the message points at the wrong thing.
  const broken = SHARED.replace(/--exclude=\$\{\{\s*github\.ref_name\s*\}\}/u, '')
  assert.match(String(judgeSharedFlow(broken)), /baseline does not exclude the tag/u)
})

test('a shared flow whose draft cleanup matches prose instead of the action name is caught', () => {
  const broken = SHARED.replace(/sed '\/Release Drafter\/d'/u, "sed '/由 Release Drafter 自动汇总草稿/d'")
  assert.match(String(judgeSharedFlow(broken)), /not stripped by the action name/u)
})

test('a shared flow that deletes the formal tag with the draft is caught', () => {
  const broken = SHARED.replace(/ --cleanup-tag=false/u, '')
  assert.match(String(judgeSharedFlow(broken)), /would delete the tag as well/u)
})

test('a shared flow that wires a long-lived token is caught', () => {
  const broken = SHARED.replace('pnpm publish', 'NODE_AUTH_TOKEN=${{ secrets.NODE_AUTH_TOKEN }} pnpm publish')
  assert.match(String(judgeSharedFlow(broken)), /long-lived NODE_AUTH_TOKEN/u)
})

test('a caller that names the right file and the right environment passes', () => {
  assert.deepEqual(judgeCaller(caller(), { environment: 'release' }), [])
  assert.deepEqual(judgeCaller(caller('github-release'), { environment: 'github-release' }), [])
})

test('a caller whose environment disagrees with the trusted publisher is caught', () => {
  // This is the only failure of the three that the registry reports identically, so it is the one
  // worth holding locally.
  const problems = judgeCaller(caller('release'), { environment: 'github-release' })
  assert.match(String(problems), /does not pass environment: github-release/u)
})

test('a caller that forgot to call the shared flow is caught, not silently accepted', () => {
  const local = caller().replace(/    uses: .*\n    with:\n(?:      .*\n)+/u, '    runs-on: ubuntu-latest\n')
  assert.match(String(judgeCaller(local, { environment: 'release' })), /does not call/u)
})

test('the version-write detector judges command positions only', () => {
  // A comment telling a maintainer to bump is not a call — a detector that cannot tell them apart
  // fails its own documentation.
  assert.deepEqual(versionWrites('      - run: npm version patch --no-git-tag-version'), [
    'npm version patch --no-git-tag-version',
  ])
  assert.deepEqual(versionWrites('run: pnpm install --frozen-lockfile && npm version patch'), [
    'npm version patch',
  ])
  assert.deepEqual(versionWrites('# bump with: npm version <patch|minor|major> before releasing'), [])
  assert.deepEqual(versionWrites('      - run: pnpm publish --provenance --tag "$tag"'), [])
})
