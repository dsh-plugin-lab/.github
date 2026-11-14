# 依据（实测）：npm 的 OIDC 校验的是调用方 workflow（2026-11-14）

状态：生效

**类型**：依据（实测）。

## 背景

把发布链抽成组织仓的 `workflow_call` 之后，npm 的 Trusted Publisher 会不会因为「真正跑 `pnpm publish`
的文件在另一个仓」而拒绝，公开资料没有定论。两种说法都有人写，且都举了例子：

- 一种说校验 `workflow_ref`（调用方）；
- 一种说校验 `job_workflow_ref`（实际执行的那份文件）。

两条路需要做的事完全不同：前者意味着现有 5 个包的 TP 一个都不用改，后者意味着每个包都要改字段，甚至
要把 Repository 改成 `.github` —— 那会放宽信任面。所以这件事只能实测。

## 实测

用 `dsh-harness-dispatcher` 做试点（它的 `release.yml` 与模板结构差异为 0，失败时指向调用而非本地改动）。

claims 实测值（由共享流里失败时打印的步骤拿到）：

```json
"aud":              "npm:registry.npmjs.org",
"sub":              "repo:dsh-plugin-lab/dsh-harness-dispatcher:environment:release",
"repository":       "dsh-plugin-lab/dsh-harness-dispatcher",
"job_workflow_ref": "dsh-plugin-lab/.github/.github/workflows/release-publish.yml@refs/heads/main",
"workflow_ref":     "dsh-plugin-lab/dsh-harness-dispatcher/.github/workflows/release.yml@refs/heads/main",
"environment":      "release"
```

三次尝试的对照：

| TP 的 Workflow filename | 结果 |
|---|---|
| （不存在） | 404 |
| `release-publish.yml` | 404 |
| **`release.yml`** | **成功** |

成功的那次：`_npmUser` 是 `GitHub Actions` 且带 `trustedPublisher.oidcConfigId`，产物带 SLSA
`provenance/v1` attestation，tag 与 Release 都正常产出。

## 结论

**npm 校验的是调用方（`workflow_ref`）的文件名**，不是实际执行 publish 的那份。因此：

- 跨仓 `workflow_call` 发布**可行**；
- 各包 TP 的 Repository 仍是自己的仓，**不需要**改成 `.github`，信任面不扩大；
- 抽取对 npm 侧是**零改动**。

## 影响

- `release-publish.yml` 可以放心铺开到其余仓；薄壳文件名必须保持 `release.yml`，改名就会 404。
- 环境名同理：它是 claims 里的 `environment`，必须与 TP 上那个词逐字相同。
- **一个 404 不说明原因**：它同时覆盖「TP 不存在」「文件名不符」「环境名不符」「仓库不符」四种情况。
  所以共享流里保留那个失败时打印 claims 的步骤 —— 没有它，这三次尝试只能靠猜。
- dispatcher 此前**从来没有** TP，0.1.0 是手工用 token 发的（无 provenance）。这和 profile 表漏列、
  redlines 基线漏条目是同一类：**新仓出生时，几项必须人工完成的配置没有一个地方核**。
