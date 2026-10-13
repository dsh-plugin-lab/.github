# {{name}} — maintenance index

This file covers one thing only: how to work inside this repository. **It is still a skeleton** —
every section below is a placeholder, and you replace them one by one as the repository grows real
rules. Do not put links to files that do not exist yet into the document map.

## Status

- The version is whatever [package.json](package.json) says under `version`
- Not published yet
- No external service wired up beyond the CI badge

## Rules

- **Conclusions must come from measurement**, never from inference over documentation.
- **If it can be a check, do not write prose.** Invariants become a redline under `test/` or a check
  under `scripts/`; this file keeps a pointer to it and nothing more.
- **Run the link check after touching any document** (see "Commands"). A cross-section reference
  carries the section name: `[file's "section"](file.md#anchor)`.
- **One fact, one home.** When a fact has two homes, delete one of them.
- **Follow the change.** Whatever references the path, name or rule you just changed gets updated
  in the same batch.

TODO: write down the criteria that hold for this repository only.

## Commands

```shell
{{run}} check          # typecheck + build + test
{{run}} format:check   # formatting
{{run}} lint           # ESLint
```

TODO: add this repository's link check and line-ending check.

## Document map

- What it offers users → [README.md](README.md)
- Decisions and their evidence → [.agents/notes/](.agents/notes/) (currently an empty shell)
- Design documents → [docs/](docs/) (currently an empty shell)

## To do

- [ ] Replace every TODO above with what is actually true of this repository
- [ ] TODO: this repository's own open questions

## Known traps

TODO: every trap you hit goes here, or becomes a redline.
