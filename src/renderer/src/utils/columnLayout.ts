/**
 * Column 子块：高度为 父容器高度 / 子元素数量（与 CSS flex 均分或 calc(100% / n) 一致）。
 */
export function computeColumnChildHeights(containerHeight: number, childCount: number): number[] {
  const count = Math.max(1, Math.floor(childCount) || 1)
  const h = Math.max(1, containerHeight)
  const each = h / count
  return Array.from({ length: count }, () => each)
}
