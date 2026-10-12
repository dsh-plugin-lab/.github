/**
 * 浏览器半边入口。
 *
 * 产物由构建脚本打成宿主客户端模块系统要的 lazy-CJS factory 信封
 * （`window.__ModuleLoader__.load({ id, factory })`，id 等于包名）。
 * 所以这里写正常的 ESM + JSX，信封是构建期的事。
 *
 * **工厂体里不要有副作用**：样式、定时器、监听器一律在 `apply` 里用
 * `ctx.effect` / `ctx.on` 注册并返回清理函数。
 *
 * 这里的上下文类型是**手写的结构类型**，不是从宿主包 import 来的 ——
 * 骨架必须能独立编译，不能因为少一行类型增强就红。接上真的宿主类型后替换掉它。
 */

import { dictionaryFor, type LocaleKey, NS } from './locales.ts'

/** 本插件需要的客户端服务。只用 slots 就只写 slots —— 声明了却不用的服务会让启动顺序无谓变复杂。 */
export const inject = ['slots']

/** 宿主暴露给本插件的那一小块面。接上真类型后删掉这个别名。 */
type ClientContext = {
  locale?: { language?: string }
  slots: {
    inject(name: string, callback: () => unknown): unknown
    register(options: { name: string; id: string; order?: number }, component: unknown): unknown
  }
}

/** 本插件占用的 slot。换 slot 时要同步改这里与 `package.json` 的 `dsh.client.inject`。 */
const SLOT = 'conversation.composer.dock'

export function apply(ctx: ClientContext): void {
  // 词典在 apply 期取一次。**真的组件要订阅语言变化服务**（切换语言时重新取），
  // 骨架先不做这一步：它现在只有一个常量词条，订阅与否都看不出差别。
  const text = dictionaryFor(ctx.locale?.language ?? 'en')
  ctx.slots.inject(SLOT, () =>
    ctx.slots.register({ name: SLOT, id: '{{name}}', order: 5 }, () => Marker(text)),
  )
}

/**
 * 骨架里唯一的可见物：一个不抢版面的小圆点。
 *
 * 它的可访问名走词典 —— 界面文字过词典这条规矩从第一行代码起就成立，先立规矩再长内容。
 * 用 `currentColor` 而不是写死颜色：容器会继承宿主主题。
 */
function Marker(text: Record<LocaleKey, string>) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={16}
      height={16}
      role="img"
      aria-label={text['marker.label']}
      style={{ display: 'block', pointerEvents: 'none' }}
    >
      <circle cx={32} cy={32} r={24} fill="currentColor" />
    </svg>
  )
}

/** 词典命名空间即包名 —— 与 slot 注册项上的 `locale` 字段是同一个值。 */
export { NS }
