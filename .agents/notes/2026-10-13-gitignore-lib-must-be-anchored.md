# `.gitignore` 的 `lib/` 必须锚定成 `/lib/`

**状态**：生效（2026-10-13 修模板）
**类型**：缺陷修复 + 判据
**落点**：[`templates/plugin/_common/.gitignore`](../../templates/plugin/_common/.gitignore)

## 现象

模板里写的是**裸 `lib/`**（想忽略构建产物目录）。gitignore 的规则是：**只有开头或中间带分隔符时，
模式才相对该 .gitignore 所在目录**；末尾的斜杠只表示「这是个目录」，**不带锚定作用**。
于是裸 `lib/` 匹配**任意深度**的 `lib` 目录 —— 包括 **`src/lib/`**。

而本模板铺出来的结构里，`src/lib/` 是**源码**目录（`src/lib/**` 放纯逻辑，可直接单测）。
后果不是报错，而是**静默**：

- `npm run check` 本机全绿（文件就在磁盘上）；
- `git ls-files` 里**没有**这些文件；
- **CI 克隆下来直接缺文件** —— 「本机绿、CI 红」最难归因的一类。

## 实证（一个新仓上真实命中）

`dsh-plugin-debugging` 按本模板铺出来、写完实现后：

```
git check-ignore -v src/lib/http.ts
→ .gitignore:5:lib/    src/lib/http.ts
```

12 个源码文件从未进入版本控制。修成 `/lib/` 后 `git ls-files src` 立刻变成 22 个文件。

## 为什么算组织仓的事

这不是某个仓的写法问题：**任何把源码放在 `src/lib/` 的新仓都会中招**，而模板正是它的来源。
按「seed 不是 sync」，修模板**不会**回写已铺出的仓 —— 但至少新仓不再带这个坑。

## 处置

1. 模板 `_common/.gitignore` 的 `lib/` 改成 **`/lib/`**，并加注释说明为什么必须锚定。（已做）
2. **`_npm-tsc` / `_pnpm-tsdown` 的 `.prettierignore` 不动** —— 它们也写着 `lib/`，但实测
   prettier **不会**因此忽略 `src/lib/`（`npx prettier --check src/lib` 全过）；更重要的是它们是
   **逐字相同件**（`scripts/scaffold.mjs` 的 `IDENTITY_FILES`），改一个字节就会让
   三个已存在的仓 + 所有新仓在 `scaffold check` 里报 `DIFF`。**不改。**
3. 已铺出的仓不回写（seed 不是 sync），但要**各自自检一次**：
   `git status --ignored --porcelain` 看被忽略的到底有哪些 —— 出现 `src/lib/` 之类的源码目录
   就是中了同一个坑。
