import assert from 'node:assert/strict'
import { test } from 'node:test'

import { DEAD_CODE_SWITCHES, judgeTsconfigFloor } from '../lib/tsconfig-floor.mjs'

const ALL_ON = Object.fromEntries(DEAD_CODE_SWITCHES.map((flag) => [flag, true]))

test('a standalone config with all four on passes', () => {
  assert.deepEqual(
    judgeTsconfigFloor([{ path: 'tsconfig.json', parsed: { compilerOptions: ALL_ON } }]),
    [],
  )
})

test('each switch missing is reported by name', () => {
  for (const flag of DEAD_CODE_SWITCHES) {
    const options = { ...ALL_ON, [flag]: undefined }
    const problems = judgeTsconfigFloor([{ path: 'tsconfig.json', parsed: { compilerOptions: options } }])
    assert.equal(problems.length, 1, `${flag} should produce exactly one problem`)
    assert.match(problems[0], new RegExp(flag, 'u'))
    assert.match(problems[0], /absent/u)
  }
})

test('a switch set to false is distinguished from one absent', () => {
  // The wording matters: "false" means somebody turned it off on purpose, "absent" usually means it
  // was never there. A single message for both hides which happened.
  const problems = judgeTsconfigFloor([
    { path: 'tsconfig.json', parsed: { compilerOptions: { ...ALL_ON, noUnusedLocals: false } } },
  ])
  assert.match(problems[0], /false/u)
  assert.doesNotMatch(problems[0], /absent/u)
})

test('a config that extends another is not judged — it inherits the switches', () => {
  // Every repository here has tsconfig.client.json / tsconfig.test.json extending the root. Demanding
  // the four switches again in those would be demanding noise.
  const problems = judgeTsconfigFloor([
    { path: 'tsconfig.json', parsed: { compilerOptions: ALL_ON } },
    { path: 'tsconfig.client.json', parsed: { extends: './tsconfig.json', compilerOptions: {} } },
  ])
  assert.deepEqual(problems, [])
})

test('a second standalone config IS judged — this is the workbuddy shape', () => {
  // dsh-workbuddy-bridge's client config declares no `extends`, so it is an independent list. Reading
  // only tsconfig.json would report green while half the repository went unguarded.
  const problems = judgeTsconfigFloor([
    { path: 'tsconfig.json', parsed: { compilerOptions: ALL_ON } },
    {
      path: 'tsconfig.client.json',
      parsed: { compilerOptions: { ...ALL_ON, noImplicitReturns: undefined } },
    },
  ])
  assert.equal(problems.length, 1)
  assert.match(problems[0], /tsconfig\.client\.json/u)
  assert.match(problems[0], /noImplicitReturns/u)
})

test('every config inheriting is a failure, not a pass', () => {
  // The self-check: with nothing judged, "no problems" would mean "the rule did not run".
  const problems = judgeTsconfigFloor([
    { path: 'tsconfig.client.json', parsed: { extends: './tsconfig.json' } },
  ])
  assert.equal(problems.length, 1)
  assert.match(problems[0], /no standalone list was found to judge/u)
})

test('no tsconfig at all is a failure', () => {
  const problems = judgeTsconfigFloor([])
  assert.equal(problems.length, 1)
  assert.match(problems[0], /no tsconfig\*\.json/u)
})

test('an unparseable config is reported, not skipped', () => {
  const problems = judgeTsconfigFloor([{ path: 'tsconfig.json', parsed: undefined }])
  assert.equal(problems.length, 1)
  assert.match(problems[0], /not parseable/u)
})

test('a config with no compilerOptions is reported, not treated as empty options', () => {
  const problems = judgeTsconfigFloor([{ path: 'tsconfig.json', parsed: { include: ['src'] } }])
  assert.match(problems[0], /declares no compilerOptions/u)
})

test('switches above the floor are not a problem', () => {
  // A repository may enable more than the four; the row says "floor", so a longer list must pass.
  const problems = judgeTsconfigFloor([
    {
      path: 'tsconfig.json',
      parsed: { compilerOptions: { ...ALL_ON, strict: true, noUncheckedIndexedAccess: true } },
    },
  ])
  assert.deepEqual(problems, [])
})

test('the report is ordered by path, so two runs read the same', () => {
  const problems = judgeTsconfigFloor([
    { path: 'tsconfig.z.json', parsed: { compilerOptions: {} } },
    { path: 'tsconfig.a.json', parsed: { compilerOptions: {} } },
  ])
  assert.ok(problems[0].startsWith('tsconfig.a.json'), problems[0])
})
