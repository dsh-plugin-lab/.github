# 插件仓通用约定

**本文职责**：哪些东西放组织级、哪些各仓自持，以及各仓自持那些的**标准形状**。
**读者**：新建插件仓的人（照抄形状）与维护者（核对）。
**不负责**：某个仓自己的业务与设计 → 那个仓的 `AGENTS.md` 与 `docs/ARCHITECTURE.md`。

判断一个文件该放哪，按顺序问三个问题：

1. **机制支不支持回退？** 支持 → 放本仓（组织 `.github`），各仓代码零改动。
2. **内容通用、但机制不支持？** → 各仓独立，形状写进本文第二节。
3. **内容仓特有？** → 各仓独立，本文不管。

---

## 一、能回退的：放本仓根目录或 `.github/`

GitHub 只在平台支持的位置读这些文件，且**各仓有同名文件时用自己的**。放这里的收益是新增仓自动继承，且不产生任何提交、各仓 Git 内容不变。

| 文件 | 放哪 | 作用范围 |
|---|---|---|
| `SECURITY.md` | 仓根 | 未自带该文件的仓 |
| `CODE_OF_CONDUCT.md` | 仓根 | 同上 |
| `SUPPORT.md` | 仓根 | 同上 |
| `CONTRIBUTING.md` | 仓根 | 同上 |
| `PULL_REQUEST_TEMPLATE.md` | 仓根 | 同上 |
| `.github/ISSUE_TEMPLATE/*.yml` | **必须在 `.github/ISSUE_TEMPLATE/`** | 同上；某仓一旦自建该目录，本仓模板对它**整体失效** |
| `profile/README.md` | `profile/` | 组织主页，不属回退机制 |

三条机制上的坑（都实测过）：

- **issue 模板放仓根不生效。** 它的搜索路径与其他健康文件不同，只认 `.github/ISSUE_TEMPLATE/`。症状是「新建 issue 只有空白」——**不报错**。
- **没有多语言机制。** `CONTRIBUTING_en.md` 这类名字不被识别，别指望靠它做双语回退；要双语只能写在同一份文件里。
- **回退只在「本仓没有同名文件」时发生。** 各仓已有自己的 `CONTRIBUTING.md` 时，本仓的那份永远不会被显示 —— 它服务的是**将来新建的仓**。

---

## 二、通用但不抽的：形状写在这里

**`workflow` 类明确不抽**：不做 `workflow_call`，各仓自带一份逐字相同的副本。

理由：

- 可调用 workflow 只有两种引用方式，各有代价：`@main` 让本仓一改、所有仓同时变（且在各仓的 diff 与历史里**看不见**）；`@v1` 要额外维护 tag 与「破坏性变更是否升版」的政策。
- 省下的是一份**很少改动**的重复文本，换来的是「一改多炸」的故障半径与一层跨仓排障。
- **重开条件**：插件仓数量达到 6 个以上，或某个 workflow 开始出现真实的分支逻辑与多仓参数。

副本之间靠**逐字相同**约束，不靠模板生成；两个副本不一致时以本文的形状为准。

---

## 三、各仓自持各件的标准形状

以下只写形状，不含会漂的值（版本号、计数、线名）。新建仓照形状写，老仓据此核对。

### 1. CI 的收口 job

各仓 `ci.yml` 的最后一个 job：让 ruleset 只盯一个状态检查名，内部 job 增删时规则集不用动。

四条不能动：

- **判定只放 step 级** —— 放 job 级时条件为假会让 job 变 `skipped`，而 GitHub 把 `skipped` 当成功，那正好是要防的假绿。
- **`needs` 必须列全本文件的 job id** —— 漏一个，那个 job 红了也照样放行。
- **`if: always()`** —— 否则上游失败会把收口 job 自身也跳过。
- **`skipped` 与 `failure`、`cancelled` 一并判红**。

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

### 2. 依赖漂移巡检

只开 `github-actions` 生态：本族的 npm 依赖大半在宿主的预发布线上，放开自动 PR 只会变成噪音，需要时手工升。

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

### 3. 草稿 Release

**配置**放组织级（本仓的 `.github/release-drafter.yml`，各仓没有自己的配置时会回退到它）。
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

- **runner 必须固定 ubuntu**：windows runner 上路径分隔符会让 action 读不到配置文件，草稿静默为空、**不报错**（action 主版本随官方走）。
- 草稿的 tag 名与版本号解耦：草稿占用一个**固定名**，不占用 `v<版本>` —— 否则「这个版本是否已发布」的检查会撞上草稿，走进「已存在、跳过」的分支，包发出去了、Release 页却没有，且**不报错**。

### 4. TypeScript 与测试骨架

- 宿主半边与浏览器半边各一份 tsconfig；日常与契约**两套** vitest 配置分开。
- 日常配置**显式排除**契约用例；契约配置单跑（不并行、超时放宽）。
- `strict` 必须开。编译器开关负责类型与死代码，ESLint 负责编译器覆盖不到的那一档（格式、hooks、promise、import）——**分工口径跨仓一致，工具参数各仓自定**（分号、引号本就不同）。
- **本地钩子只跑秒级检查**（格式化与 lint 的自动修复），typecheck 与测试留给 CI：钩子一慢，就会有人用 `--no-verify` 绕过，等于没有钩子。
- CI 安装一律走 frozen 模式，不联网解析新版本。

### 5. 发布态守卫与兼容巡检

- **发布态不变量**（宿主兼容范围、`files` 覆盖、bundle patch、展示元数据的导出面）落成 `check:release` 脚本，发布流程在 publish **之前**跑它。
- **兼容巡检**对着**上游**动没动，本地提交改不了结论，所以按周跑、**不挂 `push`**。
- 换包脚本清残留时**两种锁文件都要清**（`package-lock.json` 与 `pnpm-lock.yaml`）：留着旧锁会让安装直接失败，而**安装失败之后依赖树停在旧版本上、后面每一步都绿**。
- 声明面是**若干族的并集**（`||` 分隔）时，测低族必须把声明临时收窄到那一族 —— 并集会被解析成「匹配集里最高的那族」。
- **发布流程不得 bump 版本**：bump 是发布前独立的一步。发布依赖的是**远端**状态，「本地全绿」是另一回事，发版前要确认远端已有要发的提交。

---

## 四、怎么核对

- **逐字相同的副本** → 比字节，不比语义。
- **形状** → 照本文的判据看，不照本文抄值。
- **规则不能只写在散文里** → 能落成断言的就落成断言（红线测试、`check:*` 脚本），散文只留指针。
