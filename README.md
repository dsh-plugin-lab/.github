# Organization-level files

This repository holds the organization-level files: the ones every repository in this
organization shares. The consequence matters more than any table below: **a change here
changes what those repositories show, and appears in none of their diffs.**

## Start here

| You are | Go to |
|---|---|
| Contributing to a plugin | [CONTRIBUTING.md](CONTRIBUTING.md) — and that repository's own `AGENTS.md` |
| Reporting a problem, or asking a question | [SUPPORT.md](SUPPORT.md) |
| Reporting a vulnerability | [SECURITY.md](SECURITY.md) |
| Working **in this repository** | [AGENTS.md](AGENTS.md) — the commands and the rules that are specific to it |
| Writing a plugin repository — what it must look like | [docs/plugin-conventions.md](docs/plugin-conventions.md) — the shape and what a published package must carry |
| Deciding whether something is a **defect** across the organization | [docs/criteria.md](docs/criteria.md) — one row per rule, its tier, and the file or script that judges it |
| Looking at the organization's public page | [profile/README.md](profile/README.md) |
| Browsing or installing the plugins themselves | [dsh-plugin-lab/market](https://github.com/dsh-plugin-lab/market) — the plugin market index |

## What it holds

Two groups, and they behave differently.

**Resolved by GitHub from here into repositories that lack their own:**

GitHub reads these files only from the locations the platform supports, and **a repository with a file of
its own uses its own**. A new repository inherits them with no commit anywhere.

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

Four criteria that follow from the mechanism — each failure is **silent**:

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

**Maintainer-facing, read only by people working on the organization:**

| File | What it is |
|---|---|
| [AGENTS.md](AGENTS.md) | the commands, the global rules and the traps of **this** repository |
| [docs/plugin-conventions.md](docs/plugin-conventions.md) | **the conventions**: what a plugin repository looks like, and what its published package must carry. Read by whoever writes a plugin |
| [docs/criteria.md](docs/criteria.md) | **the criteria**: every rule above, its tier, and the file or script that judges it. Read by whoever judges a defect |
| [assets/badges.md](assets/badges.md) | copy-ready badge snippets; a store, not a live document |
| [templates/plugin/](templates/plugin/) + [scripts/scaffold.mjs](scripts/scaffold.mjs) | the skeleton for a **new** plugin repository. A **seeder, not a synchroniser** — nothing here is ever written back into an existing repository |
| [.agents/notes/](.agents/notes/) | why a decision was made, and what it ruled out |

## Language

Prose that renders **outside** this repository is English: the templates, the
generator, and every file in the first table. Chinese is used in the
maintainer-facing layer only — `AGENTS.md`, the Chinese halves of the conventions and
the criteria documents, and `.agents/notes/`.

The one exception is by necessity: GitHub has no mechanism for localized
community files, so the organization profile keeps both languages as two files.

## What this repository deliberately does not do

- **No release and no version.** There is no `package.json` and no lockfile; nothing
  is published from here. There is also no license, because nothing is distributed
  from here — the plugins carry their own.
- **No build, no dependencies, no CI.** The checks are a link check and a line-ending
  check, run by hand; the commands are in [AGENTS.md](AGENTS.md). `scripts/scaffold.mjs`
  adds no dependency: it is plain Node with `node:` built-ins only.
- **No repository-specific content.** What one plugin does, how it builds, and what it
  deliberately will not do stay in that plugin's own repository.