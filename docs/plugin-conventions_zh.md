# 插件仓通用约定

[English](plugin-conventions.md) | [中文](plugin-conventions_zh.md)

**本文职责**：哪些东西放组织级、哪些各仓自持，以及各仓自持那些的**标准形状**与**逐条判据**。
**读者**：新建插件仓的人（照抄形状）与维护者（核对）。
**不负责**：某个仓自己的业务与设计 → 那个仓的 `AGENTS.md` 与 `docs/ARCHITECTURE.md`。
**不进本文**：论证、权衡与复盘 → [.agents/notes/](../.agents/notes/)。本文只留判据、每条一行意图、重开条件、核对方法与指针。

判断一个文件该放哪，按顺序问三个问题：

1. **机制支不支持回退？** 支持 → 放组织仓（它的 `.github`），各插件仓代码零改动。
2. **内容通用、但机制不支持？** → 各仓独立，形状写进本文。
3. **内容仓特有？** → 各仓独立，本文不管。

---

## 一、能回退的：放组织仓

GitHub 只在平台支持的位置读这些文件，且**各仓有同名文件时用自己的**。新增仓因此自动继承，且不产生任何提交。

| 文件 | 放哪 | 作用范围 |
|---|---|---|
| `SECURITY.md` | 仓根 | 未自带该文件的仓 |
| `CODE_OF_CONDUCT.md` | 仓根 | 同上 |
| `SUPPORT.md` | 仓根 | 同上 |
| `CONTRIBUTING.md` | 仓根 | 同上 |
| `PULL_REQUEST_TEMPLATE.md` | 仓根 | 同上 |
| `.github/ISSUE_TEMPLATE/*.yml` | **必须在 `.github/ISSUE_TEMPLATE/`** | 同上；某仓一旦自建该目录，本仓模板对它**整体失效** |
| `.github/release-drafter.yml` | 组织仓 | 未自带配置的仓 |
| `profile/README.md` | `profile/` | 组织主页，不属回退机制 |

四条由机制推出的判据：

- **issue 模板必须在 `.github/ISSUE_TEMPLATE/` 下** —— 放仓根不生效，只认那一个路径。症状是「新建 issue 只有空白」，且**不报错**。
- **没有多语言机制** —— `CONTRIBUTING_en.md` 这类名字不被识别；要双语只能写在同一份文件里，不能靠第二份文件。
- **回退只在「本仓没有同名文件」时发生** —— 各仓已有自己的 `CONTRIBUTING.md` 时，组织仓那份永远不会被显示；它服务的是**将来新建的仓**。
- **`SECURITY.md` 写的私密报告入口**是各仓 **Security → Report a vulnerability**，需要各仓单独开启（**私有仓不需要**：仓本身就是私有的）。

---

## 二、通用但不抽

**`workflow` 类明确不抽**：不做 `workflow_call`，各仓自带一份逐字相同的副本。

- **意图**：否则一处改动会同时改变所有仓 —— 且在各仓的 diff 里看不见 —— 还要多出一层跨仓排障。
- 副本之间靠**逐字相同**约束，不靠模板生成；两个副本不一致时以本文的形状为准。
- **重开条件**：插件仓数量达到 6 个以上，或某个 workflow 开始出现真实的分支逻辑与多仓参数。
- 论证与被否掉的选项 → [决策：workflow 不抽成可调用 workflow](../.agents/notes/2026-10-12-workflow-copies-not-extracted.md)。

**载体状态**：不建共享包、不抽副本。知识类靠指针（宿主官方真源），断言类走各仓各写、接受双向同步。

---

## 三、各仓自持各件的标准形状

以下只写形状，不含会漂的值（版本号、计数、线名）。新建仓照形状写，老仓据此核对。

### 3.1 CI 的收口 job

各仓 `ci.yml` 的最后一个 job：让 ruleset 只盯一个状态检查名，内部 job 增删时规则集不用动。

四条不能动：

- **判定只放 step 级** —— 放 job 级时条件为假会让 job 变 `skipped`，而 GitHub 把 `skipped` 当成功。意图：防假绿。
- **`needs` 必须列全本文件的 job id** —— 漏一个，那个 job 红了也照样放行。
- **`if: always()`** —— 否则上游失败会把收口 job 自身也跳过。
- **`skipped` 与 `failure`、`cancelled` 一并判红** —— 没跑过的 job 不能算过。

