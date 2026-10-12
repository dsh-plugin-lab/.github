# 依据：并集声明下安装器按 latest 选族（2026-10-12）

状态：生效

**类型**：依据（实测）。

## 背景

换线巡检首跑报"换到 `next` 线之后，树没有落在 `next` 线上"。要判定这属于**宿主不兼容**
还是**解析规则**——两者的处置完全不同。

## 结论

声明面是**若干族的并集**（`||` 分隔）时，安装器**不按 `semver.maxSatisfying` 选最高的那族**：
`latest` dist-tag 指向的版本若能满足该并集，安装器就用 `latest`；只有 `latest` 不满足时，
才回落到 `maxSatisfying`。

- **npm 与 pnpm 行为一致** —— 不是某个包管理器的差异。
- 实测（同一次 install）：20 个包（`latest` = `0.0.1-rc.x`，不满足并集）落在高族，
  1 个包（`latest` 恰好在低族内）落在低族 → 装出**混合树**。
- 对照：把区间收窄成单族（`^0.2.0-rc.2`）后，实装即落在该族。
- 无 `deprecated` / `engines` 拦截；两族的 `peerDependencies` 完全相同。

**结论**：不能用 semver 推断安装器的选择。首次实例见姊妹仓 `dsh-workbuddy-bridge` 的
`.agents/notes/2026-10-12-installer-picks-latest-family.md`（当地事故记录）。

## 支撑的决策

[决策：compat 收窄只服务装与核对，跑测试前还原清单](2026-10-12-narrowing-and-redlines.md)
—— "测任何一族都要收窄"这条判据的机制依据。

## 影响

- **同一个洞仍在**：任何 `latest` 落在声明族内的包都会踩。三仓现在没踩，是各包 `latest`
  恰好是 `0.0.1-rc.x`（不满足并集）——**包集合的运气，不是设计上的保证**。宿主若把某个包的
  `latest` 推到声明族内，所有仓同时踩。
- 将来若在使用者侧（例如 `autoInstallPeers: true` 的 profile）遇到"装出来的宿主版本与声明
  不符"，先回这条记录，不要从宿主兼容性查起。
- 只影响**开发侧**：出问题的包在插件仓是 devDependencies（不在 `peer`、不在 `dependencies`、
  产物里零命中）；使用者的 profile 由宿主提供 peer，不经插件的依赖声明解析。
