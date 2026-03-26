import type { DesignElement } from '@renderer/types/design'

export type BorderSide = 'top' | 'right' | 'bottom' | 'left'

export type ElementBorderConfig = Pick<
  DesignElement,
  | 'borderWidth'
  | 'borderStyle'
  | 'borderColor'
  | 'borderTop'
  | 'borderRight'
  | 'borderBottom'
  | 'borderLeft'
>

const SIDE_PROPS: Record<BorderSide, keyof ElementBorderConfig> = {
  top: 'borderTop',
  right: 'borderRight',
  bottom: 'borderBottom',
  left: 'borderLeft'
}

export function isBorderSideEnabled(element: ElementBorderConfig, side: BorderSide): boolean {
  const key = SIDE_PROPS[side]
  return element[key] !== false
}

/** 将盒状边框写入 style 对象（可与圆角等共存）；未开启的边为 none */
export function applyBoxBorderToStyle(
  target: Record<string, string>,
  element: ElementBorderConfig
): void {
  const width = element.borderWidth
  const style = element.borderStyle
  if (!width || !style || style === 'none') return

  const color = element.borderColor || '#000'
  const segment = `${width}px ${style} ${color}`
  const sides: BorderSide[] = ['top', 'right', 'bottom', 'left']

  for (const side of sides) {
    const cssKey = `border${side[0].toUpperCase()}${side.slice(1)}`
    target[cssKey] = isBorderSideEnabled(element, side) ? segment : 'none'
  }
}

/** 生成 CSS 声明行（每行带缩进前缀，如 "  "） */
export function boxBorderCssLines(element: ElementBorderConfig, indent = '  '): string[] {
  const width = element.borderWidth
  const style = element.borderStyle
  if (!width || !style || style === 'none') return []

  const color = element.borderColor || '#000'
  const segment = `${width}px ${style} ${color}`
  const sides: BorderSide[] = ['top', 'right', 'bottom', 'left']
  return sides.map((side) => {
    const cssProp = `border-${side}`
    const value = isBorderSideEnabled(element, side) ? segment : 'none'
    return `${indent}${cssProp}: ${value};`
  })
}
