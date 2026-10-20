# Cross-repository criteria

[English](criteria.md) | [中文](criteria_zh.md)

**Who this is for**: you are judging whether a difference between repositories, or a published package, is
a **defect** — a pull request that changes the version, a release that reads the wrong thing, two
repositories that stopped looking alike, a package that no longer carries what the market needs.

**This document holds no rules of its own.** Every row names a rule that lives in
[plugin-conventions.md](plugin-conventions.md), gives it a tier, and names the file or script that judges
it. "Is this actually enforced?" has an answer here rather than an opinion.

**Who this is not for**: learning what to build (that is the conventions), working in one repository (that
repository's `AGENTS.md`), running a release (that repository's `docs/PUBLISHING.md`).

**What stays out**: arguments, trade-offs and post-mortems → [.agents/notes/](../.agents/notes/).

Not every row binds every repository in this organization — the plugin, the organization and the market
repositories each carry a different share. Which share is which is
[the conventions' scope section](plugin-conventions.md), not this document.

Three tiers. The last column of the table is not prose: it names the file or script that judges the row.

| Tier | Meaning |
|---|---|
| **Must agree** | a disagreement is a defect and has to become a check |
| **Should agree** | the decision logic is shared, the parameters are per repository |
| **Capability optional** | the rule genuinely does not apply — **not** that it was switched off |

| Rule | Tier | Where it lands |
|---|---|---|
| A published package carries the four inputs of the conventions (§2) | Must agree | `check:release` per repository (it asserts what the tarball and manifest contain); the market's diagnostics make an omission visible |
| A published package does **not** carry the images only the README shows: they live in the repository and are referenced relatively | Must agree | a redline assertion per repository — the exclusion entries present, the README using relative paths, the runtime assets still in the package |
| A merged version reaches npm | Must agree | the post-release check in each repository's `docs/PUBLISHING.md`; detected org-wide by the market's drift report |
| Every declared host family is judged by the patrol | Must agree | `scripts/check-declaration.mjs` per repository, printing a count per line |
| The lockfile's `resolved` must point at the official registry | Must agree | a redline assertion per repository (the count is computed, never copied into a document) |
| **One package manager only: pnpm**, with `pnpm-lock.yaml` as the sole lockfile | Must agree | stated in the template; a migrated repository's `.prettierignore` falls into place under `scaffold check` |
| A missing peer → fail; missing dev only → warn and skip | Should agree | shared decision logic (**default fail**); which host line it follows is per repository |
| peer and dev versions must agree | Must agree | a redline assertion per repository |
| The four compiler switches and ESLint each own their layer | Should agree | redlines per repository guard that the switches exist; **the switch values stay in `tsconfig.json`**, tool parameters are per repository |
| Release-state invariants | Must agree | `check:release` per repository (the template ships one; repositories **append** and drop nothing); a pure host plugin may be exempt from the `files` item, **the host compatibility range must not be** |
| The release flow must **not** bump the version | Must agree | `findVersionWrites` inside `check:release`, **with a negative control**. Bumping is its own step before a release |
| **Both manual and tag can trigger**, and on a tag trigger the baseline excludes the tag being released | Must agree | an assertion in each repository's release flow |
| **The body reads the Drafter draft** and **the draft is retired afterwards**, with a **warning when it cannot be read** | Must agree | an assertion in each repository's release flow. Without the warning, "the release succeeded but the body came from the fallback" is a silent failure |
| **npm publishing goes through OIDC**, no token at any point | Must agree | each repository's release flow; the prerequisite is a Trusted Publisher on npm (done by a human, no template can carry it) |
| Before releasing, confirm the commit to release is already on the **remote** | Must agree | the "before you release" section of each repository's `docs/PUBLISHING.md` |
| A release must produce git-side artifacts of the **same shape** (tag shape, Release exists, pre-release marked) | Must agree | an assertion in each repository's release flow. The tag name is read by **a machine** (the guard uses `git describe --match`), so it is not pure aesthetics |
| The host compatibility declaration must be **self-consistent**, and the **whole string** is comparable across repositories | Must agree | redlines per repository (self-consistency); the string itself is compared by reading each published manifest. Whether the strings agree today is a fact to re-measure, never a value to copy here |
| The criterion for a dependency's category is "**our relationship to it**": `import type` only → `devDependencies`; **consuming a service it provides** → `peerDependencies` | Must agree | each repository's `AGENTS.md`. When the criterion and the current state disagree, the next person deletes it by the rule |
| The tier of TypeScript's strict switches (`strict` / indexed access / optional properties) | Should agree | the **process** is shared: before enabling any switch, count the sites with the **real config** (not a CLI override), and enabling two at once must be tested separately; **the parameters are per repository**, with no cross-repository snapshot |
| Patrol items that "record but do not block" | Must agree | they must carry a reason, or a green run hides a real problem |
| Diagnostic steps (for example dumping the credential declaration at release time) | — | they are materialisation: **local to the workflow**, not extracted |
| Path-conflict assertions | — | **not written**: equivalent protection already exists, and a second copy is duplication |
| How CSS is injected, whether a stylesheet exists | Capability optional | per repository: the rule itself does not apply |
| The drafter's **category → label mapping** | Should agree | the organization copy is a **default**; labels are repository metadata and are set per repository |
| A client `inject` lists real dependencies only | Must agree | use the official bundled validator rather than writing prose |
| How links are written: **same repository → relative path**; **another repository (same organization or not) → absolute URL**; always `[]()`, never `<URL>` and never a bare URL. A URL that is a **value** rather than a reference goes in inline code | Must agree | each repository's `AGENTS.md`; files rendered on the organization profile page are the exception (their links must be absolute — see that repository's `AGENTS.md`) |

