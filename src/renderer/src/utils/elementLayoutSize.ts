import type { DesignElement } from '@renderer/types/design'

/**
 * 自画布根沿父链解析当前元素的「等效像素」宽高，供网格占位、子层网格模板等计算。
 * 百分比相对于每一层父级已解析出的边框盒尺寸；根级相对于设计表面尺寸。
 */
export function resolveElementLayoutPxBox(
  el: DesignElement,
  elements: DesignElement[],
  surface: { width: number; height: number }
): { width: number; height: number } {
  const chain: DesignElement[] = []
  let cur: DesignElement | undefined = el
  while (cur) {
    chain.unshift(cur)
    cur = cur.parentId ? elements.find((e) => e.id === cur!.parentId) : undefined
  }
  let cw = Math.max(1, surface.width)
  let ch = Math.max(1, surface.height)
  for (const node of chain) {
    const rw = node.widthIsPercent ? (cw * node.width) / 100 : node.width
    const rh = node.heightIsPercent ? (ch * node.height) / 100 : node.height
    if (node.id === el.id) {
      return {
        width: Math.max(1, rw),
        height: Math.max(1, rh)
      }
    }
    cw = Math.max(1, rw)
    ch = Math.max(1, rh)
  }
  return { width: Math.max(1, el.width), height: Math.max(1, el.height) }
}

/** 设计器 / 导出 CSS 的 width、height 字符串 */
export function cssWidthHeightStrings(el: DesignElement): { width: string; height: string } {
  return {
    width: el.widthIsPercent ? `${el.width}%` : `${el.width}px`,
    height: el.heightIsPercent ? `${el.height}%` : `${el.height}px`
  }
}
