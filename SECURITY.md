# Security Policy

## Reporting a vulnerability

**Do not open a public issue for a security problem.**

Use the repository's **Security** tab → **Report a vulnerability**. That report
stays private between you and the maintainers until a fix is published.

If that button is not available on the repository you are looking at, open an
issue that contains **no sensitive detail** and ask for a private channel.

## What to include

- The repository and the version you tested (the `version` in `package.json`, or
  the release / package version you installed).
- What an attacker can do, and what they need in order to do it.
- The smallest reproduction you have.
- Any fix or mitigation you already know of.

## Never paste credentials

Keys, tokens and session data do not belong in a report. Anything that looks
like a live credential is treated as leaked: revoke it before you send the
report, not after.

## Supported versions

Only the most recent published release of a repository is supported. Older
releases do not receive security fixes — upgrade before reporting.

## What to expect

- We aim to acknowledge a report within a few days.
- We will confirm the impact, agree on a disclosure timeline with you, and credit
  you in the release notes unless you ask us not to.
