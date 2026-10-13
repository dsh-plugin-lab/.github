<p align="center">
  <img src="icon.svg" alt="{{name}}" width="80" height="80">
</p>

<h1 align="center">{{name}}</h1>

<div align="center">
  <p><em>{{description}}</em></p>

  <p>
    <a href="https://github.com/deepseek-ai/deepseek-harness"><img src="https://img.shields.io/badge/powered_by-dsh-4D6BFE?style=flat&logo=deepseek&logoColor=white" alt="powered by dsh"></a>
  </p>

  <p>
    <a href="https://github.com/{{owner}}/{{name}}/actions/workflows/ci.yml"><img src="https://github.com/{{owner}}/{{name}}/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=flat" alt="MIT license"></a>
  </p>

  <p>
    Changes per version → <a href="https://github.com/{{owner}}/{{name}}/releases">Releases</a> (one per npm version)
  </p>
</div>

---

> [!NOTE]
> This repository was produced by a scaffold and is **still only a skeleton**: it installs, builds
> and tests, but does not do anything yet. Start from what it actually offers and replace the
> placeholders below.

## What it offers

TODO: one line on what this plugin gives the user, then the capabilities, item by item.

## Install

```shell
dsh plugin --profile <profile> add {{name}}
```

## Compatibility

TODO: state the host line this supports and where the dividing line is. **Do not copy host version
numbers that drift** — the criterion is `engines.dsh` in `package.json`, so look up a concrete value
when you need one.

## Configuration

TODO: what can be configured, where it is stored, and what the defaults are.

## Development

```shell
{{install}}
{{run}} typecheck
{{run}} build
{{run}} test
{{run}} check
```

## License

[MIT](LICENSE)
