import type { DesignElement } from '@renderer/types/design'
import { effectivePaddingInsets } from '@renderer/utils/elementSpacing'

/** 将子元素左上角（画布绝对坐标）限制在宿主内容区（含 padding 内缘）内 */
export function clampAbsTopLeftInsideParentContent(
  host: DesignElement,
  childW: number,
  childH: number,
  desiredAbsLeft: number,
  desiredAbsTop: number,
  snap: (n: number) => number
): { x: number; y: number } {
  const pad = effectivePaddingInsets(host)
  const L = host.x + pad.left
  const T = host.y + pad.top
  const innerR = host.x + host.width - pad.right
  const innerB = host.y + host.height - pad.bottom
  const maxLeft = Math.max(L, innerR - childW)
  const maxTop = Math.max(T, innerB - childH)
  return {
    x: snap(Math.min(maxLeft, Math.max(L, desiredAbsLeft))),
    y: snap(Math.min(maxTop, Math.max(T, desiredAbsTop)))
  }
}
