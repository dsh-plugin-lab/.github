/**
 * The front door's tagline: two lines, and they swap.
 *
 * Split out of the checker for the reason this directory exists: a check that reads GitHub cannot be
 * tested by breaking a local file, so a local edit proves nothing. Keeping the decision pure lets the
 * failures be produced on purpose — the only way to know the rule has teeth.
 *
 * The rule and its intent are in docs/plugin-conventions.md §1.10; this file only judges.
 *
 * **Which language a front door is in comes from its file name, never from a default.**
 * `README.md` is the Chinese half in some repositories and the English half in others, with
 * `README_en.md` or `README_zh.md` as the second file accordingly. A checker that assumed "README.md
 * is English" would be wrong in those repositories and, worse, would report them as compliant after
 * they drifted. Never state how many repositories are in either group: the split is not a constant.
 */

/** A CJK ideograph. The taglines in this family are English and Chinese, so this is the whole test. */
const CJK = /[\u4e00-\u9fff]/u

/** The language a second front door's *file name* claims. `README.md` takes the other one. */
const LANGUAGES = new Map([
  ['README_zh.md', 'zh'],
  ['README_en.md', 'en'],
])

/**
 * The bold and italic taglines of one front door.
 *
 * Only the front matter is read — everything above the first horizontal rule. The language switcher
 * cannot be mistaken for a tagline: its `</strong>` is followed by more text on the same line, so
 * `<p><strong>…</strong></p>` does not match it.
 *
 * @param text - the README's contents.
 * @returns the two taglines; `undefined` when the file has no front matter to read, or no pair.
 */
export function taglinesOf(text) {
  const end = text.indexOf('\n---\n')
  if (end === -1) return undefined
  const header = text.slice(0, end)
  const strong = /<p><strong>(.+?)<\/strong><\/p>/u.exec(header)?.[1]
  const em = /<p><em>(.+?)<\/em><\/p>/u.exec(header)?.[1]
  if (strong === undefined || em === undefined) return undefined
  return { strong, em }
}

/**
 * What one front door's own tagline pair says, without reference to the other file.
 * @param name - the file name, used in every message.
 * @param text - the file's contents.
 * @param language - the language this file is supposed to be written in, or `undefined` when the
 *   repository has one front door only and nothing to infer it from.
 * @returns the problems and the parsed pair.
 */
function judgeOne(name, text, language) {
  const problems = []
  const pair = text === undefined ? undefined : taglinesOf(text)
  if (pair === undefined) {
    problems.push(`${name} has no two-line tagline in its front matter`)
    return { problems, pair }
  }

  const strongIsChinese = CJK.test(pair.strong)
  const emIsChinese = CJK.test(pair.em)

  // Independent of which language the file is in: a reader who only reads one of them still has to
  // see both, or the pair is not a pair.
  if (strongIsChinese === emIsChinese) {
    problems.push(`${name}: the bold and italic taglines are in the same language`)
  }

  if (language !== undefined) {
    const wantChinese = language === 'zh'
    // The bold line is what a reader of this file understands without switching, so it carries this
    // file's language.
    if (strongIsChinese !== wantChinese) {
      problems.push(`${name}: the bold tagline is ${strongIsChinese ? 'Chinese' : 'English'}, but the file is ${wantChinese ? 'Chinese' : 'English'}`)
    }
  }

  return { problems, pair }
}

/**
 * Judge a repository's front doors.
 *
 * @param readme - `README.md`'s contents.
 * @param other - the second front door as `{ name, text }`, or `undefined` when the repository has
 *   one. `name` must be `README_zh.md` or `README_en.md`.
 * @returns the problems, in the order a reader would want to fix them; `[]` means the rule holds.
 */
export function judgeFrontDoor({ readme, other }) {
  const otherLanguage = other === undefined ? undefined : LANGUAGES.get(other.name)
  if (other !== undefined && otherLanguage === undefined) {
    return [`${other.name} is not a front door this rule knows: expected README_zh.md or README_en.md`]
  }

  // `README.md` takes the language the second file does not claim.
  const readmeLanguage = otherLanguage === undefined ? undefined : otherLanguage === 'zh' ? 'en' : 'zh'

  const primary = judgeOne('README.md', readme, readmeLanguage)
  const problems = [...primary.problems]
  if (other === undefined) return problems

  const second = judgeOne(other.name, other.text, otherLanguage)
  problems.push(...second.problems)

  // The pair is one mirror, not two translations. Two front doors stating different things are two
  // documents, and whichever one a reader lands on is the whole story they get.
  if (primary.pair !== undefined && second.pair !== undefined) {
    if (primary.pair.strong !== second.pair.em) {
      problems.push(`the two front doors are not a mirror: README.md bold ≠ ${other.name} italic`)
    }
    if (primary.pair.em !== second.pair.strong) {
      problems.push(`the two front doors are not a mirror: README.md italic ≠ ${other.name} bold`)
    }
  }

  return problems
}
