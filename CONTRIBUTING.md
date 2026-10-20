# Contributing

This file holds the rules that are the same for **every** repository in this
organization. What is specific to one repository — what it does, how to build it,
what it deliberately will not do — lives in that repository's own `AGENTS.md`,
`README.md` and `docs/ARCHITECTURE.md`. Read those first.

**Which one wins.** For *how a repository is worked in*, the repository wins: its
commands, its test layout and its release procedure are its own. For *what must be
true across every repository in this organization*, it does not: those invariants
are listed in [docs/plugin-conventions.md](docs/plugin-conventions.md), and a
repository that disagrees with one is wrong, not an exception.

## Where things are written down

The organization repository keeps these things. Each has exactly one home, so this
file points rather than repeats.

| You want to know | Read |
|---|---|
| How to build, test and work in **this** repository | that repository's `AGENTS.md` |
| What is the same across every repository, and what must be true | [docs/plugin-conventions.md](docs/plugin-conventions.md) |
| Why a decision was made, and what it ruled out | that repository's `.agents/notes/` |
| How a release actually happens | that repository's `docs/PUBLISHING.md` |
| Where the shared files come from | [the organization repository](https://github.com/dsh-plugin-lab/.github) |
| Badge snippets for a README | [assets/badges.md](https://github.com/dsh-plugin-lab/.github/blob/main/assets/badges.md) |

## Before you open an issue

Issues belong in the repository the code lives in: there is one tracker per
repository, not one per organization.

- Search the open **and** closed issues first — many reports are already answered.
- Read the repository's `README` and, where it exists, `docs/ARCHITECTURE.md`.
- Reproduce on the latest release, and say which one you tested.
- For anything visual, attach a screenshot or a recording.
- Never open a public issue for a security problem — see [SECURITY.md](SECURITY.md).

A useful report contains:

| | |
|---|---|
| What you ran | the plugin version, the DSH version (`dsh --version`), the Node version (`node --version`) |
| How you installed it | from npm or from source, and whether DSH was restarted after the change |
| What happened | the actual behaviour, plus the full error text with credentials removed |
| What you expected | |
| How to reproduce | the smallest sequence of steps that shows the problem |
| Other plugins | anything else installed in the same profile — compatibility problems often come from conflicts |

The issue forms ask for these individually; they are listed here so you can gather
them before you start.

## Before you propose a feature

- Open an issue describing the **problem** first; do not send a pull request
  straight away.
- Read the repository's decision records (`.agents/notes/`). Proposals that were
  already rejected by measurement, and the alternatives each decision ruled out,
  are recorded there — re-proposing them wastes everybody's time.
- What the design will not do is documented in `docs/ARCHITECTURE.md`. A feature
  that contradicts it needs that discussion before the code exists.

## Commits

Say what changed, and answer four questions:

- **What** changed.
- **Why** — the reason, not a restatement of the diff.
- **How it was verified** — the command you ran and what it printed.
- **How to roll it back.**

One logical change per commit. A commit that cannot stand on its own — does not
build, does not pass its own tests — is not finished.

## Before you open a pull request

- Run the repository's own checks. The commands are in its `AGENTS.md`, because
  they differ per repository (package manager, build step, test layout).
- Read that `AGENTS.md` and the repository's test index: the merge criteria live
  there, and the invariants are pinned by tests rather than by prose.
- **Contract changes update the docs in the same change.** Anything a user can
  observe — behaviour, an interface signature, a configuration key, an output
  format — must update the `README` (how to use it) and `docs/ARCHITECTURE.md`
  (how the design changed) in that same pull request. If that is not possible,
  list the debt explicitly instead of leaving it silent.
- Visual changes need fresh screenshots in the same change, or a sentence in the
  pull request explaining why the existing ones still hold. The criteria are in
  the repository's `assets/AGENTS.md`.

## Do not bump the version

The `version` field is bumped as its own step before a release, never as part of a
feature or a fix. A pull request that changes it will be asked to drop that
change. How a release actually happens is documented per repository.

## Labels and the draft release

Merged pull requests are summarised into a draft release, grouped by label, so
label your pull request before merging:

- `enhancement` / `bug` / `compat` / `refactor` / `documentation` — one category each.
- No label, or a label outside that list — falls into the catch-all category.
- `skip-changelog` — merged but invisible to users (dependency bumps and the
  like); excluded from every category.

Labels are repository metadata, so **which labels exist is each repository's own
business** — the ones above are the common set, not a fixed list. The draft's
*shape* (its name, how a change is rendered into a line) is shared; that part, and
the rule that the release body comes from that draft, are the organization-level
invariants in [docs/plugin-conventions.md](docs/plugin-conventions.md).

The draft summarises **pull requests**, not commits: a commit pushed straight to
the default branch is invisible to it. That is a trade-off, not a defect.

Issue titles: English imperative, verb first (`Fix …`, `Add …`, `Track …`). No
`[Bug]` / `[Feature]` prefixes — the label already says the type, so repeating it
in the title is noise.

## Never paste credentials

Keys, tokens and session data do not belong in an issue, a pull request, a commit
message or a log. If a real credential reaches one of those, treat it as leaked:
revoke it first, then write the report.

## Security issues

Do not use the public issue tracker — see [SECURITY.md](SECURITY.md).