**Two kinds of content, governed apart**:

- **Assertions** (wrong = CI goes red on the spot, **loud**) — first.
- **Knowledge** (wrong = someone reads a stale guide, **quiet**) — the same batch, but not a redline.

**One fallback criterion**: when a repository cannot get past upstream's **type surface**, it **may stop
on the line that still builds** — building beats following the line. This does not conflict with the
criteria above: those say the declaration must be self-consistent with the line being recommended, while
this says the self-consistent target may be the lower line. Repositories stopping on different lines need
not be forced into alignment.

**Why the criteria live here rather than in one of the repositories** → [decision: cross-repository criteria live in the organization repository](../.agents/notes/2026-10-12-criteria-live-in-the-org-repo.md).

---

## How to check

- **Byte-identical copies** → compare bytes, not meaning. Execution body:
  `node scripts/scaffold.mjs check <repo>...` (SHA-256 of the template copy against each repository's
  same-named file). A mismatch is **not necessarily a defect** — it reports "know that it differs", not
  "force it to match". Which files are even candidates is `IDENTITY_FILES` in that script.
- **Shapes** → read them in [plugin-conventions.md](plugin-conventions.md) §1; do not copy values from it.
- **A rule cannot live only in prose** → whatever can become an assertion becomes one (redline tests,
  `check:*` scripts); prose keeps pointers only.
- **Contrastive descriptions ("A has it, B does not") go stale fastest** → they depend on both sides at
  once; before acting, re-check the original source.
- **The management-layer repositories check themselves**: the organization repository has no CI and is
  checked by hand (its `AGENTS.md`); the market has its own workflow, tests and diagnostics baseline (its
  `AGENTS.md`). No row here asks either of them to satisfy a plugin's obligations.

---

## Where this sits

- **What the rule actually is** → [plugin-conventions.md](plugin-conventions.md); this document never
  restates it.
- **What a plugin's published package must carry** → the conventions (§2), then the market's
  [market-format.md](https://github.com/dsh-plugin-lab/market/blob/main/docs/market-format.md) for field
  semantics.
- **Building a new plugin repository** → the scaffold: `node scripts/scaffold.mjs <dir> --verify`
- **Working in one plugin repository** → that repository's `AGENTS.md`
- **Running a release** → that repository's `docs/PUBLISHING.md`
