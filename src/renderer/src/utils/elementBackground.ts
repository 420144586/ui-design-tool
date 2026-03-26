import type { DesignElement } from '@renderer/types/design'

/** 画布 / 导出 CSS 中实际使用的背景填充 */
export function cssBackgroundFill(
  element: Pick<DesignElement, 'background' | 'backgroundTransparent'>
): string {
  if (element.backgroundTransparent) return 'transparent'
  return element.background
}
