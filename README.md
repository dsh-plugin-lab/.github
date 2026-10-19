# Organization-level files

GitHub reads a handful of files from fixed locations only, and a repository that
has one of its own always wins. This repository holds the ones that do not need to
live in every repository — so a repository created later inherits them **with no
commit anywhere**. The consequence matters more than the table below: **a change
here changes what those repositories show, and appears in none of their diffs.**

## Start here

| You are | Go to |
|---|---|
| Contributing to a plugin | [CONTRIBUTING.md](CONTRIBUTING.md) — and that repository's own `AGENTS.md` |
| Reporting a problem, or asking a question | [SUPPORT.md](SUPPORT.md) |
| Reporting a vulnerability | [SECURITY.md](SECURITY.md) |
| Working **in this repository** | [AGENTS.md](AGENTS.md) — the commands and the rules that are specific to it |
| Deciding whether something is a defect across the organization | [docs/plugin-conventions.md](docs/plugin-conventions.md) ([中文](docs/plugin-conventions_zh.md)) |
| Looking at the organization's public page | [profile/README.md](profile/README.md) |
| Browsing or installing the plugins themselves | [dsh-plugin-lab/market](https://github.com/dsh-plugin-lab/market) — the plugin market index |

## What it holds

Two groups, and they behave differently.

**Resolved by GitHub from here into repositories that lack their own:**

| File | Notes |
|---|---|
| `SECURITY.md` | the private-reporting entry is enabled per repository, not from this file |
| `CODE_OF_CONDUCT.md` | |
| `SUPPORT.md` | |
| `CONTRIBUTING.md` | the shared contribution rules |
| `PULL_REQUEST_TEMPLATE.md` | |
| `.github/ISSUE_TEMPLATE/*.yml` | **must** live here, not at a repository root — at a root it does nothing, silently |
| `.github/release-drafter.yml` | the draft's shared shape; a repository whose labels differ ships its own |

**Maintainer-facing, read only by people working on the organization:**

| File | What it is |
|---|---|
| [AGENTS.md](AGENTS.md) | the commands, the global rules and the traps of **this** repository |
| [docs/plugin-conventions.md](docs/plugin-conventions.md) | the cross-repository criteria, item by item, with what deliberately differs ([中文](docs/plugin-conventions_zh.md)) |
| [assets/badges.md](assets/badges.md) | copy-ready badge snippets; a store, not a live document |
| [templates/plugin/](templates/plugin/) + [scripts/scaffold.mjs](scripts/scaffold.mjs) | the skeleton for a **new** plugin repository. A **seeder, not a synchroniser** — nothing here is ever written back into an existing repository |
| [.agents/notes/](.agents/notes/) | why a decision was made, and what it ruled out |

## Language

Prose that renders **outside** this repository is English: the templates, the
generator, and every file in the first table. Chinese is used in the
maintainer-facing layer only — `AGENTS.md`, the Chinese half of the criteria
document, and `.agents/notes/`.

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