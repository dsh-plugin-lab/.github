# Repository conventions

[English](plugin-conventions.md) | [中文](plugin-conventions_zh.md)

**Who this is for**: you are looking at a repository in this organization and you need to know whether
something is a **defect** — a pull request that changes the version, a release that reads the wrong
thing, two repositories that stopped looking alike, a plugin whose published package no longer carries
what the market needs. **Section 5 is the operative part**: it is short, and its last column says which
script judges each rule. Start there.
**Who this is not for**: how to work in one repository (that repository's `AGENTS.md`), how to contribute
(this organization's `CONTRIBUTING.md`), how a release actually runs (that repository's
`docs/PUBLISHING.md`), how to check this organization repository (its `AGENTS.md`).
**What stays out**: arguments, trade-offs and post-mortems → [.agents/notes/](../.agents/notes/). This
document keeps criteria, one line of intent each, reopening conditions, how to check, and pointers.

## Three kinds of repository

Two layers, and a rule only applies to the layer it is about.

| Kind | What it produces | Which sections apply |
|---|---|---|
| **Plugin repository** — one per plugin | one npm package, which is also a DSH bundle | all of them |
| **Organization repository** (`dsh-plugin-lab/.github`) | nothing is published; it supplies fallback files and seeds new repositories | §1, §2, and the hygiene rows of §5 |
| **Market** (`dsh-plugin-lab/market`) | a generated index served from GitHub Pages; no package, no version | §1, §2, §4 as *consumer*, and the hygiene rows of §5 |

Intent: the organization repository and the market are **management-layer facilities** — they exist
because there are plugins, not as plugins. That is why they are outside §3's plugin shapes and §6's
release floors: applying those to a repository that publishes nothing would invent obligations nobody
can meet. They are still repositories in this organization, so everything about how a repository is
kept — fallbacks, CI, hooks, formatting, frozen installs — applies to them unchanged.

To decide where a file belongs, ask three questions in order:

1. **Does the mechanism support a fallback?** If yes → keep it in the organization repository (its
   `.github`), and no plugin repository changes a line.
2. **Is the content generic, but the mechanism has no fallback?** → independent per repository, with the
   shape recorded here.
3. **Is the content specific to one repository?** → independent per repository; this document does not
   concern itself.

---

## 1. What can fall back: the organization repository

GitHub reads these files only from the locations the platform supports, and **a repository with a file
of its own uses its own**. A new repository inherits them with no commit anywhere.

| File | Where | Applies to |
|---|---|---|
| `SECURITY.md` | repository root | repositories that do not ship their own |
| `CODE_OF_CONDUCT.md` | repository root | as above |
| `SUPPORT.md` | repository root | as above |
| `CONTRIBUTING.md` | repository root | as above |
| `PULL_REQUEST_TEMPLATE.md` | repository root | as above |
| `.github/ISSUE_TEMPLATE/*.yml` | **must be in `.github/ISSUE_TEMPLATE/`** | as above; once a repository creates that directory, these templates stop applying to it **altogether** |
| `.github/release-drafter.yml` | organization repository | repositories that do not ship a config of their own |
| `profile/README.md` | `profile/` | the organization profile page; not a fallback mechanism |

Four criteria that follow from the mechanism:

- **Issue templates must be under `.github/ISSUE_TEMPLATE/`** — at a repository root they do nothing;
  only that path is recognized. Symptom: a new issue offers nothing but a blank one, **with no error**.
- **There is no localization mechanism** — names such as `CONTRIBUTING_en.md` are not recognized.
  Bilingual means both languages in one file, not a second file.
- **The fallback happens only when the repository has no file of that name** — when repositories already
  carry their own `CONTRIBUTING.md`, the organization copy is never shown; it serves **repositories
  created later**.
- **The private-reporting entry described by `SECURITY.md`** is each repository's **Security → Report a
  vulnerability**, enabled per repository (**private repositories do not need it**: they are private
  already).

---

## 2. Generic but not extracted

**`workflow` files are explicitly not extracted**: no `workflow_call`; each repository carries its own
copy, held together by **shape**, not by bytes.

- **Intent**: one edit in the organization would otherwise change every repository at once — invisibly,
  since it appears in no repository's diff — and would cost a layer of cross-repository debugging.
- **Byte-identity is the exception, not the rule.** Only the draft-release workflow is required to be
  identical; `ci.yml`, `release.yml` and `compat.yml` are held together by **shape**, with
  per-repository parameters (job matrices, extra legs, repository-specific steps). Which files are even
  candidates is `IDENTITY_FILES` in `scripts/scaffold.mjs` — not prose, and not this document.
- **Reopening condition**: six or more plugin repositories, or a workflow that grows real branching
  logic and per-repository parameters.
- Reasoning and the rejected alternatives → [decision: workflow copies are not extracted](../.agents/notes/2026-10-12-workflow-copies-not-extracted.md).

**A scaffold seeds; it does not synchronise**: `scripts/scaffold.mjs` + `templates/plugin/` lay down a
new repository's skeleton **once** and never write back into an existing repository. Its `check`
subcommand is the execution body for the byte-identity criterion; `--verify` generates into a scratch
directory and runs the generated repository's own checks, which is what accepts a template edit.
Reasoning → [decision: the scaffold seeds, it does not sync](../.agents/notes/2026-10-12-scaffold-seeds-not-syncs.md).

**Carrier status**: no shared package and no extracted copies. Knowledge travels as pointers (the host's
official sources); assertions are written per repository, accepting two-way sync.

---

## 3. The shape the scaffold generates

**This is a target, not a claim of uniformity.** What follows is what `node scripts/scaffold.mjs`
produces and why; §3.9 lists the places where the four existing repositories legitimately differ from
it. A repository that matches the shape is not thereby correct, and one that differs is not thereby a
defect — what must agree is in §5.

**For a new repository, the shape is not copied from here**: the scaffold seeds it
(`node scripts/scaffold.mjs <dir>`, then `--verify` runs the generated repository's own checks). Read
this section to know **why** the generated file looks the way it does and **where it may legitimately
differ** — not to transcribe it.
**For an existing repository, this is the reference**: what the shape is, and the parts that are not
negotiable.

### 3.1 The CI closing job

The last job in each repository's `ci.yml`: it lets the ruleset watch a single status-check name, so
inner jobs can be added or removed without touching the ruleset.

Four things that cannot move:

- **Judge at step level only** — at job level a false condition turns the job `skipped`, and GitHub
  treats `skipped` as success. Intent: no false green.
- **`needs` must list every job id in the file** — miss one and that job can go red while this one still
  passes.
- **`if: always()`** — otherwise an upstream failure skips the closing job itself.
- **`skipped` goes red alongside `failure` and `cancelled`** — a job that never ran must not pass.

```yaml
  ci-success:
    name: CI Success
    runs-on: ubuntu-latest
    needs: [<all job ids in this file>]
    if: always()
    steps:
      - name: Verify all jobs succeeded
        if: contains(needs.*.result, 'failure') || contains(needs.*.result, 'cancelled') || contains(needs.*.result, 'skipped')
        run: |
          echo "::error::some job did not succeed — CI Success goes red"
          echo '${{ toJSON(needs) }}'
          exit 1
```

The ruleset's `required_status_checks` names `CI Success` and nothing else.

### 3.2 Dependency drift patrol

Only the `github-actions` ecosystem. Intent: most npm dependencies in this family sit on the host's
pre-release line, so automatic pull requests would only be noise.

```yaml
version: 2
updates:
  - package-ecosystem: github-actions
    directory: '/'
    schedule:
      interval: weekly
      day: monday
    commit-message:
      prefix: ci
    groups:
      actions:
        patterns: ['*']
```

### 3.3 Draft releases

The **workflow** is one per repository and, measured across the four, byte-identical:

```yaml
name: release-drafter

on:
  push:
    branches:
      - main
  workflow_dispatch:

permissions:
  contents: write

jobs:
  update-draft:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: release-drafter/release-drafter@v7
```

- **The runner must be pinned to ubuntu**. Intent: on a windows runner the action cannot find its config
  file, the draft comes out silently empty and **nothing errors** (the action's major version follows
  upstream).
- The draft summarises **pull requests**, not commits: a commit pushed straight to `main` is invisible to
  it. Trade-off, not a defect.

The **config** splits into two layers that do not land in the same place:

- The **shape** is shared (in the organization repository's `.github/release-drafter.yml`, which a
  repository without a config of its own falls back to): the draft's name, the change line
  `- $TITLE (#$NUMBER) @$AUTHOR`, the escaping set, the version resolver. **Repositories do not
  re-decide these.**
- The **category → label mapping is per repository**. Labels are **repository metadata** and genuinely
  differ. The organization copy is a **default, not a standard**: a repository whose labels differ ships
  a config of its own.

**`tag-template: 'next'` is not part of the negotiable layer** (unlike the categories): the publish flow
reads the draft by that tag. Changing it is not a config edit, it is a change to every flow that reads
it.

### 3.4 The package manager and the build

The family has **exactly one package manager**: pnpm, with `pnpm-lock.yaml` as the only lockfile. No
repository carries a second one; a script that clears install state clears `pnpm-lock.yaml` and nothing
else, because there is nothing else to clear.

- **`pnpm-workspace.yaml` declares the single-package workspace.** Intent: without it pnpm treats this as
  a non-workspace directory and the dependency tree stops matching the one CI installs.
- **Installs carry `--config.node-linker=hoisted`.** Intent: pnpm's symlink linker cannot resolve the
  browser half's peer packages in this tree, and the failure surfaces as a test that cannot see its own
  dependencies.
- **`pnpm/action-setup` comes before `actions/setup-node` in CI.** Intent: the other order leaves
  `cache: pnpm` without a store.
- **The local hook runs `pnpm exec`, not `npx`**, and carries `--config.verify-deps-before-run=false`.
  Intent: it borrows what the tree already has and downloads nothing.
- **The builder is per repository** (§3.9). The scaffold ships `tsdown` with two configurations in
  `tsdown.config.ts` (host half ESM, browser half a CJS envelope, the browser half's CSS Modules as a
  plugin of that file); a repository may instead run the compiler directly and build the browser half
  with a script. Both satisfy the criteria; the scaffold's choice is the one a new repository starts
  from.

### 3.5 TypeScript and the test skeleton

- One tsconfig per compilation target, and separate vitest configs for day-to-day and contract tests. The
  **counts differ per repository** (§3.9); what must agree is that the contract cases are excluded from
  the day-to-day run and that the contract config runs on its own (no parallelism, relaxed timeout).
- `strict` is mandatory. Compiler switches own types and dead code; ESLint owns the layer the compiler
  does not cover (formatting, hooks, promises, imports) — **the division of labour is the same across
  repositories, the tool parameters are not** (semicolons and quotes already differ).
- **Local hooks run second-scale checks only** (formatting and lint autofixes, and tests that need no
  network); typecheck and tests that need the network or the history belong to CI. Intent: a slow hook
  gets bypassed with `--no-verify`, which amounts to having no hook.
- CI installs always run in frozen mode, never resolving new versions over the network.
- **One pair of files per maintainable directory**: `AGENTS.md` says how to work there, `README.md` says
  what is there and what to change; a fact has exactly one home, and cross-file mentions are pointers
  only.

### 3.6 Release-state guards and the compatibility patrol

- **Release-state invariants** become a `check:release` script, run by the release flow **before**
  publish. The scaffold template ships one, so a new repository satisfies this criterion the day it is
  created; a repository **appends** its own assertions after it and drops none of these.
- **The release noise guard** (`scripts/release-guard.mjs`) judges whether a change set can change what
  is on npm. **By exclusion**: an unrecognised path counts as an artifact — missing a release (someone
  answers again) beats blocking one that should have happened.
- **The compatibility patrol** watches whether upstream moved; a local commit cannot change its verdict,
  so it runs weekly and **is not attached to `push`**.
- **Declaring a family obliges you to judge it.** When the declaration is a union (`^a || ^b || ^c`), the
  patrol judges **every** line, and the script prints a count per line. Intent: a two-family declaration
  whose patrol only exercised `next` is two-thirds verified while looking green — that is what the
  declaration is for, and a dropped leg is a defect, not a simplification.
- **Testing any family requires narrowing the declaration to that family first** — **not only the lower
  one**. Intent: under a union the install produces a **mixed tree**, and the "move to some line" step
  tests a line that is not the one named.
  Mechanism → [evidence: the installer picks the family by `latest`](../.agents/notes/2026-10-12-installer-picks-latest-family.md).
- **Narrowing collides with two redlines that read `package.json`**: put the family prefix on a
  machine-input line (a matrix value or a `run`), never in a workflow comment; and restore the manifest
  to its committed state before typecheck / build / test. Intent: a redline judges the repository's
  declaration, not the temporary narrowed form. Reasoning → [decision: narrowing and the redlines](../.agents/notes/2026-10-12-narrowing-and-redlines.md).
- **Legs that only record**: a patrol leg may be `continue-on-error`, and then it must carry a stated
  reason in the workflow itself. Intent: without one, a permanently red leg is indistinguishable from a
  permanently green one.
- **Visibility when the patrol goes red**: a scheduled run's failure mail reaches only whoever last
  edited the cron, so it cannot be the main notification — a failure must open or update a tracking
  issue with a **fixed title** (the same failure does not get a fresh comment every time).

### 3.7 The plugin icon

One `icon.svg` at the package root, declared as `"icon": "./icon.svg"`, and shipped in the package's
`files` (§4).

- **Canvas 36×36**: `viewBox="0 0 36 36"`, and `width` / `height` agree with it.
- **Transparent background**: `fill="none"` on `<svg>`, and **no rectangle covering the canvas**. Intent:
  the host draws the file on its own surface, so a baked-in background shows up as a coloured tile.
- **Judge the rendered geometry, not the attribute values.** A rectangle is "covering the canvas" only
  after every enclosing `transform` is applied, and a `<rect>` inside `<defs>` (a `clipPath`, a `mask`, a
  gradient) paints nothing at all. Both traps are live: a large `width`/`height` rectangle may be a
  **clip path**, and a plate may sit inside a group whose `transform` scales and translates it so that
  it lands inside the margin — inset, rounded, and compliant, because the canvas edge stays transparent.
  Grepping for `<rect>` and judging by its numbers gets such an icon wrong; read the group it sits in.
- **A plate that is part of the mark is allowed**, provided it is inset and rounded and the artwork sits
  on top of it — that is what the margin rule below implies. What is forbidden is the full-bleed
  square-cornered rectangle, which reads as a background box rather than as a mark.
- **The artwork is centred**, with **7–9** of margin on its **tight axis**. A square mark gets the same
  margin on all four sides; a wide or tall mark is letterboxed — the tight axis holds the margin, the
  other axis takes whatever centring yields.
- **Colours are baked.** No `currentColor`, no theme variables, no CSS: the host renders the file as an
  image, so none of them resolve. Artwork may use its own colours. A comment explaining *why*
  `currentColor` is banned is not a violation.
- **Geometry, gradients and filters only.** No scripts, no external references.
- **An XML comment must not contain a double hyphen** (`--`). The file then stops parsing as an image and
  the host falls back to its default artwork, **silently**.
- Accepted formats and the size ceiling are the **host's** limits, not ours — take them from the host's
  own plugin reference rather than copying them here.

### 3.8 The release flow

The implementation is **each repository's own** (the template ships a reference implementation meeting
the four below). Those four are the behavioural floor:

| Floor | Criterion |
|---|---|
| **Both entry points, manual and tag** | A tag trigger carries its own gate: the tag name must equal `v` plus the manifest version |
| **The release body reads the Drafter draft** | Falls back to `--generate-notes` when the draft cannot be read or is empty, and **must warn when it cannot be read** |
| **The draft is retired afterwards** | The one whose tag does not start with `v`; no formal release is touched |
| **npm publishing goes through OIDC** | No token at any point; the cost is one Trusted Publisher configured on npm |

Four things that are easy to miss, and all four fail **silently**:

- **On a tag trigger the guard's baseline must exclude the tag being released.** Otherwise `describe`
  resolves to that tag itself, the range is empty, and a perfectly normal release is judged as "nothing
  to release".
- **The "only from main" check must be guarded by `github.event_name`.** Without it `github.ref` is
  `refs/tags/...` on a tag trigger and every tag-triggered release goes red.
- **Check that the Release does not already exist before creating it.** Without that idempotency a re-run
  collides with the existing tag and goes red.
- **Clean the draft body by matching the action's own line, not the full wording of the notice.** That
  wording belongs to the organization template; copying it verbatim is a sed that fails silently the
  moment it changes.

**Left to each repository, not required to match**: the check chain before publish, the environment name,
whether a GitHub App token is needed to push to the default branch, the retry policy for creating a
Release. Their prerequisites (labels, environments, secrets, rulesets, the npm backend) **are not files**,
so no template can carry them — each repository's `docs/PUBLISHING.md` states its own.

**A publish can fail for reasons no file can fix.** The one seen in practice: an expired Trusted
Publisher binding makes the OIDC exchange return 404, and the package silently stays on its previous
version. That is why §4 asks that a merged version reach npm, and why the market reports the drift: the
gap between "merged" and "published" is invisible from inside the repository.

### 3.9 Where repositories legitimately differ

Same shape, different parameters or counts. None of these is a defect on its own; §5 is what must agree.

| What may differ | Why it is allowed |
|---|---|
| Builder: `tsdown`, or the compiler plus a browser-half script | both produce the host half and the browser half; the scaffold ships `tsdown` |
| Number of `tsconfig` files: one per compilation target | a test config is added only when tests are compiled separately |
| Number of `vitest` configs: two where contract tests exist, one where they do not | the contract config exists to run them apart |
| `compat.yml`: legs, targets, blocking versus record-only | the declared families differ per repository's history |
| `ci.yml` / `release.yml`: jobs, matrices, steps | nothing cross-repository reads them but the closing-job rule |
| **Not** the draft-release workflow | it must be identical (§2) |

**Do not record the current values here.** How many of each, and which builder a given repository uses,
are facts that change without this document — read them from the repository, or compare with
`scaffold check`. What is recorded above is the **category** each difference falls into.

---

## 4. What a published package must carry

The market reads the **published artifact**, never a checkout, so anything it needs has to survive into
the tarball and the registry manifest. A plugin that omits these still installs — but its market entry
degrades **silently**: no title, no icon, a version that disappears from the list.

| What | Where it is read from | What "missing" looks like |
|---|---|---|
| `locale/<language>.json` with `meta.title` and `meta.description`, **and an `en` entry** | the published tarball | the entry shows the package name instead of a title |
| An icon file, **declared by `icon` in `package.json`** and shipped by `files` | the published tarball, at the declared path | the entry has no icon |
| `engines.dsh` as a valid SemVer range, never a `workspace:` range | the registry manifest | the entry loses its compatibility range, or resolves to "any" |
| `author` | the registry manifest | the entry has a blank author line |

Two further obligations, both about the artifact rather than the repository:

- **A version merged to `main` must reach npm.** A merge is not a release; between the two the market
  keeps advertising the previous version and every check here is correctly green. Each repository's
  `docs/PUBLISHING.md` says how it proves the published version is the merged one.
- **Publishing is the only way to change any of the above.** Editing a manifest in the repository changes
  nothing that a reader sees until a release ships.

**Field semantics live elsewhere, on purpose**: which JSON key, which path, what the reader does with an
unknown member → the market's [market-format.md](https://github.com/dsh-plugin-lab/market/blob/main/docs/market-format.md).
This section states the **obligation**; that document is the **contract**. Neither copies the other.

---

## 5. Criteria, item by item (cross-repository consistency)

**This is the section to act on.** The last column is not prose: it names the file or script that judges
the rule, so "is this actually enforced?" has an answer rather than an opinion. Everything in sections 1–4
explains *why* a row below holds; nothing here needs to be read in order.

The three tiers:

| Tier | Meaning |
|---|---|
| **Must agree** | a disagreement is a defect and has to become a check |
| **Should agree** | the decision logic is shared, the parameters are per repository |
| **Capability optional** | the rule genuinely does not apply — **not** that it was switched off |

| Rule | Tier | Where it lands |
|---|---|---|
| A published package carries the four inputs of §4 | Must agree | `check:release` per repository (it asserts what the tarball and manifest contain); the market's diagnostics make an omission visible |
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

## 6. How to check

- **Byte-identical copies** → compare bytes, not meaning. Execution body:
  `node scripts/scaffold.mjs check <repo>...` (SHA-256 of the template copy against each repository's
  same-named file). A mismatch is **not necessarily a defect** — it reports "know that it differs", not
  "force it to match". Which files are even candidates is `IDENTITY_FILES` in that script.
- **Shapes** → read the criteria here; do not copy values from here.
- **A rule cannot live only in prose** → whatever can become an assertion becomes one (redline tests,
  `check:*` scripts); prose keeps pointers only.
- **Contrastive descriptions ("A has it, B does not") go stale fastest** → they depend on both sides at
  once; before acting, re-check the original source.
- **The management-layer repositories check themselves**: the organization repository has no CI and is
  checked by hand (its `AGENTS.md`); the market has its own workflow, tests and diagnostics baseline (its
  `AGENTS.md`). No row in §5 asks either of them to satisfy a plugin's obligations.

---

## Where this document sits

| You are | Read |
|---|---|
| Judging whether something is a defect here | **section 5**, and the file named in its last column |
| Checking what a plugin's published package must carry | **section 4**, then the market's [market-format.md](https://github.com/dsh-plugin-lab/market/blob/main/docs/market-format.md) for field semantics |
| Building a **new** plugin repository | the scaffold, not this document: `node scripts/scaffold.mjs <dir> --verify` |
| Working **in** one plugin repository | that repository's `AGENTS.md` |
| Working **in** the market | that repository's `AGENTS.md` and `docs/ARCHITECTURE.md` |
| Running a release in one plugin repository | that repository's `docs/PUBLISHING.md` |
| Contributing code | this organization's [CONTRIBUTING.md](../CONTRIBUTING.md) |
| Maintaining **this** organization repository | its [AGENTS.md](../AGENTS.md) |
