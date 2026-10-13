# pre-commit 说「文件被钩子改了」= 钩子修好了，不是它搞破坏

**状态**：生效
**类型**：依据（实测）

## 背景

在 Windows 上给插件仓手搓小文件（如 `screenshots.json`）后提交，pre-commit 的
`prettier --write` 报 `files were modified by this hook` 并中止提交。这现象容易被
误判成「Windows 上行尾乱套、prettier 写 CRLF、和 git 打架」。

## 实测结论

prettier **3.x 的 `endOfLine` 默认就是 `lf`**，Windows 上也一样，真实 stdout 无 CR。
对照实验（prettier 3.9.9，本机 Windows）：

| 输入 | `--check` |
|---|---|
| LF + **无结尾换行** | 失败 |
| LF + 有结尾换行 | 通过 |
| CRLF | 失败 |

唯一变量是**结尾换行**：`.gitattributes` 的 `* text=auto eol=lf` 已是契约，
手写文件漏了结尾换行（或混入 CRLF）就会被 pre-commit 拦下。

顺带记一次本机探针的坑：PowerShell 的 `Out-String` 按平台换行拼接管道输出，会把
LF 显示成 CRLF。用 `cmd /c "... > file"` 直接重定向再数字节，才看得到 prettier 的
真实输出。

## 影响

- 遇到该提示，**正确处置是让钩子跑完、`git add` 再提交一次**，不是怀疑钩子、更不是
  `core.hooksPath=/dev/null` 绕开它。
- 不需要给 `.prettierrc.json` 加 `endOfLine: "lf"` —— 那是 prettier 的默认值，写上等于一条
  没人验证的冗余规则。
- 手搓 JSON 这类小文件，提交前让 prettier 过一遍，少踩这类窝。

## 影响面

四个插件仓（zhihu / balance / wbb / debugging）都钉在 `prettier: ^3.9.9`，
`.gitattributes` 统一 `eol=lf`，行为一致。
