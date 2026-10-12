# dsh-plugin-lab

[English](README.md) | [中文](README_zh.md)

Plugins for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

## Plugins

| Plugin | Purpose |
|---|---|
| [dsh-ds-balance](https://github.com/dsh-plugin-lab/dsh-ds-balance) | Show your DeepSeek account balance in the sidebar |
| [dsh-zhihu-search](https://github.com/dsh-plugin-lab/dsh-zhihu-search) | Zhihu site search / web search / Zhihu Direct Answer |
| [dsh-workbuddy-bridge](https://github.com/dsh-plugin-lab/dsh-workbuddy-bridge) | Bridge WorkBuddy desktop app models into DSH |
| [dsh-plugin-debugging](https://github.com/dsh-plugin-lab/dsh-plugin-debugging) | Troubleshoot a running DSH instance: live effect vs restart, whether a plugin loaded, 401 vs connection-refused, composed config |

## Installation

```shell
dsh plugin --profile <profile> add <package-name>
```

## Conventions

Which files live at the organization level (resolved for every repository here),
and the shapes each repository keeps for itself — including what is deliberately
**not** shared: [plugin-conventions.md](https://github.com/dsh-plugin-lab/.github/blob/main/docs/plugin-conventions.md).