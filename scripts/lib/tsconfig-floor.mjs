/**
 * The four dead-code switches, judged from parsed configs rather than from a network.
 *
 * Split out of the checker for one reason: the thing this rule exists to prevent is *silently
 * passing*. A check that reads GitHub cannot be tested by breaking a local file — the checker sees
 * the pushed copy, so a local edit proves nothing. Keeping the decision pure means the failures can
 * be produced on purpose, which is the only way to know the rule has teeth.
 */

/** The floor. A repository may enable more; these four are not optional. */
export const DEAD_CODE_SWITCHES = [
  'noUnusedLocals',
  'noUnusedParameters',
  'noImplicitReturns',
  'noFallthroughCasesInSwitch',
]

/** A config that inherits its switches from another file is answered there, not here. */
function inherits(parsed) {
  return typeof parsed.extends === 'string' || Array.isArray(parsed.extends)
}

/**
 * `configs` is `[{ path, parsed }]` — every `tsconfig*.json` at the repository root, already parsed.
 * `parsed` is `undefined` when the file could not be read as JSON-with-comments.
 *
 * Returns the problems, in the order a reader would want to fix them; `[]` means the floor holds.
 */
export function judgeTsconfigFloor(configs) {
  if (configs.length === 0) return ['no tsconfig*.json at the repository root']

  const problems = []
  let judged = 0

  for (const { path, parsed } of [...configs].sort((a, b) => (a.path < b.path ? -1 : 1))) {
    if (parsed === undefined) {
      problems.push(`${path} is not parseable as JSON with comments`)
      continue
    }
    if (inherits(parsed)) continue
    const options = parsed.compilerOptions
    if (options === undefined) {
      problems.push(`${path} declares no compilerOptions object`)
      continue
    }
    judged += 1
    for (const flag of DEAD_CODE_SWITCHES) {
      if (options[flag] !== true) {
        problems.push(
          `${path}: ${flag} is ${options[flag] === false ? 'false' : 'absent'}; the floor requires true`,
        )
      }
    }
  }

  // Self-check. If every config inherited, nothing was judged and an empty problem list would be
  // indistinguishable from a pass — the exact confusion this whole module is about.
  if (judged === 0 && problems.length === 0) {
    problems.push(
      `every tsconfig*.json inherits from another file; no standalone list was found to judge (${configs.map((config) => config.path).join(', ')})`,
    )
  }
  return problems
}