```yaml
  ci-success:
    name: CI Success
    runs-on: ubuntu-latest
    needs: [<本文件全部 job id>]
    if: always()
    steps:
      - name: Verify all jobs succeeded
        if: contains(needs.*.result, 'failure') || contains(needs.*.result, 'cancelled') || contains(needs.*.result, 'skipped')
        run: |
          echo "::error::有 job 未成功 —— CI Success 判红"
          echo '${{ toJSON(needs) }}'
          exit 1
```

ruleset 的 `required_status_checks` 只配 `CI Success` 这一个名字。

### 3.2 依赖漂移巡检

只开 `github-actions` 生态。意图：本族的 npm 依赖大半在宿主的预发布线上，放开自动 PR 只会变成噪音。

```yaml
version: 2
updates:
  - package-ecosystem: github-actions
    directory: '/'
    schedule:
      interval: weekly
      day: monday
    commit-message:
      prefix: ci
    groups:
      actions:
        patterns: ['*']
```

### 3.3 草稿 Release

**配置**放组织仓（`.github/release-drafter.yml`，各仓没有自己的配置时会回退到它）。
**workflow** 各仓一份，逐字相同：

```yaml
name: release-drafter

on:
  push:
    branches:
      - main
  workflow_dispatch:

permissions:
  contents: write

jobs:
  update-draft:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: release-drafter/release-drafter@v7
```

- **runner 必须固定 ubuntu**。意图：windows runner 上 action 读不到配置文件，草稿静默为空、**不报错**（action 主版本随官方走）。
- **草稿的 tag 名与版本号解耦** —— 草稿占用一个固定名，不占用 `v<版本>`。意图：否则「这个版本是否已发布」的检查会撞上草稿，走进「已存在、跳过」的分支，包发出去了、Release 页却没有，且**不报错**。
- 草稿汇总的是 **PR**，不是 commit：直推 `main` 的提交对它不可见。这是取舍，不是缺陷。

### 3.4 TypeScript 与测试骨架

- 宿主半边与浏览器半边各一份 tsconfig；日常与契约**两套** vitest 配置分开。
- 日常配置**显式排除**契约用例；契约配置单跑（不并行、超时放宽）。
- `strict` 必须开。编译器开关负责类型与死代码，ESLint 负责编译器覆盖不到的那一档（格式、hooks、promise、import）——**分工口径跨仓一致，工具参数各仓自定**（分号、引号本就不同）。
- **本地钩子只跑秒级检查**（格式化与 lint 的自动修复），typecheck 与测试留给 CI。意图：钩子一慢，就会有人用 `--no-verify` 绕过，等于没有钩子。
- CI 安装一律走 frozen 模式，不联网解析新版本。
- **每个可维护目录一对双件**：`AGENTS.md` 写「在这里要怎么干」，`README.md` 写「这里有什么、改哪」；同一事实只有一个 home，跨件只给指针。

### 3.5 发布态守卫与兼容巡检

- **发布态不变量**落成 `check:release` 脚本，发布流程在 publish **之前**跑它。
- **兼容巡检**对着**上游**动没动，本地提交改不了结论，所以按周跑、**不挂 `push`**。
- 换包脚本清残留时**两种锁文件都要清**（`package-lock.json` 与 `pnpm-lock.yaml`）。意图：留着旧锁会让安装直接失败，而**安装失败之后依赖树停在旧版本上、后面每一步都绿**。
- **声明面是若干族的并集**（`||` 分隔）时，测**任何一族**都必须把声明临时收窄到那一族 —— **不只是低族**。意图：不收窄会装出**混合树**，「换到某条线」这一步跑的根本不是那条线。机制 → [依据：并集声明下安装器按 latest 选族](../.agents/notes/2026-10-12-installer-picks-latest-family.md)。
- **收窄会撞上两条读 `package.json` 的红线**：族前缀这类值只写在机器输入行（矩阵值或 `run`），不写进 workflow 注释；跑 typecheck / build / test **之前**把清单还原成提交时的样子。意图：红线判的是**仓库的声明**，不是巡检里临时的收窄形态。论证 → [决策：compat 收窄只服务装与核对，跑测试前还原清单](../.agents/notes/2026-10-12-narrowing-and-redlines.md)。
- **巡检红了的可见性**：定时任务的失败邮件只发给最后改过 cron 的人，不能当主通知 —— 失败要开或更新一条**固定标题**的跟踪 issue（同一处失败不重复刷评论）。

