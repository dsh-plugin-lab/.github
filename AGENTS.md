# 组织级仓 — 维护索引

本文件只服务"维护这个组织仓"这件事：它**不回退到插件仓**，也不会在插件仓的工作里被注入。
各插件仓有自己的规则层，它们靠一行绝对 URL 指针找到本仓的**公约**。

读者与边界见 [README.md](README.md)。

## 全局规则（本仓特有）

- **A 类文件的改动影响所有插件仓的展示面** —— 本仓改一版，那些"没有自己的同名文件"的仓
  当场跟着变，且它们那边**没有任何提交**。改前先想清服务范围（对照表在 [README.md](README.md)）。
- **两份文档都必须双语同改** —— 改 [docs/plugin-conventions.md](docs/plugin-conventions.md) 要同改
  [docs/plugin-conventions_zh.md](docs/plugin-conventions_zh.md)；改 [docs/criteria.md](docs/criteria.md) 要同改
  [docs/criteria_zh.md](docs/criteria_zh.md)。每对的两份：互链行、结构（标题数 / 表格行 / 代码块）
  与代码块逻辑必须一致，只有散文与注释、字符串文案可不同。
- **判据与论证分家** —— 判据只留「档 + 由谁判」；规则、一行意图、重开条件住公约；
  论证、推演、实测复盘写进 [.agents/notes/](.agents/notes/)。搬动时两侧指针同改。
- **issue 模板必须在 `.github/ISSUE_TEMPLATE/`** —— 放仓根不生效，且**不报错**（只认那一个路径）。
- **`profile/` 里的链接必须写绝对 URL** —— 它渲染在组织主页上，相对链接指不到。
- **notes 不追改** —— 记录当时的事实，不随上层文档更新；事实性变化就地改，决策反转才新写一条
  并交叉引用。规则见 [.agents/notes/AGENTS.md](.agents/notes/AGENTS.md)。
- **YAML 里值含 `: `（冒号加空格）一律加引号** —— 否则被解析成映射。
- **模板与脚本散文一律英文** —— 生成的仓是给外部看的。本仓根目录的展示文件（`README.md`、
  `CONTRIBUTING.md`、`SECURITY.md` 等）也是英文；只有服务维护者的中文（`AGENTS.md`、
  公约与判据的中文版、notes）才用中文。
- **`git diff --check` 报的「行尾空白」先怀疑 CRLF** —— 本仓 `.gitattributes` 写的是
  `* text=auto eol=lf`，索引里若还留着 CRLF，改一行就会让整文件冒出假告警。

## 常用命令

- 链接校验：`python <maintenance-flow>/check-markdown-links.py <本仓> --fragments --refs`
- 换行校验：`git diff --check`
- 铺新仓骨架：`node scripts/scaffold.mjs <空目录> [--host-only]`
  （先 `--dry-run` 看清单；目标非空会被拒绝，这是有意的 —— 它只给空目录用）
- **改过 `templates/` 就跑一遍 `--verify`**：它装依赖并跑生成仓自己的 CI 检查
  （`check` / `lint` / `format:check`）。这是模板唯一的验收手段 —— 本仓的 workflow 只核判据，
  不跑模板，模板坏了不会有别的东西报出来
- **模板改了判据要留反向控制**：把生成仓的某个文件改坏一处，确认对应守卫**真的会红**。
  「现在这条绿」和「这条判据有牙齿」是两件事，后者要单独证
- 核对逐字相同件：`node scripts/scaffold.mjs check <仓目录>...` —— 模板那一份与仓内同名文件
  做 SHA-256 比对。**不一致不必然是缺陷**（分号、锁文件名本来就是逐仓参数），
  它报的是「知道它不同」，不是「强行一样」
- 核对判据落点：`node scripts/check-criteria.mjs`（`--trace` 看抓取与缓存，`--json` 给机器读，
  `--update-baseline` 重写 `redlines-baseline.json`）。它自动发现插件仓（`dsh-` 前缀 + 清单有 `dsh`
  字段），比对可机检的判据与红线规模。**改过判据就跑一遍**。
- 本仓**无构建、无依赖安装**：改完跑上面几条，再去 GitHub 上看渲染。
  两个脚本都只用 `node:` 内建模块，不破这条
- **只有一个 workflow，且只许核对判据**：`.github/workflows/check-criteria.yml`。加第二个要先改
  [决策记录](.agents/notes/2026-10-20-the-org-repo-checks-its-own-criteria.md)。

## 验证快照

- 校验 = 链接校验 + 换行校验**手工跑**；判据落点由**唯一的 workflow 每周自动核**（见上）。
  两者不重叠：手工那两条查本仓文档自身，workflow 查别的仓是否还符合本仓发布的判据。
- 本仓的判定要看**渲染效果**而不是文件内容：issue 表单要点开 New issue 看下拉项，
  组织主页要看 github.com/dsh-plugin-lab，回退要看 `community/profile` 的返回。

