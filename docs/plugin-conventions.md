# Plugin repository conventions

[English](plugin-conventions.md) | [中文](plugin-conventions_zh.md)

**What this document is for**: which things belong at the organization level, which each repository keeps for itself, and — for the latter — the **standard shapes** and the **criteria, item by item**.
**Readers**: whoever creates a new plugin repository (copy the shapes) and maintainers (to check against).
**Not its job**: a repository's own business and design → that repository's `AGENTS.md` and `docs/ARCHITECTURE.md`.

To decide where a file belongs, ask three questions in order:

1. **Does the mechanism support a fallback?** If yes → keep it here (the organization `.github`), and no repository changes a line.
2. **Is the content generic, but the mechanism has no fallback?** → independent per repository, with the shape recorded in this document.
3. **Is the content specific to one repository?** → independent per repository; this document does not concern itself.

---

## 1. What can fall back: the repository root or `.github/`

GitHub reads these files only from the locations the platform supports, and **a repository with a file of its own uses its own**. The gain from keeping them here is that a new repository inherits them automatically, with no commit and no change to any repository's Git content.

| File | Where | Applies to |
|---|---|---|
| `SECURITY.md` | repository root | repositories that do not ship their own |
| `CODE_OF_CONDUCT.md` | repository root | as above |
| `SUPPORT.md` | repository root | as above |
| `CONTRIBUTING.md` | repository root | as above |
| `PULL_REQUEST_TEMPLATE.md` | repository root | as above |
| `.github/ISSUE_TEMPLATE/*.yml` | **must be in `.github/ISSUE_TEMPLATE/`** | as above; once a repository creates that directory, these templates stop applying to it **altogether** |
| `profile/README.md` | `profile/` | the organization profile page; not a fallback mechanism |

Three traps in the mechanism (all measured):

- **Issue templates at the repository root do nothing.** Their search path differs from the other health files: only `.github/ISSUE_TEMPLATE/` is recognized. The symptom is "a new issue offers nothing but a blank one" — **with no error**.
- **There is no localization mechanism.** Names such as `CONTRIBUTING_en.md` are not recognized, so do not count on one for a bilingual fallback; bilingual means both languages in a single file.
- **The fallback happens only when the repository has no file of that name.** When repositories already carry their own `CONTRIBUTING.md`, this one is never shown — it serves **repositories created later**.

The private-reporting entry that `SECURITY.md` describes is each repository's **Security → Report a vulnerability**, which has to be enabled per repository (**private repositories do not need it**: the repository is private already).

---

## 2. Generic but not extracted: the shapes live here

**`workflow` files are explicitly not extracted**: no `workflow_call`; each repository carries a byte-identical copy.

Why:

- A callable workflow can only be referenced in two ways, each with a cost: `@main` means one edit here changes every repository at once (and is **invisible** in their diffs and history); `@v1` means maintaining tags on top of a policy for whether a breaking change bumps the major version.
- What is saved is a duplicate text that **rarely changes**; what is paid is a failure radius of "one edit, many breakages" plus an extra hop when something breaks across repositories.
- **Reopening condition**: six or more plugin repositories, or a workflow that develops real branching logic and per-repository parameters.

Copies are held together by being **byte-identical**, not by generation from a template; when two copies disagree, the shapes in this document win.

