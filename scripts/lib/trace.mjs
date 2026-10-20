/**
 * One trace format for both scripts: `[scope] message`, on stderr.
 *
 * The check has one property that is hard to see from the outside — it fetches each file exactly
 * once per run and serves every later criterion from memory. A cache that works and a cache that
 * silently re-downloads forty files look identical in the final report, so the reuse is traced
 * rather than asserted.
 *
 * Off by default: a scheduled run's log should be the report, not the plumbing. Turn it on with
 * `--trace` or `CRITERIA_TRACE=1`.
 *
 * stderr, not stdout: the report is stdout, and `--json` has to stay parseable.
 */
const ENABLED = process.env.CRITERIA_TRACE === '1' || process.argv.includes('--trace')

export function trace(scope, message) {
  if (!ENABLED) return
  process.stderr.write(`[${scope}] ${message}\n`)
}

export const tracing = ENABLED
