# Organization-level files

This is not the organization profile — that is [profile/README.md](profile/README.md).
This repository holds the files GitHub resolves for **every** repository in the
organization that does not ship its own.

## What it holds

| File | Applies to |
|---|---|
| `SECURITY.md` | repositories without their own; the private-reporting entry is enabled per repository |
| `CODE_OF_CONDUCT.md` | as above |
| `SUPPORT.md` | as above |
| `CONTRIBUTING.md` | as above; the shared contribution rules for the organization |
| `PULL_REQUEST_TEMPLATE.md` | as above |
| `.github/ISSUE_TEMPLATE/*.yml` | as above; **must live here**, not at a repository root |
| `.github/release-drafter.yml` | repositories without a config of their own |
| `profile/README.md` | the organization profile page; not a fallback mechanism |
| `docs/plugin-conventions.md` | maintainers: which files live here, which each repository keeps, and their shapes and criteria ([中文](docs/plugin-conventions_zh.md)) |
| `assets/badges.md` | maintainers: copy-ready badge snippets — the official powered-by-dsh badge, the static/dynamic badge shapes, and the door-front skeleton |
| `templates/plugin/` | maintainers: the skeleton for a **new** plugin repository, laid down by `scripts/scaffold.mjs`; it is a **seeder, not a synchroniser** — nothing here is ever written back into an existing repository |

Prose is English wherever it is rendered outside this repository: the templates, the generator, and
the files in the table above. Chinese is used for the maintainer-facing layer only — `AGENTS.md`, the
Chinese half of the criteria document, and `.agents/notes/`.

Nothing here is copied into those repositories: a repository that has a file of the
same name always wins. The corollary matters more than the table — **a change here
changes what those repositories show, with no commit in any of them**.

## What it deliberately does not do

- **No release and no version.** There is no `package.json` and no lockfile; nothing
  is published from here. There is also no license, because nothing is distributed
  from here — the plugins carry their own.
- **No build, no dependencies, no CI.** The checks are a link check and a line-ending
  check, run by hand; the commands are in [AGENTS.md](AGENTS.md). `scripts/scaffold.mjs`
  adds no dependency: it is plain Node with `node:` built-ins only.
- **No repository-specific content.** What one plugin does, how it builds, and what it
  deliberately will not do stay in that plugin's own repository.

## Conventions

Which files live at the organization level, which each repository keeps for itself,
and the invariants they share — including what is deliberately **not** shared — is
documented in [docs/plugin-conventions.md](docs/plugin-conventions.md)
([中文](docs/plugin-conventions_zh.md)). The reasoning, trade-offs and post-mortems
behind those decisions are recorded in [.agents/notes/](.agents/notes/).

The map of the maintainer-facing documents is in [AGENTS.md](AGENTS.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). For a security problem do not use the public
tracker — see [SECURITY.md](SECURITY.md).
