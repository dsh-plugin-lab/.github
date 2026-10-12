# 徽章模板（存放用，不是活件）

来源：`dsh-badge` 技能（官方件）+ 三仓门面的统一形态。`<URL>` 一律不用，裸 URL 不用，写法只用 `[]()` 或 HTML `<a><img></a>`。

## 官方：powered by dsh

```markdown
[![](https://img.shields.io/badge/powered_by-dsh-4D6BFE?style=flat&logo=deepseek&logoColor=white)](https://github.com/deepseek-ai/deepseek-harness)
```

不链接版：

```markdown
![](https://img.shields.io/badge/powered_by-dsh-4D6BFE?style=flat&logo=deepseek&logoColor=white)
```

HTML 版（README 徽章排里用这个，`<p>` 块内 Markdown 不解析）：

```html
<a href="https://github.com/deepseek-ai/deepseek-harness"><img src="https://img.shields.io/badge/powered_by-dsh-4D6BFE?style=flat&logo=deepseek&logoColor=white" alt="powered by dsh"></a>
```

本地 PNG（飞书等远程图导入不稳的系统）：`dsh-badge.png`（726×120，渲染 121×20）。颜色、logo、文案、项目链接、`style` 都不许改。

## 通用：任意静态徽章

shields 静态徽章四段式：`badge/<左半>-<右半>-<色>`，参数跟在 `?` 后，多个用 `&`。

Markdown：

```markdown
[![<alt>](https://img.shields.io/badge/<左半>-<右半>-<色>?style=flat&logo=<logo>&logoColor=white)](<链接目标>)
```

HTML：

```html
<a href="<链接目标>"><img src="https://img.shields.io/badge/<左半>-<右半>-<色>?style=flat&logo=<logo>&logoColor=white" alt="<alt>"></a>
```

取值见 <https://shields.io/badges/static-badge>。本组织约定：`style=flat`（显式写出，不靠默认值）。

## 通用：动态徽章

版本号（npm）：

```markdown
[![npm](https://img.shields.io/npm/v/<包名>.svg?style=flat)](https://www.npmjs.com/package/<包名>)
```

CI（GitHub 自己的徽章，**不认 `style`**，形状改不了）：

```html
<a href="https://github.com/<owner>/<repo>/actions/workflows/<workflow>.yml"><img src="https://github.com/<owner>/<repo>/actions/workflows/<workflow>.yml/badge.svg" alt="CI"></a>
```

构建级别（SLSA，前提是 `npm publish --provenance`）：

```html
<a href="https://www.npmjs.com/package/<包名>"><img src="https://img.shields.io/badge/SLSA-Build%20L2-green?logo=slsa&style=flat" alt="SLSA Build L2"></a>
```

## 门面排（整块骨架）

```html
<p>
  <!-- 归属排：平台徽章 + powered-by-dsh -->
</p>

<p>
  <!-- 状态排：CI → npm → License → SLSA（有则挂） -->
</p>

<p>
  <!-- Releases 行：各版本改动 → Releases（与 npm 版本一一对应） -->
</p>
```

## 规则

- 同仓文件 → 相对路径；跨仓（同组织或外部）→ 绝对 URL；一律 `[]()`，不用 `<URL>`、不用裸 URL。
- 渲染在组织主页上的文件（`profile/`）是例外：那里的链接必须绝对 URL。
- `alt` 跟随所在文档的语言；徽章**图上文字**是固定件，不翻译。
- CI 徽章是 GitHub 自己画的，`style` 参数无效 —— 别写。
