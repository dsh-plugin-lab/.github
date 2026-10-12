# Plugin repository conventions

[English](plugin-conventions.md) | [中文](plugin-conventions_zh.md)

**What this document is for**: which things belong at the organization level, which each repository keeps for itself, and — for the latter — the **standard shapes** and the **criteria, item by item**.
**Readers**: whoever creates a new plugin repository (copy the shapes) and maintainers (to check against).
**Not its job**: a repository's own business and design → that repository's `AGENTS.md` and `docs/ARCHITECTURE.md`.
**What stays out**: arguments, trade-offs and post-mortems → [.agents/notes/](../.agents/notes/). This document keeps criteria, one line of intent each, reopening conditions, how to check, and pointers.

To decide where a file belongs, ask three questions in order:

1. **Does the mechanism support a fallback?** If yes → keep it in the organization repository (its `.github`), and no plugin repository changes a line.
2. **Is the content generic, but the mechanism has no fallback?** → independent per repository, with the shape recorded here.
3. **Is the content specific to one repository?** → independent per repository; this document does not concern itself.

---

## 1. What can fall back: the organization repository

GitHub reads these files only from the locations the platform supports, and **a repository with a file of its own uses its own**. A new repository inherits them with no commit anywhere.

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

- **Issue templates must be under `.github/ISSUE_TEMPLATE/`** — at a repository root they do nothing; only that path is recognized. Symptom: a new issue offers nothing but a blank one, **with no error**.
- **There is no localization mechanism** — names such as `CONTRIBUTING_en.md` are not recognized. Bilingual means both languages in one file, not a second file.
- **The fallback happens only when the repository has no file of that name** — when repositories already carry their own `CONTRIBUTING.md`, the organization copy is never shown; it serves **repositories created later**.
- **The private-reporting entry described by `SECURITY.md`** is each repository's **Security → Report a vulnerability**, enabled per repository (**private repositories do not need it**: they are private already).

---

## 2. Generic but not extracted

**`workflow` files are explicitly not extracted**: no `workflow_call`; each repository carries a byte-identical copy.

- **Intent**: one edit in the organization would otherwise change every repository at once — invisibly, since it appears in no repository's diff — and would cost a layer of cross-repository debugging.
- Copies are held together by being **byte-identical**, not by generation from a template; when two copies disagree, the shapes in this document win.
- **Reopening condition**: six or more plugin repositories, or a workflow that grows real branching logic and per-repository parameters.
- Reasoning and the rejected alternatives → [decision: workflow copies are not extracted](../.agents/notes/2026-10-12-workflow-copies-not-extracted.md).

