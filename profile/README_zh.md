# dsh-plugin-lab

[English](README.md) | [中文](README_zh.md)

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的插件集合。

## 插件

| 插件 | 用途 |
|---|---|
| [dsh-ds-balance](https://github.com/dsh-plugin-lab/dsh-ds-balance) | 侧栏显示 DeepSeek 账户余额 |
| [dsh-zhihu-search](https://github.com/dsh-plugin-lab/dsh-zhihu-search) | 知乎站内搜索 / 全网搜索 / 知乎直答 |
| [dsh-workbuddy-bridge](https://github.com/dsh-plugin-lab/dsh-workbuddy-bridge) | 把 WorkBuddy 桌面 App 的模型接入 DSH |

## 安装

```shell
dsh plugin --profile <profile> add <包名>
```

## 约定

哪些文件放组织级（本组织的仓自动继承）、各仓自持哪些形状、以及**明确不抽**的是哪些：
[插件仓通用约定](https://github.com/dsh-plugin-lab/.github/blob/main/docs/plugin-conventions.md)。