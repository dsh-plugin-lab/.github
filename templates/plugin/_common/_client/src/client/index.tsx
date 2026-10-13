/**
 * Browser half entry point.
 *
 * The build script wraps this into the lazy-CJS factory envelope the host's client module system
 * wants (`window.__ModuleLoader__.load({ id, factory })`, with `id` equal to the package name), so
 * this file is ordinary ESM + JSX and the envelope is a build-time concern.
 *
 * **Keep the factory body free of side effects**: styles, timers and listeners are registered inside
 * `apply` with `ctx.effect` / `ctx.on`, and return their cleanup.
 *
 * The context type here is a **hand-written structural type**, not an import from the host packages:
 * a skeleton has to compile on its own and must not go red because one type augmentation is missing.
 * Replace it once the real host types are wired in.
 */

import { dictionaryFor, type LocaleKey, NS } from './locales.ts'

/**
 * The client services this plugin needs. It uses slots, so it lists slots — declaring a service you
 * never touch complicates startup ordering for nothing.
 */
export const inject = ['slots']

/** The slice of the host surface this plugin reaches for. Delete this alias once the real types are in. */
type ClientContext = {
  locale?: { language?: string }
  slots: {
    inject(name: string, callback: () => unknown): unknown
    register(options: { name: string; id: string; order?: number }, component: unknown): unknown
  }
}

/** The slot this plugin occupies. Changing it means changing this and `dsh.client.inject` together. */
const SLOT = 'conversation.composer.dock'

export function apply(ctx: ClientContext): void {
  // The dictionary is read once, at apply time. **A real component subscribes to the language
  // service** so it re-reads on a language switch; the skeleton skips that because it holds a single
  // constant entry and subscribing would change nothing observable.
  const text = dictionaryFor(ctx.locale?.language ?? 'en')
  ctx.slots.inject(SLOT, () =>
    ctx.slots.register({ name: SLOT, id: '{{name}}', order: 5 }, () => Marker(text)),
  )
}

/**
 * The one visible thing in the skeleton: a small dot that does not fight for layout.
 *
 * Its accessible name goes through the dictionary — "visible text goes through the dictionary" holds
 * from the very first line of code, so the rule is in place before there is any content to break it.
 * `currentColor` rather than a hard-coded colour, so the container inherits the host theme.
 */
function Marker(text: Record<LocaleKey, string>) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={16}
      height={16}
      role="img"
      aria-label={text['marker.label']}
      style={{ display: 'block', pointerEvents: 'none' }}
    >
      <circle cx={32} cy={32} r={24} fill="currentColor" />
    </svg>
  )
}

/** The dictionary namespace is the package name — the same value as the `locale` field on the slot. */
export { NS }