**Carrier status**: no shared package and no extracted copies. Knowledge travels as pointers (the host's official sources); assertions are written per repository, accepting two-way sync.

---

## 3. Standard shapes for what each repository keeps

Only shapes below — no values that drift (version numbers, counts, line names). A new repository copies the shapes; an existing one is checked against them.

### 3.1 The CI closing job

The last job in each repository's `ci.yml`: it lets the ruleset watch a single status-check name, so inner jobs can be added or removed without touching the ruleset.

Four things that cannot move:

- **Judge at step level only** — at job level a false condition turns the job `skipped`, and GitHub treats `skipped` as success. Intent: no false green.
- **`needs` must list every job id in the file** — miss one and that job can go red while this one still passes.
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

Only the `github-actions` ecosystem. Intent: most npm dependencies in this family sit on the host's pre-release line, so automatic pull requests would only be noise.

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

The **config** lives in the organization repository (`.github/release-drafter.yml`; a repository with no config of its own falls back to it).
The **workflow** is one per repository, byte-identical:

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

- **The runner must be pinned to ubuntu**. Intent: on a windows runner the action cannot find its config file, the draft comes out silently empty and **nothing errors** (the action's major version follows upstream).
- **The draft's tag name is decoupled from the version number** — the draft takes a fixed name and does not take `v<version>`. Intent: otherwise the "has this version been released?" check collides with the draft, takes the "already exists, skip" branch, and the package ships while the Release page stays empty — again **with no error**.
- The draft summarises **pull requests**, not commits: a commit pushed straight to `main` is invisible to it. Trade-off, not a defect.

### 3.4 TypeScript and the test skeleton

- One tsconfig for the host half and one for the browser half; **two** vitest configs kept apart, one day-to-day and one for contracts.
- The day-to-day config **explicitly excludes** the contract cases; the contract config runs on its own (no parallelism, relaxed timeout).
- `strict` is mandatory. Compiler switches own types and dead code; ESLint owns the layer the compiler does not cover (formatting, hooks, promises, imports) — **the division of labour is the same across repositories, the tool parameters are not** (semicolons and quotes already differ).
- **Local hooks run second-scale checks only** (formatting and lint autofixes); typecheck and tests belong to CI. Intent: a slow hook gets bypassed with `--no-verify`, which amounts to having no hook.
- CI installs always run in frozen mode, never resolving new versions over the network.
- **One pair of files per maintainable directory**: `AGENTS.md` says how to work there, `README.md` says what is there and what to change; a fact has exactly one home, and cross-file mentions are pointers only.

### 3.5 Release-state guards and the compatibility patrol

- **Release-state invariants** become a `check:release` script, run by the release flow **before** publish.
- **The compatibility patrol** watches whether upstream moved; a local commit cannot change its verdict, so it runs weekly and **is not attached to `push`**.
- A swap script clearing leftovers must clear **both lockfiles** (`package-lock.json` and `pnpm-lock.yaml`). Intent: a stale lock makes the install fail outright, and **after a failed install the tree stays on the old versions while every later step goes green**.
- **When the declaration is a union of families** (separated by `||`), testing **any** family requires narrowing the declaration to that family first — **not only the lower one**. Intent: under a union the install produces a **mixed tree**, and the "move to some line" step tests a line that is not the one named. Mechanism → [evidence: the installer picks the family by `latest`](../.agents/notes/2026-10-12-installer-picks-latest-family.md).
- **Narrowing collides with two redlines that read `package.json`**: put the family prefix on a machine-input line (a matrix value or a `run`), never in a workflow comment; and restore the manifest to its committed state before typecheck / build / test. Intent: a redline judges the repository's declaration, not the temporary narrowed form. Reasoning → [decision: narrowing and the redlines](../.agents/notes/2026-10-12-narrowing-and-redlines.md).
- **Visibility when the patrol goes red**: a scheduled run's failure mail reaches only whoever last edited the cron, so it cannot be the main notification — a failure must open or update a tracking issue with a **fixed title** (the same failure does not get a fresh comment every time).

---

## 4. Criteria, item by item (cross-repository consistency)

The three tiers:

| Tier | Meaning |
|---|---|
| **Must agree** | a disagreement is a defect and has to become a check |
| **Should agree** | the decision logic is shared, the parameters are per repository |
| **Capability optional** | the rule genuinely does not apply — **not** that it was switched off |

| Rule | Tier | Where it lands |
|---|---|---|
| The lockfile's `resolved` must point at the official registry | Must agree | a redline assertion per repository (the count is computed, never copied into a document) |
| A missing peer → fail; missing dev only → warn and skip | Should agree | shared decision logic (**default fail**); which host line it follows is per repository |
| peer and dev versions must agree | Must agree | a redline assertion per repository |
| The four compiler switches and ESLint each own their layer | Should agree | redlines per repository guard that the switches exist; **the switch values stay in `tsconfig.json`**, tool parameters are per repository |
| Release-state invariants | Must agree | `check:release` per repository; a pure host plugin may be exempt from the `files` item, **the host compatibility range must not be** |
| The release flow must **not** bump the version | Must agree | a redline assertion per repository, **with a negative control**. Bumping is its own step before a release |
| Before releasing, confirm the commit to release is already on the **remote** | Must agree | the "before you release" section of each repository's `docs/PUBLISHING.md` |
| A release must produce git-side artifacts of the **same shape** (tag shape, Release exists, pre-release marked) | Must agree | an assertion in each repository's release flow. The tag name is read by **a machine** (the guard uses `git describe --match`), so it is not pure aesthetics |
| The host compatibility range and the peer range must be **self-consistent** | Must agree | redlines per repository. Across repositories only the **floor** is compared (it is comparable); **the upper bound's shape is per repository** |
| The criterion for a dependency's category is "**our relationship to it**": `import type` only → `devDependencies`; **consuming a service it provides** → `peerDependencies` | Must agree | each repository's `AGENTS.md`. When the criterion and the current state disagree, the next person deletes it by the rule |
| The tier of TypeScript's strict switches (`strict` / indexed access / optional properties) | Should agree | the **process** is shared: before enabling any switch, count the sites with the **real config** (not a CLI override), and enabling two at once must be tested separately; **the parameters are per repository**, with no cross-repository snapshot |
| Patrol items that "record but do not block" | Must agree | they must carry a reason, or a green run hides a real problem |
| Diagnostic steps (for example dumping the credential declaration at release time) | — | they are materialisation: **local to the workflow**, not extracted |
| Path-conflict assertions | — | **not written**: equivalent protection already exists, and a second copy is duplication |
| How CSS is injected, whether a stylesheet exists | Capability optional | per repository: the rule itself does not apply |
| A client `inject` lists real dependencies only | Must agree | use the official bundled validator rather than writing prose |
| How links are written: **same repository → relative path**; **another repository (same organization or not) → absolute URL**; always `[]()`, never `<URL>` and never a bare URL. A URL that is a **value** rather than a reference goes in inline code | Must agree | each repository's `AGENTS.md`; files rendered on the organization profile page are the exception (their links must be absolute — see that repository's `AGENTS.md`) |

**Two kinds of content, governed apart**:

- **Assertions** (wrong = CI goes red on the spot, **loud**) — first.
- **Knowledge** (wrong = someone reads a stale guide, **quiet**) — the same batch, but not a redline.

**One fallback criterion**: when a repository cannot get past upstream's **type surface**, it **may stop on the line that still builds** —
building beats following the line. This does not conflict with the criteria above: those say the declaration must be self-consistent with the line being recommended,
while this says the self-consistent target may be the lower line. Repositories stopping on different lines need not be forced into alignment.

**Why the criteria live here rather than in one of the repositories** → [decision: cross-repository criteria live in the organization repository](../.agents/notes/2026-10-12-criteria-live-in-the-org-repo.md).

---

## 5. How to check

- **Byte-identical copies** → compare bytes, not meaning.
- **Shapes** → read the criteria here; do not copy values from here.
- **A rule cannot live only in prose** → whatever can become an assertion becomes one (redline tests, `check:*` scripts); prose keeps pointers only.
- **Contrastive descriptions ("A has it, B does not") go stale fastest** → they depend on both sides at once; before acting, re-check the original source.
