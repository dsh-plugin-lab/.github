/**
 * 本地化词典。`zh` 是键集真源，`en` 用 `Record<LocaleKey, string>` 做编译期完整性检查。
 *
 * 界面上的**每一句**可见文字都要走这里，不在组件里写死字符串。理由很实在：
 * 词典是纯数据，测试能直接 import 它做键集对账；写死在组件里的字符串谁都数不清。
 */

/** 词典命名空间。必须与 slot 注册项上的 `locale` 字段一致。 */
export const NS = '{{name}}'

/** 中文词典（键集真源）。 */
export const zh = {
  'marker.label': '{{displayName}}',
} as const

/** 词典键。 */
export type LocaleKey = keyof typeof zh

/** 英文词典。缺键会在编译期报错。 */
export const en: Record<LocaleKey, string> = {
  'marker.label': '{{displayName}}',
}

/** 取词典。未知语言回落英文。 */
export function dictionaryFor(language: string): Record<LocaleKey, string> {
  return language.toLowerCase().startsWith('zh') ? zh : en
}

/**
 * 极简插值：把 `{name}` 换成实参，取不到的键原样留下（不抛错，也不吞掉）。
 *
 * `?? whole` 不是装饰：`noUncheckedIndexedAccess` 打开时索引访问的类型是
 * `string | undefined`，少了它这里就是 TS2769 —— 而那个开关在参考仓里是开着的
 * （各仓参数不同，模板必须两种配方都过）。
 */
export function interpolate(template: string, params: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? (params[name] ?? whole) : whole,
  )
}
