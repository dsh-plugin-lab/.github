# dsh-plugin-lab

[English](https://github.com/dsh-plugin-lab/.github/blob/main/profile/README.md) | [中文](https://github.com/dsh-plugin-lab/.github/blob/main/profile/README_zh.md)

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的插件集合。

## 插件

| 插件 | 用途 |
|---|---|
| [dsh-ds-balance](https://github.com/dsh-plugin-lab/dsh-ds-balance) | 侧栏显示 DeepSeek 账户余额 |
| [dsh-zhihu-search](https://github.com/dsh-plugin-lab/dsh-zhihu-search) | 知乎站内搜索 / 全网搜索 / 知乎直答 |
| [dsh-workbuddy-bridge](https://github.com/dsh-plugin-lab/dsh-workbuddy-bridge) | 把 WorkBuddy 桌面 App 的模型接入 DSH |
| [dsh-plugin-debugging](https://github.com/dsh-plugin-lab/dsh-plugin-debugging) | DSH 插件运行时诊断：区分实时生效、重启和热重载。 |

## 安装

### 从插件市场安装

打开 **插件**，启用 **自定义插件市场**，然后在 **发现** 里添加这个索引源：

```text
https://dsh-plugin-lab.github.io/market/index.json
```

上面列出的插件都能在那里装。索引由
[dsh-plugin-lab/market](https://github.com/dsh-plugin-lab/market) 生成。

### 从命令行安装

```shell
dsh plugin --profile <profile> add <包名>
```

## [dsh-plugin-lab/.github](https://github.com/dsh-plugin-lab/.github) 里有什么

| 想找 | 文件 |
|---|---|
| 怎么贡献 | [CONTRIBUTING.md](https://github.com/dsh-plugin-lab/.github/blob/main/CONTRIBUTING.md) |
| 提问或报 bug 去哪 | [SUPPORT.md](https://github.com/dsh-plugin-lab/.github/blob/main/SUPPORT.md) |
| 怎么私密报告漏洞 | [SECURITY.md](https://github.com/dsh-plugin-lab/.github/blob/main/SECURITY.md) |
| 各插件仓共享哪些规矩 | [plugin-conventions.md](https://github.com/dsh-plugin-lab/.github/blob/main/docs/plugin-conventions.md) ([中文](https://github.com/dsh-plugin-lab/.github/blob/main/docs/plugin-conventions_zh.md)) |
| 哪些文件放组织级、为什么 | [README.md](https://github.com/dsh-plugin-lab/.github/blob/main/README.md) |
