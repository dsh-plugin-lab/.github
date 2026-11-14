# 决策：发布流抽成组织级可复用 workflow（2026-11-14）

状态：生效

**类型**：决策。

## 问题

各插件仓各带一份 `release.yml`（337–300 行），内容是同一条发布链的变体。要不要抽成
`workflow_call`，各仓只留触发条件与 environment 名。

2026-10-12 的[决策](2026-10-12-workflow-copies-not-extracted.md)结论是**不抽**，并留了重开条件：
「插件仓达到 6 个以上，或某个 workflow 开始出现真实的分支逻辑与多仓参数」。插件仓已经到 6 个。

## 决策

**抽，但只抽发布链**，物理位置在组织仓的
[`.github/workflows/release-publish.yml`](../../.github/workflows/release-publish.yml)。

- 抽的是**顺序与保证**：守卫、装依赖、typecheck、build、test、`check:release`、tag/版本一致、
  查 npm 是否已有该版本、发布、打 tag、挑正文、建 Release、退草稿。
- 各仓留的是**真正属于它自己的**：触发条件（`workflow_dispatch` + `v[0-9]*` tag）、
  `environment` 名、`permissions`。
- **`ci.yml` 不抽**：它的收尾 job 带名字 `CI Success`，ruleset 是逐仓盯这个名字的；被调用的 job
  给不回那个名字。这是技术约束，不是偏好。
- **必须插一步的仓保留整份副本**：`dsh-zhihu-search` 在构建与发布之间有自己的步骤（真实 API 验收、
  OIDC claims 转储、推送发布提交），它不调用共享文件，并在本仓 `AGENTS.md` 说明。这条写进公约，
  是为了让「例外」和「漂移」分得开。
- **先在一仓试通，再铺开**：`dsh-harness-dispatcher` 的 `release.yml` 与模板结构差异曾是 0，
  是最干净的试点。**状态（2026-11-14）：试点已通过** —— 它发出 `0.1.1`，`_npmUser` 是
  `GitHub Actions` 且带 `trustedPublisher`，产物带 SLSA `provenance/v1`，tag、Release 与草稿回收
  全部正常。实测同时回答了「npm 认调用方还是被执行方」：**认调用方**，所以各包 TP 一个都不用改 ——
  见[依据：npm 的 OIDC 校验的是调用方 workflow](2026-11-14-npm-oidc-validates-the-caller.md)。

## 替代方案（强制）

- **维持各仓副本、只改阈值**：不解决真正的问题。副本已经漂成四种注释语言、五种同名步骤写法；
  改一处仍在 6 个仓里各改一遍，而「改完全绿」没有任何东西证明它们一致。
- **`@main` 引用**：一改全族同时变，且变在各仓 diff 里看不见 —— 这是 2026-10-12 否决抽取的
  主要理由。现在用**可调用 workflow 的调用点**缓解：调用点是一个薄壳，diff 里看得见；共享文件
  自身的改动仍不可见，因此它的变更必须走 PR，并且判据核对它的内容。
- **建共享包**：省下的仍是一份很少改动的重复文本，换来跨仓故障半径，不划算。

## 影响

- 组织仓多了**第二个 workflow**，而它此前只有「核对判据」这一个。原先的规矩是「只有一个 workflow，
  且只许核对判据」；现在改成「只许**核对**或**被调用**」，不允许有触发器 —— 这条改动见
  [AGENTS.md](../../AGENTS.md)。
- `plugin-conventions.md` §3 的那条规则改写：不是「workflow 不抽」，而是「发布链抽，`ci.yml` 不抽，
  插步的仓保留副本」。
- 模板的 `release.yml` 从 328 行降到十几行 —— 新仓出生即调用共享文件，不再出生就带一份要同步的副本。
- 判据 `release-two-entry-points` / `release-oidc` / `release-tag-shape` 读的是**各仓自己的**
  `release.yml`。薄壳仍带触发条件、`id-token: write` 与 tag pattern，所以三条判据继续成立；
  但 `release-no-version-bump` 读的薄壳里没有 `npm version`，它从此**只对保留整份副本的仓有牙齿**。
  这条要记在判据文档里，否则它看起来覆盖全族、实际只覆盖例外。
