import type { DesignElement, LayoutMode } from '@renderer/types/design'

/**
 * Grid：居中需要「网格区域」大于元素盒。水平居中则跨满父网格列（1 / -1），垂直居中则跨满行；
 * 再配合父级容器的 place-items:center（见 DesignArea / children-layer）与子项 place-self/justify-self。
 */
export function gridPlacementForElement(
  element: Pick<DesignElement, 'width' | 'height' | 'layoutCenterHorizontal' | 'layoutCenterVertical'>,
  relativeX: number,
  relativeY: number,
  gridSize: number
): { gridColumn: string; gridRow: string } {
  const col = Math.floor(relativeX / gridSize) + 1
  const row = Math.floor(relativeY / gridSize) + 1
  const colSpan = Math.max(1, Math.ceil(element.width / gridSize))
  const rowSpan = Math.max(1, Math.ceil(element.height / gridSize))
  const ch = element.layoutCenterHorizontal === true
  const cv = element.layoutCenterVertical === true
  return {
    gridColumn: ch ? '1 / -1' : `${col} / span ${colSpan}`,
    gridRow: cv ? '1 / -1' : `${row} / span ${rowSpan}`
  }
}

/** 设计器内联 style（absolute：要求在调用前已设置好 left/top 的 px） */
export function applyLayoutCenterToInlineStyle(
  style: Record<string, string>,
  element: DesignElement,
  layoutMode: LayoutMode
): void {
  const ch = element.layoutCenterHorizontal === true
  const cv = element.layoutCenterVertical === true
  if (!ch && !cv) return

  if (layoutMode === 'grid') {
    if (ch && cv) {
      style.placeSelf = 'center'
      return
    }
    if (ch) style.justifySelf = 'center'
    if (cv) style.alignSelf = 'center'
    return
  }

  if (ch && cv) {
    style.left = '50%'
    style.top = '50%'
    style.transform = 'translate(-50%, -50%)'
    return
  }
  if (ch) {
    style.left = '50%'
    style.transform = 'translateX(-50%)'
    return
  }
  style.top = '50%'
  style.transform = 'translateY(-50%)'
}

/** 导出 CSS：absolute 模式下的定位行（含 left/top/transform） */
export function layoutCenterCssForAbsolute(element: DesignElement, relativeX: number, relativeY: number): string[] {
  const ch = element.layoutCenterHorizontal === true
  const cv = element.layoutCenterVertical === true
  if (!ch && !cv) {
    return [`  left: ${relativeX}px;`, `  top: ${relativeY}px;`]
  }
  if (ch && cv) {
    return ['  left: 50%;', '  top: 50%;', '  transform: translate(-50%, -50%);']
  }
  if (ch) {
    return ['  left: 50%;', `  top: ${relativeY}px;`, '  transform: translateX(-50%);']
  }
  return [`  left: ${relativeX}px;`, '  top: 50%;', '  transform: translateY(-50%);']
}

/** 导出 CSS：grid 子项在扩展后的网格区域内的对齐 */
export function layoutCenterCssForGrid(element: DesignElement): string[] {
  const ch = element.layoutCenterHorizontal === true
  const cv = element.layoutCenterVertical === true
  if (!ch && !cv) return []
  if (ch && cv) return ['  place-self: center;']
  if (ch) return ['  justify-self: center;']
  return ['  align-self: center;']
}
