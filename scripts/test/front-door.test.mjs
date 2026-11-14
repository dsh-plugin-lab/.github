import assert from 'node:assert/strict'
import { test } from 'node:test'

import { judgeFrontDoor, taglinesOf } from '../lib/front-door.mjs'

/** A front door: front matter with a bold and an italic tagline, then a rule and body. */
function door({ strong, em }) {
  return (
    `<div align="center">\n  <p><strong>${strong}</strong></p>\n\n  <p><em>${em}</em></p>\n` +
    '</div>\n\n---\n\nbody\n'
  )
}

const EN = door({ strong: 'Run one fixed task', em: '跑一条固定任务' })
const ZH = door({ strong: '跑一条固定任务', em: 'Run one fixed task' })

test('an English README.md with README_zh.md is a mirror and passes', () => {
  assert.deepEqual(judgeFrontDoor({ readme: EN, other: { name: 'README_zh.md', text: ZH } }), [])
})

test('a Chinese README.md with README_en.md is a mirror and passes', () => {
  // Some sibling repositories look like this. A checker that assumed README.md is always English
  // would report them as broken, which is why the language comes from the file name.
  assert.deepEqual(judgeFrontDoor({ readme: ZH, other: { name: 'README_en.md', text: EN } }), [])
})

test('the switcher line is not mistaken for a tagline', () => {
  // The switcher's `</strong>` is followed by `· <a …>` on the same line, so the two-line pattern
  // does not match it. If it did, every repository would be judged on its language switch instead of
  // its tagline, and the rule would pass or fail for the wrong reason.
  const withSwitch =
    '<div align="center">\n  <p><strong>Run one fixed task</strong></p>\n\n' +
    '  <p><em>跑一条固定任务</em></p>\n\n  <p>\n    <strong><a href="README.md">English</a></strong> · ' +
    '<a href="README_zh.md">简体中文</a>\n  </p>\n</div>\n\n---\n\n'
  assert.deepEqual(taglinesOf(withSwitch), { strong: 'Run one fixed task', em: '跑一条固定任务' })
})

test('a bold line in the wrong language is reported', () => {
  // Swapping the bold line breaks two rules at once — the language rule and the mirror — and both
  // findings are true, so this asserts on the set rather than on a count that would be brittle.
  const wrong = door({ strong: '跑一条固定任务', em: '跑一条固定任务' })
  const problems = judgeFrontDoor({ readme: wrong, other: { name: 'README_zh.md', text: ZH } })
  assert.ok(
    problems.some((problem) => /bold tagline is Chinese, but the file is English/u.test(problem)),
    problems.join(' / '),
  )
})

test('two taglines in the same language are reported even with one front door', () => {
  // The shape this repository had on 2026-11-14: one italic motto, no bold line, and no way to tell
  // which half was missing. A pair in one language is the same defect one step later.
  const problems = judgeFrontDoor({ readme: door({ strong: 'A', em: 'B' }), other: undefined })
  assert.equal(problems.length, 1, problems.join(' / '))
  assert.match(problems[0], /same language/u)
})

test('two translations instead of a mirror are reported', () => {
  // The failure mode the rule exists for: both sides are well-formed and each reads correctly on its
  // own, so nothing else anywhere reports that they say different things.
  const retranslated = door({ strong: '跑一条固定任务', em: 'See how it is assembled' })
  const problems = judgeFrontDoor({ readme: EN, other: { name: 'README_zh.md', text: retranslated } })
  assert.ok(
    problems.some((problem) => /not a mirror/u.test(problem)),
    problems.join(' / '),
  )
})

test('the mirror is reported for the italic half too', () => {
  const retranslated = door({ strong: 'Run one fixed task', em: '看它怎么装的' })
  const problems = judgeFrontDoor({ readme: retranslated, other: { name: 'README_zh.md', text: ZH } })
  assert.ok(
    problems.some((problem) => /not a mirror/u.test(problem)),
    problems.join(' / '),
  )
})

test('a single-language repository is not a defect', () => {
  // Most repositories in this family ship one front door. The rule is about the pair, so its absence
  // is not a finding — inventing one would make the check red for a shape the conventions allow.
  assert.deepEqual(judgeFrontDoor({ readme: EN, other: undefined }), [])
})

test('a front door with no two-line tagline is reported', () => {
  const motto = '<div align="center">\n  <p><em>The assembly is the variable.</em></p>\n</div>\n\n---\n\n'
  assert.equal(taglinesOf(motto), undefined)
  const problems = judgeFrontDoor({ readme: motto, other: undefined })
  assert.equal(problems.length, 1, problems.join(' / '))
  assert.match(problems[0], /no two-line tagline/u)
})

test('a file with no front matter at all is reported, not skipped', () => {
  assert.equal(taglinesOf('# Just a heading\n'), undefined)
})

test('a second front door this rule does not know is reported', () => {
  // `README.ja.md` is a real shape elsewhere in the ecosystem. Silently ignoring it would report the
  // repository as compliant while saying nothing about the pair.
  const problems = judgeFrontDoor({ readme: EN, other: { name: 'README.ja.md', text: ZH } })
  assert.equal(problems.length, 1, problems.join(' / '))
  assert.match(problems[0], /not a front door this rule knows/u)
})
