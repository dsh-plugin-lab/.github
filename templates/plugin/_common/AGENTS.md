# {{name}} — maintenance index

## Status

- Version: the `version` field in [package.json](package.json)
- Not published yet

## Commands

```shell
pnpm run check          # everything CI runs, plus the release-state check
pnpm run lint           # ESLint
pnpm run format:check   # formatting
pnpm run check:release  # the release-state invariants on their own
```

## Releasing

The flow is [.github/workflows/release.yml](.github/workflows/release.yml): a thin caller of the
shared release chain in
[release-publish.yml](https://github.com/dsh-plugin-lab/.github/blob/main/.github/workflows/release-publish.yml).
It keeps three things that are this repository's own — the triggers, the `environment` name, and the
permissions the called job inherits. Two things it relies on you having done:

- **Before** a release, bump `version` in [package.json](package.json) and commit it. The flow never
  bumps it, and that is asserted rather than merely documented.
- **Once** per repository, on npmjs.com: a Trusted Publisher for this package, naming this
  repository, `release.yml` and the environment name in the caller. Without it, publishing fails with
  a 404 and nothing in the logs says why.

A repository that must run a step **between** build and publish keeps its own full copy of the flow
instead of calling the shared one, and says so here. That is the only sanctioned divergence.

Labels on merged pull requests decide what the release body says. Which labels exist is this
repository's own business; the family only fixes how a draft is turned into a body.

## Document map

- What it offers → [README.md](README.md)
- Design → [docs/](docs/)
- Decisions and their evidence → [.agents/notes/](.agents/notes/)
- Cross-repository conventions → [plugin-conventions](https://github.com/dsh-plugin-lab/.github/blob/main/docs/plugin-conventions.md)
- Whether something counts as a defect → [criteria](https://github.com/dsh-plugin-lab/.github/blob/main/docs/criteria.md)

## To do

- TODO

## Known traps

- TODO
