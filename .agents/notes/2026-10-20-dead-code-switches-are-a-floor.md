# 决策：四个死代码开关是下限，档位升为 Must agree（2026-10-20）

状态：生效

**类型**：决策。

## 问题

判据里有一行长期对不上事实：

> The four compiler switches and ESLint each own their layer | **Should agree** | redlines per repository guard that the switches exist; the switch values stay in `tsconfig.json`, tool parameters are per repository

两个毛病：

1. **第三列描述的是当时没有的机制。** 它说「各仓红线断言开关存在」，实测四个仓里只有两个仓有这条红线
   （`dsh-ds-balance`、`dsh-zhihu-search`）；`dsh-workbuddy-bridge` 与 `dsh-plugin-debugging` 没有 ——
   那三个开关被谁删掉时，没有任何东西会红。
2. **档位比规则的严格程度松。** 「四个开关都在」是各仓一致的事实，不是各仓自定的参数，
   `Should agree`（参数各仓自定）描述不了它。

## 实测

`tsconfig.json` 逐项（2026-10-20）：

| 仓 | noUnusedLocals | noUnusedParameters | noImplicitReturns | noFallthroughCasesInSwitch |
|---|:--:|:--:|:--:|:--:|
| `dsh-ds-balance` | true | true | true | true |
| `dsh-zhihu-search` | true | true | true | true |
| `dsh-workbuddy-bridge` | true | true | **缺失** | true |
| `dsh-plugin-debugging` | true | true | true | true |

给 `dsh-workbuddy-bridge` 补 `noImplicitReturns` 后 `tsc --noEmit` 零报错、`pnpm run check` 全绿。

## 决策

**判据那一行升为 `Must agree`，并收窄成「下限」语义**：

- 下限是四个死代码开关：`noUnusedLocals`、`noUnusedParameters`、`noImplicitReturns`、
  `noFallthroughCasesInSwitch`
- **上限各仓自定** —— 仓想多开什么是它自己的事，判据不锁清单
- `strict` 那一族**不在本条**，它自成一节（「TypeScript's strict switches」，仍是 `Should agree`）

为什么是「下限」而不是「四仓必须一模一样」：四仓现在没有一个是恰好四个开关的
（`dsh-workbuddy-bridge` 六个、`dsh-plugin-debugging` 五个），要求逐字相同会把已经更严的仓压回更松。
「下限一致」既让 `Must agree` 有真实含义，又不惩罚多开。

## 替代方案

**A. 只补断言、不改档位。** 四仓都写上红线，`Should agree` 原样留着。
否：规则仍说「参数各仓自定」，而实际四仓都有这四个 —— 规则比事实松，将来新仓可以合法地不写。

**B. 只改档位、不收窄措辞。** 把 `Should agree` 改成 `Must agree`，正文不动。
否：正文说的是「the four compiler switches」，而四仓里没有一仓恰好是四个 —— 判据会变成一句
谁都不满足的话，比现在更糟。

**C. 逐个开关对齐，四个仓的 `tsconfig.json` 写成完全相同的开关清单。**
否：会削掉 `dsh-workbuddy-bridge` 的 `exactOptionalPropertyTypes` / `noImplicitOverride` /
`noUncheckedIndexedAccess`，以及 `dsh-plugin-debugging` 的 `noImplicitReturns` 之外的项 ——
为了统一而降低已有标准，是这条判据最不该有的效果。

**D. 把 `strict` 也纳入这四（五）个开关。** 否：`strict` 是**一族**开关的别名（`strictNullChecks`、
`strictFunctionTypes` 等各自可单独开关），与这四个「各自独立、互不蕴含」的死代码开关不是一类；
它已有自己的一行，混进来会让那行走不到。

**选 A+B 的组合形式**：改档位（解决 B 的问题）并把清单收窄成四个下限（解决 C 的问题）。

## 执行体：两层，各有各的失效场景

| 层 | 谁跑 | 拦什么 |
|---|---|---|
| 各仓红线断言 | 每次 PR / push | 改这个仓的那一次 |
| 本仓 `check-criteria.mjs` 的 `dead-code-switches` | 每周 + 手动 | 某个仓的红线被删掉、或新仓没写 |

第二层不是多余的：第一层失效时（红线被删），只有第二层会说话。

## 一个不显而易见的判据细节：`extends`

`tsconfig*.json` 不一定各自是独立清单：

| 仓 | client / test 是否 extends 根 |
|---|---|
| `dsh-ds-balance` / `dsh-zhihu-search` / `dsh-plugin-debugging` | 是（一处生效，覆盖三个 project） |
| `dsh-workbuddy-bridge` | **否** —— client 是第二份独立清单 |

所以机检不能只读 `tsconfig.json`：那样 `dsh-workbuddy-bridge` 的客户端半边没人看着，而检查报绿。
规则改成「**只判不 extends 的配置**」—— 继承了的那份由它继承的那份回答，要求重复只是要求噪音。

## 验证为什么必须离开网络

本仓的机检读 `raw.githubusercontent.com`，读的是**已推送**版本。所以「在本地把一个开关改坏，
看检查是否变红」什么也证明不了 —— 它看的是远端。第一次就是这么验的，得到假绿。

正确做法是把判断抽成纯函数 `scripts/lib/tsconfig-floor.mjs`，用 `node --test` 直接喂坏配置：

- 覆盖 `dsh-workbuddy-bridge` 那种「两份独立清单、client 少一个」的形状
- 覆盖「全部 extends」—— 此时什么都没判，必须报「no standalone list was found to judge」
  而不是空问题列表（空列表与通过无法区分，这正是本条的存在理由）
- 变异验证：把开关清单改成空数组 → 3 个用例红；去掉 `extends` 跳过 → 2 个用例红

## 影响

- 判据中英两份各一行改写，`Should agree` 从 4 条降到 3 条
- 四个插件仓各一条红线断言；`dsh-workbuddy-bridge` 另补 `noImplicitReturns`
- 本仓 `scripts/check-criteria.mjs` 新增第 14 条机检，`scripts/lib/tsconfig-floor.mjs` 承载判断，
  `scripts/test/tsconfig-floor.test.mjs` 守住它