---

## 四、逐条判据（跨仓一致性）

三档的含义：

| 档 | 含义 |
|---|---|
| **必须一致** | 不一致就是缺陷，要落成校验 |
| **最好一致** | 判定逻辑共享，参数各仓定 |
| **能力可选** | 规则本身不适用，**不是被关掉** |

| 规则 | 档 | 落点 |
|---|---|---|
| 锁文件的 `resolved` 必须指向官方源 | 必须一致 | 各仓红线断言（条数现算，不抄进文档） |
| peer 缺失 → 失败；仅 dev 缺失 → 告警跳过 | 最好一致 | 判定逻辑共享（**默认 fail**），跟哪条宿主线各仓定 |
| peer 与 dev 的版本必须一致 | 必须一致 | 各仓红线断言 |
| 四个编译器开关与 ESLint 各自分工 | 最好一致 | 各仓红线守着开关存在；**开关值留 `tsconfig.json`**，工具参数各仓自定 |
| 发布态不变量 | 必须一致 | 各仓 `check:release`；纯宿主插件可豁免 `files` 那条，**宿主兼容范围必须有** |
| 发布流程**不得** bump 版本 | 必须一致 | 各仓红线断言，**带反向控制**。bump 是发布前的独立一步 |
| 发布前确认**远端**已有要发的提交 | 必须一致 | 各仓 `docs/PUBLISHING.md` 的「发版前确认」 |
| 发布必须产出**同形**的 git 侧产物（tag 形状、Release 存在、预发布要标出） | 必须一致 | 各仓发布流程断言。tag 名是**机器**在读（守卫靠 `git describe --match`），不是纯审美 |
| 宿主兼容范围与 peer 区间必须**自洽** | 必须一致 | 各仓红线。跨仓只比**下限**（可比），**上界形状各仓自定** |
| 依赖类别的判据是「**我们与它的关系**」：只 `import type` → `devDependencies`；**消费它提供的服务** → `peerDependencies` | 必须一致 | 各仓 `AGENTS.md`。判据与现状对不上时，下一个人会照规则把它删掉 |
| TypeScript 严格开关的档位（`strict` / 索引访问 / 可选属性） | 最好一致 | **流程**共享：开任一开关前用**真实配置**量位点数（不是 CLI 覆盖），两个开关同开必须单独测一次；**参数各仓自定**，不维护跨仓快照 |
| 「只记录不阻断」的巡检项 | 必须一致 | 必须附理由，否则绿会掩盖真问题 |
| 诊断类步骤（例如发布时 dump 凭据声明） | — | 属物化类：**留本地 workflow**，不抽 |
| 路径冲突断言 | — | **不写**：已有等价保护，再写一份是重复 |
| CSS 注入方式、有没有样式文件 | 能力可选 | 留各仓：规则本身不适用 |
| 客户端 `inject` 只列真实依赖 | 必须一致 | 用官方自带校验器，不另写散文 |

**两类内容分开治理**：

- **断言**（错了 = CI 当场红，**响**）—— 先上。
- **知识**（错了 = 有人读了过期指南，**安静**）—— 同批做，但不算红线。

**一条兜底判据**：某个仓撞上上游**类型面**过不去时，**有权停在能构建的那条线上** ——
能构建优先于跟线。这条与上面各条不冲突：上面说的是「声明要与被推荐的线自洽」，
这里说的是「自洽的对象可以是更靠下的那条线」。各仓停在线上不必强行对齐。

**这些判据为什么住在这里、不住在某个仓里** → [决策：跨仓判据住在组织仓，各仓只留指针](../.agents/notes/2026-10-12-criteria-live-in-the-org-repo.md)。

---

## 五、怎么核对

- **逐字相同的副本** → 比字节，不比语义。
- **形状** → 照本文的判据看，不照本文抄值。
- **规则不能只写在散文里** → 能落成断言的就落成断言（红线测试、`check:*` 脚本），散文只留指针。
- **对比型描述（「A 有、B 没有」）最易陈腐** → 它同时依赖两边状态，动手前回原始来源现查一次。
