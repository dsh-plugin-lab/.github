# dsh-plugin-lab

[English](README.md) | [中文](README_zh.md)

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的插件集合。

## 插件

| 插件 | 用途 |
|---|---|
| [dsh-ds-balance](https://github.com/dsh-plugin-lab/dsh-ds-balance) | 侧栏显示 DeepSeek 账户余额 |
| [dsh-zhihu-search](https://github.com/dsh-plugin-lab/dsh-zhihu-search) | 知乎站内搜索 / 全网搜索 / 知乎直答 |
| [dsh-workbuddy-bridge](https://github.com/dsh-plugin-lab/dsh-workbuddy-bridge) | 把 WorkBuddy 桌面 App 的模型接入 DSH |
| [dsh-plugin-debugging](https://github.com/dsh-plugin-lab/dsh-plugin-debugging) | 给正在跑的 DSH 实例排障的只读工具箱 |

## 安装

```shell
dsh plugin --profile <profile> add <包名>
```

## [dsh-plugin-lab/.github](https://github.com/dsh-plugin-lab/.github) 里有什么

| 文件 | |
|---|---|
| [plugin-conventions.md](https://github.com/dsh-plugin-lab/.github/blob/main/docs/plugin-conventions.md) | 哪些文件放组织级、各仓自持哪些形状、共享哪些不变量 |
| [CONTRIBUTING.md](https://github.com/dsh-plugin-lab/.github/blob/main/CONTRIBUTING.md) | 怎么贡献 |
| [SECURITY.md](https://github.com/dsh-plugin-lab/.github/blob/main/SECURITY.md) | 怎么私密报告漏洞 |
| [templates/plugin](https://github.com/dsh-plugin-lab/.github/tree/main/templates/plugin) | 脚手架：给新插件仓铺骨架 |