## 待办

- [ ] 平台侧设置（私密漏洞报告、ruleset、Discussions）由人工在设置界面开启，不属 agent 范围。
- [ ] **`dsh-workbuddy-bridge` 的「四个编译器开关各管一层」仍没有执行体**：判据是 **Should agree** 档，
  那几个开关在 `tsconfig.json` 与 `tsconfig.client.json` 里都在（`strict` / `noUncheckedIndexedAccess` /
  `noFallthroughCasesInSwitch` / `noUnusedLocals`），缺的是「该仓自己断言它们还在」这一层 ——
  开关被谁删掉时没有任何东西会红。
  （同一条待办里的「peer 与 dev 版本逐条相等」已于 2026-10-20 处理：三处漂移修掉并补了红线断言，
  决策记录在该仓 `.agents/notes/2026-10-20-peer-dev-version-agreement.md`。）
  二选一：补断言，或把判据那一行的档位/措辞改成与现状一致。

## 活跃坑

- issue 表单的下拉选项写 `link: (local development)` 会被 YAML 当映射 → 必须整体加引号。
- 回退**只在"本仓没有同名文件"时发生**：各仓已有自己的 `CONTRIBUTING.md` 时，本仓那份永远不会
  被显示 —— 它服务的是将来新建的仓。
- `community/profile` API 的 `issue_template` 字段**只报单文件形态**，不报目录形态：
  那里显示「(无)」是正常的，不是缺陷。
- 相对链接在回退链上按**文件所在仓**解析：本仓 `CONTRIBUTING.md` 里的
  `docs/plugin-conventions.md` 跳到本仓，不会跳到看它的那个仓。

## 文档地图

每份文档只有一个 home，各存一类。**改某件事之前先确认它的 home 在哪**，不要就地另起一份。

| 文件 | 它的身份 | 谁读它 |
|---|---|---|
| [README.md](README.md) | 本仓入口：GitHub 为什么会把这些文件放这儿 + **身份路由表** | 任何打开本仓的人 |
| [docs/plugin-conventions.md](docs/plugin-conventions.md) · [中文](docs/plugin-conventions_zh.md) | **公约**：插件仓长什么样（§1）、发出去的包必须带什么（§2）、刻意不抽（§3）。**不自带判定** | 写插件的人；被注入进插件仓的 agent |
| [docs/criteria.md](docs/criteria.md) · [中文](docs/criteria_zh.md) | **判据**：公约每条规则定档 + 写明由谁判。**不复述规则本身** | 判「这是不是缺陷」的人 |
| [AGENTS.md](AGENTS.md) | **本仓特有**：命令、全局规则、活跃坑 | 在本仓干活的维护者与 agent |
| [.agents/notes/](.agents/notes/)（结构见其 [README.md](.agents/notes/README.md)） | 决策与依据 —— 「为什么这样定」 | 要动判据的人 |
| [assets/badges.md](assets/badges.md) | 徽章拷贝即用片段（**存放件，非活件**） | 改插件门面的人 |
| [templates/plugin/](templates/plugin/) + [scripts/scaffold.mjs](scripts/scaffold.mjs) | 新仓骨架播种器，**不回写任何已存在的仓** | 建新仓的人 |
| [profile/README.md](profile/README.md) · [中文](profile/README_zh.md) | 组织主页（渲染在那儿，链接必须绝对 URL） | 组织访客 |
| [CONTRIBUTING.md](CONTRIBUTING.md) · [SUPPORT.md](SUPPORT.md) · [SECURITY.md](SECURITY.md) · [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) · [PULL_REQUEST_TEMPLATE.md](PULL_REQUEST_TEMPLATE.md) | **回退件**，渲染进没有同名文件的插件仓 | 贡献者与使用者 |
| [.github/release-drafter.yml](.github/release-drafter.yml) | 草稿的共享**形状**；标签映射逐仓自定 | 维护草稿的人 |

**三条不许越界的边界**（越界即缺陷）：

- **规则只住 `plugin-conventions.md`，判定只住 `criteria.md`，论证只住 notes。** 三边互链，不互抄：
  判据不复述规则，公约不写判定，notes 不写判据。
- `CONTRIBUTING.md` 渲染进各仓，因此它**只放贡献者要遵守的东西**；跨仓判据在那里只给指针。
- 本仓的展示面（`README.md`、回退件、模板）**一律英文**；中文只在维护者层。

**本仓不管什么**（免得在这里白找一遍）：插件清单与市场索引属
[dsh-plugin-lab/market](https://github.com/dsh-plugin-lab/market)，插件代码与发布属各插件仓。
本仓只管组织级文件、插件仓公约与判据、新仓骨架；`README.md` 的 Start-here 表是意图路由，只给指针，不收内容。
