import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * A green local run must not be able to push red.
 *
 * `pnpm run check` and the CI `verify` job answer the same question — "is this safe to push?" — so
 * `check` cannot be narrower than the gate it stands for. It was narrower once, in the template this
 * repository was made from: `check` ran typecheck / build / test while CI also ran `lint` and
 * `format:check`. A source file edited outside the formatter passed the local suite and went red on
 * the push, which is the cheapest kind of defect to produce and the least useful moment to find it.
 *
 * The reverse direction is deliberately **not** asserted: `check` may run more than CI (the
 * release-state check belongs to a push, not to a verification job), and forcing the two into an
 * identity would make the release guard look like something CI must also run.
 *
 * Seeded rather than grown: unlike the redlines about this plugin's own behaviour, this invariant is
 * true of every repository here before it has any behaviour at all.
 */

/**
 * The CI steps that `check` has to cover — the `pnpm run <step>` lines the verify job actually runs.
 *
 * The step may be written inline (`- run: pnpm run lint`) or as a mapping with a `name:` above it
 * (`- name: Format check` then `run: pnpm run format:check`), so the `-` is optional here. It was
 * mandatory in the first version of this file, and the negative control below is what caught it:
 * `format:check` was silently missing from the list, so the coverage assertion had one fewer step to
 * check than CI actually runs.
 */
function ciSteps(): string[] {
  const workflow = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8')
  const steps = [...workflow.matchAll(/^\s*(?:-\s+)?run: pnpm run ([\w:-]+)$/gmu)].map(
    (match) => match[1],
  )
  return [...new Set(steps)].filter((step): step is string => step !== undefined)
}

function checkScript(): string {
  const manifest = JSON.parse(
    readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
  ) as {
    scripts?: Record<string, string>
  }
  return manifest.scripts?.check ?? ''
}

describe('`pnpm run check` covers every step CI runs', () => {
  it('the reader really saw CI steps — an empty list would make this vacuous', () => {
    // The failure this guards against is a regex that matches nothing after the workflow is
    // reformatted: the loop below would then assert nothing and pass forever.
    expect(ciSteps().length).toBeGreaterThan(0)
  })

  it('no CI step is missing from `check`', () => {
    const check = checkScript()
    const missing = ciSteps().filter((step) => !check.includes(`pnpm run ${step}`))
    expect(
      missing,
      `CI runs a step that \`pnpm run check\` does not: ${missing.join(', ')}`,
    ).toEqual([])
  })

  it('this assertion has teeth (negative control)', () => {
    // The detector, applied to a `check` that leaves the formatter out — the exact shape of the
    // defect described above. Without this case the test above could be green for the wrong reason.
    const detector = (check: string) =>
      ciSteps().filter((step) => !check.includes(`pnpm run ${step}`))
    expect(
      detector('pnpm run typecheck && pnpm run build && pnpm run test && pnpm run lint'),
    ).toContain('format:check')
  })
})
