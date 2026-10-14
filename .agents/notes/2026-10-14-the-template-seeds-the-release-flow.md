# 模板带发布链：判据说必须一致，实现却没人播种

状态：生效

**类型**：决策。

## 问题

`docs/plugin-conventions.md` §4 把「发布态不变量」列为**必须一致**，落点写的是各仓的
`check:release`；把「发版说明读草稿 / 发完删草稿 / OIDC 发包」列为行为底线。但模板里
**这三样都没有**：`package.json` 没有 `check:release`，没有 `release-guard.mjs`，也没有
`release.yml`。

后果很具体：**照模板生成的新仓，在它诞生的那一天就不满足一条必须一致的判据**，而且四条底线
一条都没有提示。下一个人要么重新踩一遍（尤其是 tag 触发的 `--exclude` 陷阱），要么发现判据是
空头支票。

而判据说「落点是各仓的 `check:release`」，读起来像在说「这东西本来就该有，只是还没人写」。
实际上四仓的 `check-release.mjs` 是 83 / 208 / 295 / 312 行，**各自长出来的，不是同一份**。

## 决策

**模板播种发布链的三件（`release.yml`、`check-release.mjs`、`release-guard.mjs`），
统一部分写死、差异部分留占位符。**

写死的是家族共有、且实测过的那部分；留占位符的是各仓真正的自留地：

| 留占位符的 | 为什么不能统一 |
|---|---|
| `{{prePublishChecks}}` 发版前检查链 | 各仓要证明的东西本来就不同（zhihu 要真实接口验收、wbb 有 8 分钟超时预算） |
| `{{environment}}` | npm Trusted Publisher 上配的 environment 名**逐仓不同**（`release` vs `github-release`），OIDC 声明要求逐字一致 |

## 替代方案

**① 什么都不加，判据文档写清四条底线，实现一律自写。**
保住「发版层完全放开」的纯净。**否**：这次的决定本身就是「发版层放开、但有底线」；模板不给
参考实现，底线就只是四行散文，下一个新建仓的人照样得从零踩坑——而坑是**静默**的。

**② 只加 `check-release.mjs`，不加 `release.yml`。**
`check:release` 确实必须一致，能补。但 tag 触发的两个坑（基线排除正在发的 tag、main 判定
带 `github.event_name` 守卫）**都在 `release.yml` 里**，不补等于坑照留。

**③ 抽成组织级可复用 workflow（`workflow_call`）。**
§2 明确写过「workflow 不抽」：一处改动会让所有仓同时变，且**不出现在任何仓的 diff 里**，
排查成本高。保持不抽。

## 依据（实测，不是推断）

写之前先把四仓各自的 `check-release.mjs` **跑在脚手架产出的骨架上**：

| 仓的守卫 | 跑在骨架上 |
|---|---|
| zhihu-search | ✅ passed |
| ds-balance | ✅ passed（连 icon / locale / exports 那组都过） |
| workbuddy | ❌ 只差 `NOTICE` 存在 + `files 含 NOTICE` |
| plugin-debugging | ❌ 差 `exports 暴露 ./skills/*`（插件特有）+ `lib/` 未构建（检出态正常） |

**结论：家族共有那一套，骨架已经全部满足**；workbuddy 与 debugging 差的都是**它们自己**
的额外断言。所以模板那份只写共有那套，各仓在后面**追加**——这也回答了「模板会不会逼着我
抄一份错的」：不会，因为可抄的部分已经被实测证明能过。

反向控制六条，全部按预期变红：icon 从 `files` 里去掉 / `engines.dsh` 抬到 peer 之上 /
纯文档改动集 / 未识别路径算产物 / `release.yml` 里出现 `npm version`。
另有 `scaffold --verify` 在空目录生成后 `check`、`lint`、`format:check` 全绿。

## 影响

- 模板多 3 个文件、约 30 行占位符渲染逻辑；`--profile` 一个选项消失（pnpm 统一之后它
  是个假选项，选错只会在那个仓的 CI 里晚点炸）。
- `scaffold check` 的 variant 比对塌成单源：一个文件不可能来自两处，`plan()` 里的
  「层冲突」判定随之变成不可达，删掉。
- 判据文档新增 §3.8「发布流程」与四条底线对应的 §4 行；`README.md` 补一句散文的语言归属
  （模板与脚本一律英文）。
- **对已有四仓无影响**：scaffold 是播种器，不回写。
