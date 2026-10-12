# Contributing

This file holds the rules that are the same for **every** repository in this
organization. What is specific to one repository — what it does, how to build
it, what it deliberately will not do — lives in that repository's own
`CONTRIBUTING.md`, `AGENTS.md` and `docs/ARCHITECTURE.md`. Read those first.
Where they disagree with this file, the repository wins.

## Commit messages

Say what changed, and answer four questions:

- **What** changed.
- **Why** — the reason, not a restatement of the diff.
- **How it was verified** — the command you ran and what it printed.
- **How to roll it back.**

One logical change per commit. A commit that cannot stand on its own — does not
build, does not pass its own tests — is not finished.

## Do not bump the version

The `version` field is bumped as its own step before a release, never as part of
a feature or a fix. A pull request that changes it will be asked to drop that
change. How a release actually happens is documented per repository.

## Contract changes update the docs in the same change

Anything a user can observe — behaviour, an interface signature, a configuration
key, an output format — must update the `README` (how to use it) and
`docs/ARCHITECTURE.md` (how the design changed) in the **same** change. If that
is not possible, list the debt explicitly instead of leaving it silent.

## Never paste credentials

Keys, tokens and session data do not belong in an issue, a pull request, a commit
message or a log. If a real credential reaches one of those, treat it as leaked:
revoke it first, then write the report.

## Security issues

Do not use the public issue tracker — see [SECURITY.md](SECURITY.md).