**Carrier status**: no shared package, no extracted copies. Knowledge travels as pointers (the host's official sources); assertions are written per repository, accepting two-way sync.

---

## 3. Standard shapes for what each repository keeps

Only shapes below — no values that drift (version numbers, counts, line names). A new repository copies the shapes; an existing one is checked against them.

### 1. The CI closing job

The last job in each repository's `ci.yml`: it lets the ruleset watch a single status-check name, so adding or removing inner jobs needs no change to the ruleset.

Four things that cannot move:

- **Judge at step level only** — at job level a false condition turns the job `skipped`, and GitHub treats `skipped` as success, which is exactly the false green this guards against.
- **`needs` must list every job id in the file** — miss one, and that job can go red while this one still passes.
- **`if: always()`** — without it, an upstream failure skips the closing job itself.
- **`skipped` goes red alongside `failure` and `cancelled`**.

```yaml
  ci-success:
    name: CI Success
    runs-on: ubuntu-latest
    needs: [<本文件全部 job id>]
    if: always()
    steps:
      - name: Verify all jobs succeeded
        if: contains(needs.*.result, 'failure') || contains(needs.*.result, 'cancelled') || contains(needs.*.result, 'skipped')
        run: |
          echo "::error::有 job 未成功 —— CI Success 判红"
          echo '${{ toJSON(needs) }}'
          exit 1
```

The ruleset's `required_status_checks` names `CI Success` and nothing else.

### 2. Dependency drift patrol

Only the `github-actions` ecosystem: most npm dependencies in this family sit on the host's pre-release line, so enabling automatic pull requests would only produce noise — upgrade them by hand when needed.

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

### 3. Draft releases

The **config** lives at the organization level (this repository's `.github/release-drafter.yml`; a repository with no config of its own falls back to it).
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

- **The runner must be pinned to ubuntu**: on a windows runner the path separator stops the action from finding its config file, the draft comes out silently empty and **nothing errors** (the action's major version follows upstream).
- The draft's tag name is decoupled from the version number: the draft takes a **fixed name** and does not take `v<版本>` — otherwise the "has this version been released?" check collides with the draft, takes the "already exists, skip" branch, and the package ships while the Release page stays empty, again **with no error**.
- The draft summarises **pull requests**, not commits: a commit pushed straight to `main` is invisible to it. That is a trade-off, not a defect.

### 4. TypeScript and the test skeleton

- One tsconfig for the host half and one for the browser half; **two** vitest configs kept apart, one day-to-day and one for contracts.
- The day-to-day config **explicitly excludes** the contract cases; the contract config runs on its own (no parallelism, relaxed timeout).
- `strict` is mandatory. Compiler switches own types and dead code; ESLint owns the layer the compiler does not cover (formatting, hooks, promises, imports) — **the division of labour is the same across repositories, the tool parameters are not** (semicolons and quotes already differ).
- **Local hooks run second-scale checks only** (formatting and lint autofixes); typecheck and tests belong to CI. A slow hook gets bypassed with `--no-verify`, which amounts to having no hook.
- CI installs always run in frozen mode, never resolving new versions over the network.
- **One pair of files per maintainable directory**: `AGENTS.md` says how to work here, `README.md` says what is here and what to change; a fact has exactly one home, and cross-file mentions are pointers only.

### 5. Release-state guards and the compatibility patrol

- **Release-state invariants** become a `check:release` script, run by the release flow **before** publish.
- **The compatibility patrol** watches whether **upstream** moved; a local commit cannot change its verdict, so it runs weekly and **is not attached to `push`**.
- A swap script clearing leftovers must clear **both lockfiles** (`package-lock.json` and `pnpm-lock.yaml`): a stale lock makes the install fail outright, and **after a failed install the tree stays on the old versions while every later step goes green**.
- When the declaration is a **union of families** (separated by `||`), testing **any** family requires narrowing the declaration to that family first —
  **not only the lower one**. Under a union the installer does not necessarily pick the highest family: if the version `latest` points at satisfies the range, that is the one it uses
  (`latest`; npm and pnpm behave the same, and `semver.maxSatisfying` does not apply), so without narrowing the install produces a **mixed tree**,
  and the "move to some line" step ends up testing a line that is not the one named. The first instance, with the full evidence, is in `dsh-workbuddy-bridge`'s
  `.agents/notes/2026-10-12-installer-picks-latest-family.md`.
- **Visibility when the patrol goes red**: a scheduled run's failure mail goes only to whoever last edited the cron, so it cannot be the main notification — a failure must open or update a tracking issue with a **fixed title** (the same failure does not get a fresh comment every time).

#### Narrowing collides with two redlines, and each has its own fix

Narrowing **temporarily** rewrites the manifest, and a repository usually has two redlines that read `package.json`. During the narrowing they see the narrowed form, so they collide with it. Both have a fix, and the fixes are not the same.

**(one) The "do not copy host versions that drift" redline — put the value on a machine-input line, never in a comment.**

This kind of guard scans live documents and also scans `.github/workflows/*`; for a workflow it scans **comment lines only**. The reason: non-comment lines are **machine-consumed input** (matrix values, step names, `run` commands) and, like `package.json`, are themselves the source of truth, so they are explicitly exempt.

- ✅ the family prefix in a matrix value or a `run`: `--only 0.2.0`
- ❌ in a comment: `# --only 0.2.0 不能省` — judged as "copied a value that drifts"

A comment should say **why** (why narrowing is required); the concrete value belongs to the machine-input line.

**(two) The "host floor in the live documents" redline — restore the manifest before running tests.**

Some guards take the floor from `package.json`, look for "host + floor value" in the live documents, and **assert that at least one hit exists**
(self-check: zero hits means the hint has gone vacuous). After narrowing the floor has moved to another family while the documents still name the original one,
so the self-check fails — **this is a criterion mismatch, not broken code**.

The fix is to put narrowing back inside the job it actually has:

1. Narrowing serves **installing** and **confirming which family got installed**, both of which finish inside the swap step;
2. **Before** typecheck / build / test, restore the manifest to its committed state (`git checkout -- package.json`);
3. The dependency tree is **untouched** — the manifest is what gets restored, and the target family still takes effect.

After the restore, the tests run on "**the target family's dependency tree + the repository's declared manifest**": the tree is what is under test, the manifest is the criterion's input, and each is where it belongs. A redline judges **the repository's declaration**, not the temporary narrowed form of a patrol run.

> Which leg exposes problem (two) first depends on which family the documents happen to name: the leg whose documents name the floor family will not expose it.
> So it is not "a defect specific to one leg" — every leg must restore.

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

**Two kinds of content, governed apart**:

- **Assertions** (wrong = CI goes red on the spot, **loud**) — first.
- **Knowledge** (wrong = someone reads a stale guide, **quiet**) — the same batch, but not a redline.

**One fallback criterion**: when a repository cannot get past upstream's **type surface**, it **may stop on the line that still builds** —
building beats following the line. This does not conflict with the criteria above: those say the declaration must be self-consistent with the line being recommended,
while this says the self-consistent target may be the lower line. Repositories stopping on different lines need not be forced into alignment.

**Why these criteria live here and not in one of the repositories**: they hold across repositories, and living in one repository means the next repository's people never read them —
**a rule with no executor rots**. The rules themselves land as per-repository assertions; this document only registers which one belongs to which tier and where it lands.

---

## 5. How to check

- **Byte-identical copies** → compare bytes, not meaning.
- **Shapes** → read the criteria here; do not copy values from here.
- **A rule cannot live only in prose** → whatever can become an assertion becomes one (redline tests, `check:*` scripts); prose keeps pointers only.
- **Contrastive descriptions ("A has it, B does not") go stale fastest** → they depend on both sides at once; before acting, re-check the original source.
