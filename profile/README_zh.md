# dsh-plugin-lab

[English](https://github.com/dsh-plugin-lab/.github/blob/main/profile/README.md) | [中文](https://github.com/dsh-plugin-lab/.github/blob/main/profile/README_zh.md)

为 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 打造的一组插件。

## 插件

| | 插件 | 用途 |
|---|---|---|
| <a href="https://github.com/dsh-plugin-lab/dsh-ds-balance"><img src="https://raw.githubusercontent.com/dsh-plugin-lab/dsh-ds-balance/main/icon.svg" width="80" height="80" alt="dsh-ds-balance"></a> | [dsh-ds-balance](https://github.com/dsh-plugin-lab/dsh-ds-balance) | 侧栏显示 DeepSeek 账户余额 |
| <a href="https://github.com/dsh-plugin-lab/dsh-zhihu-search"><img src="https://raw.githubusercontent.com/dsh-plugin-lab/dsh-zhihu-search/main/icon.svg" width="80" height="80" alt="dsh-zhihu-search"></a> | [dsh-zhihu-search](https://github.com/dsh-plugin-lab/dsh-zhihu-search) | 知乎站内搜索 / 全网搜索 / 知乎直答 |
| <a href="https://github.com/dsh-plugin-lab/dsh-workbuddy-bridge"><img src="https://raw.githubusercontent.com/dsh-plugin-lab/dsh-workbuddy-bridge/main/icon.svg" width="80" height="80" alt="dsh-workbuddy-bridge"></a> | [dsh-workbuddy-bridge](https://github.com/dsh-plugin-lab/dsh-workbuddy-bridge) | 把 WorkBuddy 桌面 App 的模型接入 DSH |
| <a href="https://github.com/dsh-plugin-lab/dsh-plugin-debugging"><img src="https://raw.githubusercontent.com/dsh-plugin-lab/dsh-plugin-debugging/main/icon.svg" width="80" height="80" alt="dsh-plugin-debugging"></a> | [dsh-plugin-debugging](https://github.com/dsh-plugin-lab/dsh-plugin-debugging) | DSH 插件运行时诊断：区分实时生效、重启和热重载。 |

## 安装

### 从插件市场安装

先在 **插件** 页启用 **自定义插件市场**，再到 **发现** 里把这个索引源加进去：

```text
https://dsh-plugin-lab.github.io/market/index.json
```

以上插件都可以从那里安装。索引由
[dsh-plugin-lab/market](https://github.com/dsh-plugin-lab/market) 生成。

### 从命令行安装

```shell
dsh plugin --profile <profile> add <package-name>
```

## [dsh-plugin-lab/.github](https://github.com/dsh-plugin-lab/.github) 里有什么

| 你的问题 | 看这里 |
|---|---|
| 怎么贡献 | [CONTRIBUTING.md](https://github.com/dsh-plugin-lab/.github/blob/main/CONTRIBUTING.md) |
| 提问或报 bug 去哪 | [SUPPORT.md](https://github.com/dsh-plugin-lab/.github/blob/main/SUPPORT.md) |
| 怎么私密报告漏洞 | [SECURITY.md](https://github.com/dsh-plugin-lab/.github/blob/main/SECURITY.md) |
| 各插件仓共同遵守的规矩 | [plugin-conventions.md](https://github.com/dsh-plugin-lab/.github/blob/main/docs/plugin-conventions.md) |
| 哪些文件放组织级、为什么 | [README.md](https://github.com/dsh-plugin-lab/.github/blob/main/README.md) |
