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

const cmpYxSerial = (a: DesignElement, b: DesignElement): number =>
  a.y - b.y || a.x - b.x || a.serial - b.serial

const sortByLayer = (list: DesignElement[]): DesignElement[] => [...list].sort(cmpYxSerial)

/**
 * 同父级子节点在模板中的顺序，与画布绝对坐标一致。
 * flex row/column：先按 y（排“行”）再按 x（同排左右由点击位置决定）。
 */
export function sortSiblingsForRenderOrder(
  elements: DesignElement[],
  parentId: string | null
): DesignElement[] {
  const list = elements.filter((item) => item.parentId === parentId)
  if (list.length <= 1) return list
  if (parentId === null) return sortByLayer(list)

  const parent = elements.find((e) => e.id === parentId)
  if (!parent) return sortByLayer(list)

  if (parent.kind === 'image' && parent.type === 'div') {
    return [...list].sort((a, b) => a.x - b.x || a.y - b.y || a.serial - b.serial)
  }
  if (parent.kind === 'column') {
    return [...list].sort(cmpYxSerial)
  }
  if (parent.flexLayoutEnabled) {
    const dir = parent.flexDirection ?? 'row'
    switch (dir) {
      case 'row':
      case 'column':
        return [...list].sort(cmpYxSerial)
      case 'row-reverse':
        return [...list].sort((a, b) => {
          const dy = a.y - b.y
          if (dy !== 0) return dy
          const dx = b.x - a.x
          if (dx !== 0) return dx
          return a.serial - b.serial
        })
      case 'column-reverse':
        return [...list].sort((a, b) => {
          const dy = b.y - a.y
          if (dy !== 0) return dy
          const dx = a.x - b.x
          if (dx !== 0) return dx
          return a.serial - b.serial
        })
      default:
        return sortByLayer(list)
    }
  }
  if (parent.gridLayoutForChildren) {
    return [...list].sort(cmpYxSerial)
  }
  return sortByLayer(list)
}

/**
 * 与画布视觉一致：沿 flex 主轴更靠近 main-start 的一侧，在 sortSiblingsForRenderOrder 中的下标步进（±1）。
 * towardMainStart：row 为「更靠左」、column 为「更靠上」（row-reverse/column-reverse 已镜像）。
 */
export function flexVisualMainAxisNeighborDelta(
  flexDirection: DesignElement['flexDirection'] | undefined,
  towardMainStart: boolean
): number {
  const dir = flexDirection ?? 'row'
  const reversed = dir === 'row-reverse' || dir === 'column-reverse'
  if (!reversed) return towardMainStart ? -1 : 1
  return towardMainStart ? 1 : -1
}
