import type { DesignElement } from '@renderer/types/design'

/**
 * 元素导出用 **主 CSS class** 与内部 `id` 解耦：`id` 仍为设计器 data-element-id / 动画键等唯一标识。
 *
 * 客制化：在应用启动后调用 `setElementClassStrategy({ generate: (ctx) => 'my-' + ctx.element.serial })` 等。
 * 默认：`dt-{名称slug}-s{serial}`，画布壳固定 `dt-canvas-root`，表格单元格 `dt-tcell-r{r}-c{c}-s{serial}`。
 *
 * **复制**：`duplicateSelectedElement` 会向新元素写入与源一致的 `elementDomClass(源)`，不再按新 serial 重算，故导出 class 相同。
 * 新建元素若 `addElement` 传入的 payload 已带非空 `domClass`，也会保留而不覆盖。
 */
export interface ElementClassContext {
  readonly element: DesignElement
}

export interface ElementClassStrategy {
  generate(ctx: ElementClassContext): string
}

/** 得到合法 CSS 类名片段：小写、连字符、字母数字与下划线；最长 64。 */
export function sanitizeCssClassToken(raw: string): string {
  let s = raw
    .trim()
    .toLowerCase()
    .replace(/[\s.]+/g, '-')
    .replace(/[^a-z0-9_-]/g, '')
    .replace(/^-+|-+$/g, '')
    .replace(/--+/g, '-')
  if (s.length > 64) s = s.slice(0, 64).replace(/-+$/, '')
  if (!s.length) return ''
  if (/^[0-9]/.test(s)) s = `n-${s}`
  return s
}

function slugFromElementName(name: string): string {
  return sanitizeCssClassToken(name)
}

function defaultGenerate(ctx: ElementClassContext): string {
  const el = ctx.element
  const serial = el.serial
  if (el.isFlexPageShell) return 'dt-canvas-root'
  if (el.isTableCell) {
    const r = el.tableCellRow ?? 0
    const c = el.tableCellCol ?? 0
    return `dt-tcell-r${r}-c${c}-s${serial}`
  }
  if (el.kind === 'image' && el.type === 'img') {
    const slug = slugFromElementName(el.name) || 'img'
    return `dt-${slug}-s${serial}`.replace(/--+/g, '-')
  }
  if (el.kind === 'dcomponent') {
    const key = (el.componentKey ?? 'dc').replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'dc'
    const slug = slugFromElementName(el.name) || key
    return `dt-${key}-${slug}-s${serial}`.replace(/--+/g, '-').slice(0, 80)
  }
  if (el.kind === 'table') {
    const slug = slugFromElementName(el.name) || 'table'
    return `dt-${slug}-s${serial}`.replace(/--+/g, '-')
  }
  if (el.kind === 'column') {
    const slug = slugFromElementName(el.name) || 'column'
    return `dt-${slug}-s${serial}`.replace(/--+/g, '-')
  }
  const slug = slugFromElementName(el.name) || String(el.kind)
  return `dt-${slug}-s${serial}`.replace(/--+/g, '-')
}

let activeStrategy: ElementClassStrategy = {
  generate: defaultGenerate
}

export function getElementClassStrategy(): ElementClassStrategy {
  return activeStrategy
}

/** 替换默认策略（可改为从远程配置加载、按项目前缀命名等） */
export function setElementClassStrategy(strategy: ElementClassStrategy): void {
  activeStrategy = strategy
}

export function generateElementDomClass(ctx: ElementClassContext): string {
  return activeStrategy.generate(ctx)
}

/**
 * 模板与 CSS 主选择器：非空 domClass 优先；
 * 显式清空 `domClass === ''` 时用当前策略重新计算；
 * 未设置过 domClass 的旧数据仍用 id，避免打开旧稿后类名大变。
 */
export function elementDomClass(el: DesignElement): string {
  if (el.domClass !== undefined && el.domClass !== null) {
    const t = el.domClass.trim()
    if (t) return t
    return generateElementDomClass({ element: el })
  }
  return el.id
}
