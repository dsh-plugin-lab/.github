/**
 * Localization dictionary. `zh` is the source of truth for the key set; `en` is typed as
 * `Record<LocaleKey, string>` so a missing key is a compile error.
 *
 * **Every** visible string in the UI goes through here rather than being written into a component.
 * The reason is practical: the dictionary is plain data, so a test can import it and reconcile key
 * sets, whereas strings buried in components cannot be counted by anyone.
 */

/** Dictionary namespace. Must match the `locale` field on the slot registration. */
export const NS = '{{name}}'

/** Chinese dictionary (the source of truth for the key set). */
export const zh = {
  'marker.label': '{{displayName}}',
} as const

/** Dictionary key. */
export type LocaleKey = keyof typeof zh

/** English dictionary. A missing key is a compile error. */
export const en: Record<LocaleKey, string> = {
  'marker.label': '{{displayName}}',
}

/** Look up a dictionary. An unknown language falls back to English. */
export function dictionaryFor(language: string): Record<LocaleKey, string> {
  return language.toLowerCase().startsWith('zh') ? zh : en
}

/**
 * Minimal interpolation: replaces `{name}` with the argument, and leaves a key it cannot resolve
 * exactly as it found it (neither throwing nor swallowing it).
 *
 * The `?? whole` is not decoration: with `noUncheckedIndexedAccess` on, an index access has type
 * `string | undefined`, and without it this line is TS2769 — and that switch is on in the reference
 * repositories, so the template has to pass under both.
 */
export function interpolate(template: string, params: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? (params[name] ?? whole) : whole,
  )
}
