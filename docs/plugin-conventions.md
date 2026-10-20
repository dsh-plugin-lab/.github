# Plugin repository conventions

[English](plugin-conventions.md) | [中文](plugin-conventions_zh.md)

**Who this is for**: you are writing a plugin in this organization, new or existing, and you need to know
what that repository must look like — what the scaffold lays down, which parts are not negotiable, and
what the published package has to carry.

**Who this is not for**: judging whether a difference is a **defect**. That is
[criteria.md](criteria.md): it gives each rule above a tier and names the file or script that judges it.
Working in one repository (that repository's `AGENTS.md`), contributing (the organization's
`CONTRIBUTING.md`) and running a release (that repository's `docs/PUBLISHING.md`) are their own documents.

**What stays out**: arguments, trade-offs and post-mortems → [.agents/notes/](../.agents/notes/). This
document keeps the shape, one line of intent each, reopening conditions, and pointers.

Three sections: **the shape a repository has** (§1), **what a published package must carry** (§2), and
**the two things deliberately left per repository** (§3). A fourth says who they bind.

## Who this binds

Three sections above, one kind of repository: the **plugin repository** — one per plugin, one npm package
that is also a DSH bundle. The other two repositories in this organization are outside it:

- **The organization repository** (`dsh-plugin-lab/.github`) publishes nothing; what it holds and why is its
  own [README.md](../README.md).
- **The market** (`dsh-plugin-lab/market`) builds a generated index and publishes no package; what it must
  do is its own repository's business.

Both are **management-layer facilities**: they exist because there are plugins, not as plugins. Two
questions decide where a piece of content belongs, in this order:

1. **Can the mechanism fall back?** If yes → the organization repository (its `.github`), and no plugin
   repository changes a line.
2. **Otherwise** → the repository that owns it, with the shape recorded here.
## 1. The shape the scaffold generates

**This is a target, not a claim of uniformity.** What follows is what `node scripts/scaffold.mjs`
produces and why; §1.9 lists the places where the four existing repositories legitimately differ from
it. A repository that matches the shape is not thereby correct, and one that differs is not thereby a
defect — what must agree is in [criteria.md](criteria.md).

**For a new repository, the shape is not copied from here**: the scaffold seeds it
(`node scripts/scaffold.mjs <dir>`, then `--verify` runs the generated repository's own checks). Read
this section to know **why** the generated file looks the way it does and **where it may legitimately
differ** — not to transcribe it.

**For an existing repository, this is the reference**: what the shape is, and the parts that are not
negotiable.

### 1.1 The CI closing job

The last job in each repository's `ci.yml`: it lets the ruleset watch a single status-check name, so
inner jobs can be added or removed without touching the ruleset.

Four things that cannot move:

- **Judge at step level only** — at job level a false condition turns the job `skipped`, and GitHub
  treats `skipped` as success. Intent: no false green.
- **`needs` must list every job id in the file** — miss one and that job can go red while this one still
  passes.
- **`if: always()`** — otherwise an upstream failure skips the closing job itself.
- **`skipped` goes red alongside `failure` and `cancelled`** — a job that never ran must not pass.

The job itself is in [the template's ci.yml](../templates/plugin/_common/.github/workflows/ci.yml) —
one place, not a copy here.

The ruleset's `required_status_checks` names `CI Success` and nothing else.

### 1.2 Dependency drift patrol

Only the `github-actions` ecosystem. Intent: most npm dependencies in this family sit on the host's
pre-release line, so automatic pull requests would only be noise.

The file is [the template's dependabot.yml](../templates/plugin/_common/.github/dependabot.yml).

### 1.3 Draft releases

The **workflow** is one per repository and, measured across the four, byte-identical:

The file is [the template's release-drafter.yml](../templates/plugin/_common/.github/workflows/release-drafter.yml).

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

### 1.4 The package manager and the build

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
- **The builder is per repository** (§1.9). The scaffold ships `tsdown` with two configurations in
  `tsdown.config.ts` (host half ESM, browser half a CJS envelope, the browser half's CSS Modules as a
  plugin of that file); a repository may instead run the compiler directly and build the browser half
  with a script. Both satisfy the criteria; the scaffold's choice is the one a new repository starts
  from.

### 1.5 TypeScript and the test skeleton

- One tsconfig per compilation target, and separate vitest configs for day-to-day and contract tests. The
  **counts differ per repository** (§1.9); what must agree is that the contract cases are excluded from
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

### 1.6 Release-state guards and the compatibility patrol

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

### 1.7 The plugin icon

One `icon.svg` at the package root, declared as `"icon": "./icon.svg"`, and shipped in the package's
`files` (§2).

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

### 1.8 The release flow

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
version. That is why §2 asks that a merged version reach npm, and why the market reports the drift: the
gap between "merged" and "published" is invisible from inside the repository.

### 1.9 Where repositories legitimately differ

Same shape, different parameters or counts. None of these is a defect on its own; [criteria.md](criteria.md) is what must agree.

| What may differ | Why it is allowed |
|---|---|
| Builder: `tsdown`, or the compiler plus a browser-half script | both produce the host half and the browser half; the scaffold ships `tsdown` |
| Number of `tsconfig` files: one per compilation target | a test config is added only when tests are compiled separately |
| Number of `vitest` configs: two where contract tests exist, one where they do not | the contract config exists to run them apart |
| `compat.yml`: legs, targets, blocking versus record-only | the declared families differ per repository's history |
| `ci.yml` / `release.yml`: jobs, matrices, steps | nothing cross-repository reads them but the closing-job rule |
| **Not** the draft-release workflow | it must be byte-identical (§3, and the check is named in [criteria.md](criteria.md)) |

**Do not record the current values here.** How many of each, and which builder a given repository uses,
are facts that change without this document — read them from the repository, or compare with
`scaffold check`. What is recorded above is the **category** each difference falls into.

---

## 2. What a published package must carry

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

### What the package must not carry

The obligation above is about what the market reads. There is a mirror obligation about what nobody
reads: **images that only the README shows do not belong in the published package.**

- **They live in the repository and the README references them relatively** (`assets/x.png`). Both
  surfaces that render a README — the repository page and the npm page — resolve that path; the package
  does not need to contain the file for either of them to work.
- **`files` does not list `assets/`.** A plugin whose facade images ship in the tarball makes every
  consumer download screenshots to get code, and makes every reader of the index pay to fetch them. The
  size of the harm is not the point; the direction is.
- **This does not apply to `icon.svg`**, which the market does read (see the table above) and which is
  therefore shipped.
- **Adding a runtime asset to `assets/` still ships it**, because the exclusion is a list of specific
  files, not of the directory — a plugin that needs a file at runtime keeps it working while a new
  screenshot never silently enters the package.

**Field semantics live elsewhere, on purpose**: which JSON key, which path, what the reader does with an
unknown member → the market's [market-format.md](https://github.com/dsh-plugin-lab/market/blob/main/docs/market-format.md).
This section states the **obligation**; that document is the **contract**. Neither copies the other.

---

## 3. Deliberately not extracted

Two things this family keeps per repository on purpose. Both are rules, and both carry a reopening
condition — without one, the next person cannot tell a decision from an oversight.

- **Workflows are not extracted**: no `workflow_call`. Each repository carries its own copy, held together
  by **shape**, not by bytes. Byte-identity is the exception and it is enumerated, not implied: the list is
  `IDENTITY_FILES` in `scripts/scaffold.mjs`, never prose. Reopening condition: six or more plugin
  repositories, or a workflow that grows real branching logic and per-repository parameters.
  Reasoning → [decision: workflow copies are not extracted](../.agents/notes/2026-10-12-workflow-copies-not-extracted.md).
- **The scaffold seeds; it does not synchronise**: `scripts/scaffold.mjs` + `templates/plugin/` lay down a
  new repository's skeleton **once** and never write back into an existing repository. Its `check`
  subcommand is the execution body of the byte-identity criterion; `--verify` generates into a scratch
  directory and runs the generated repository's own checks, which is what accepts a template edit.
  Reopening condition: a template change that has to reach existing repositories — that is a migration,
  not a seed, and it needs its own decision.
  Reasoning → [decision: the scaffold seeds, it does not sync](../.agents/notes/2026-10-12-scaffold-seeds-not-syncs.md).

**No shared package and no extracted copies** follow from the two above: knowledge travels as pointers (the
host's official sources), assertions are written per repository, accepting two-way sync.

---

## Where this sits

- **Is this a defect?** → [criteria.md](criteria.md): every rule above has a tier and a judging file.
- **Building a new repository** → the scaffold, not this document:
  `node scripts/scaffold.mjs <dir> --verify`
- **What the organization repository itself holds** → its [README.md](../README.md)
- **Why a rule reads the way it does** → [.agents/notes/](../.agents/notes/)
