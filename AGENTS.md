# 组织级仓 — 维护索引

本文件只服务"维护这个组织仓"这件事：它**不回退到插件仓**，也不会在插件仓的工作里被注入。
各插件仓有自己的规则层，它们靠文档地图里的一行绝对 URL 指针找到本仓的判据文档。

读者与边界见 [README.md](README.md)。

## 全局规则（本仓特有）

- **A 类文件的改动影响所有插件仓的展示面** —— 本仓改一版，那些"没有自己的同名文件"的仓
  当场跟着变，且它们那边**没有任何提交**。改前先想清服务范围（对照表在 [README.md](README.md)）。
- **判据文档必须双语同改** —— 改 [docs/plugin-conventions.md](docs/plugin-conventions.md)
  必须同改 [docs/plugin-conventions_zh.md](docs/plugin-conventions_zh.md)：两份的互链行、
  结构（标题数 / 表格行 / 代码块）与代码块逻辑必须一致，只有散文与注释、字符串文案可不同。
- **判据与论证分家** —— 判据文档只留判据 + 一行意图 + 重开条件 + 核对方法 + 指针；
  论证、推演、实测复盘写进 [.agents/notes/](.agents/notes/)。搬动时两侧指针同改。
- **issue 模板必须在 `.github/ISSUE_TEMPLATE/`** —— 放仓根不生效，且**不报错**（只认那一个路径）。
- **`profile/` 里的链接必须写绝对 URL** —— 它渲染在组织主页上，相对链接指不到。
- **notes 不追改** —— 记录当时的事实，不随上层文档更新；事实性变化就地改，决策反转才新写一条
  并交叉引用。规则见 [.agents/notes/AGENTS.md](.agents/notes/AGENTS.md)。
- **YAML 里值含 `: `（冒号加空格）一律加引号** —— 否则被解析成映射。

## 常用命令

- 链接校验：`python <maintenance-flow>/check-markdown-links.py <本仓> --fragments --refs`
- 换行校验：`git diff --check`
- 本仓**无 CI、无构建、无依赖安装**：改完跑上面两条，再去 GitHub 上看渲染。

## 验证快照

- 无 CI；校验 = 链接校验 + 换行校验手工跑，定性结论才算数。
- 本仓的判定要看**渲染效果**而不是文件内容：issue 表单要点开 New issue 看下拉项，
  组织主页要看 github.com/dsh-plugin-lab，回退要看 `community/profile` 的返回。

## 待办

- [ ] 平台侧设置（私密漏洞报告、ruleset、Discussions）由人工在设置界面开启，不属 agent 范围。

## 活跃坑

- issue 表单的下拉选项写 `link: (local development)` 会被 YAML 当映射 → 必须整体加引号。
- 回退**只在"本仓没有同名文件"时发生**：各仓已有自己的 `CONTRIBUTING.md` 时，本仓那份永远不会
  被显示 —— 它服务的是将来新建的仓。
- `community/profile` API 的 `issue_template` 字段**只报单文件形态**，不报目录形态：
  那里显示「(无)」是正常的，不是缺陷。
- 相对链接在回退链上按**文件所在仓**解析：本仓 `CONTRIBUTING.md` 里的
  `docs/plugin-conventions.md` 跳到本仓，不会跳到看它的那个仓。

## 文档地图

- 跨仓判据（双语）→ [docs/plugin-conventions.md](docs/plugin-conventions.md) · [中文](docs/plugin-conventions_zh.md)
- 决策与依据 → [.agents/notes/](.agents/notes/)（结构见其 [README.md](.agents/notes/README.md)）
- 组织主页 → [profile/README.md](profile/README.md) · [中文](profile/README_zh.md)
- 贡献规则 → [CONTRIBUTING.md](CONTRIBUTING.md)
- A 类社区健康文件 → [SECURITY.md](SECURITY.md) · [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) · [SUPPORT.md](SUPPORT.md) · [PULL_REQUEST_TEMPLATE.md](PULL_REQUEST_TEMPLATE.md)
- 复用的工作流配置 → [.github/release-drafter.yml](.github/release-drafter.yml)
