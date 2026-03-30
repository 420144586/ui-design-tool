import type { DesignElement } from '@renderer/types/design'

export function applyFlexContainerToStyle(style: Record<string, string>, el: DesignElement): void {
  if (!el.flexLayoutEnabled) return
  const dir = el.flexDirection ?? 'row'
  const wrap = el.flexWrap ?? 'nowrap'
  const jc = el.justifyContent ?? 'flex-start'
  const ai = el.alignItems ?? 'stretch'
  const ac = el.alignContent ?? 'stretch'
  const gap = el.flexGap ?? 0
  style.display = 'flex'
  style.flexDirection = dir
  style.flexWrap = wrap
  style.justifyContent = jc
  style.alignItems = ai
  if (wrap !== 'nowrap') {
    style.alignContent = ac
  }
  style.gap = `${gap}px`
}

/** 生成与 applyFlexContainerToStyle 一致的 CSS 行（含缩进） */
export function flexContainerCssLines(el: DesignElement): string[] {
  if (!el.flexLayoutEnabled) return []
  const dir = el.flexDirection ?? 'row'
  const wrap = el.flexWrap ?? 'nowrap'
  const jc = el.justifyContent ?? 'flex-start'
  const ai = el.alignItems ?? 'stretch'
  const ac = el.alignContent ?? 'stretch'
  const gap = el.flexGap ?? 0
  const lines: string[] = [
    '  display: flex;',
    `  flex-direction: ${dir};`,
    `  flex-wrap: ${wrap};`,
    `  justify-content: ${jc};`,
    `  align-items: ${ai};`,
    `  gap: ${gap}px;`
  ]
  if (wrap !== 'nowrap') {
    lines.push(`  align-content: ${ac};`)
  }
  return lines
}
