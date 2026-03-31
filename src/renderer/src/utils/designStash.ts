import type { CanvasConfig, DesignElement, LayoutMode } from '@renderer/types/design'
import { generatePreviewHtml } from '@renderer/utils/codegen'

const stashUid = (): string =>
  `stash-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`

const elUid = (): string => `el-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`

export function collectSubtreeIds(elements: DesignElement[], rootId: string): Set<string> {
  const ids = new Set<string>()
  const walk = (id: string): void => {
    ids.add(id)
    for (const e of elements) {
      if (e.parentId === id) walk(e.id)
    }
  }
  walk(rootId)
  return ids
}

export function extractSubtreeDeepCopy(
  elements: DesignElement[],
  rootId: string
): DesignElement[] {
  const ids = collectSubtreeIds(elements, rootId)
  return elements
    .filter((e) => ids.has(e.id))
    .map((e) => JSON.parse(JSON.stringify(e)) as DesignElement)
}

/** 将子树平移到左上角附近，便于生成小画布预览 */
export function normalizeSubtreeOrigin(copy: DesignElement[], rootId: string): void {
  const ids = collectSubtreeIds(copy, rootId)
  let minX = Infinity
  let minY = Infinity
  for (const e of copy) {
    if (!ids.has(e.id)) continue
    minX = Math.min(minX, e.x)
    minY = Math.min(minY, e.y)
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return
  const dx = -minX
  const dy = -minY
  for (const e of copy) {
    if (!ids.has(e.id)) continue
    e.x += dx
    e.y += dy
  }
}

export function subtreeBoundsMax(
  copy: DesignElement[],
  rootId: string
): { w: number; h: number } {
  const ids = collectSubtreeIds(copy, rootId)
  let maxR = 0
  let maxB = 0
  for (const e of copy) {
    if (!ids.has(e.id)) continue
    maxR = Math.max(maxR, e.x + e.width)
    maxB = Math.max(maxB, e.y + e.height)
  }
  return {
    w: Math.max(80, Math.ceil(maxR) + 16),
    h: Math.max(60, Math.ceil(maxB) + 16)
  }
}

export function buildStashPreviewSrcdoc(
  subtreeCopy: DesignElement[],
  rootId: string,
  layoutMode: LayoutMode,
  gridSize: number
): string {
  const copy = subtreeCopy.map((e) => JSON.parse(JSON.stringify(e)) as DesignElement)
  const root = copy.find((e) => e.id === rootId)
  if (!root) return ''
  root.parentId = null
  normalizeSubtreeOrigin(copy, rootId)
  const { w, h } = subtreeBoundsMax(copy, rootId)
  const canvas: Pick<CanvasConfig, 'width' | 'height' | 'gridSize'> = {
    width: w,
    height: h,
    gridSize
  }
  return generatePreviewHtml(copy, layoutMode, canvas)
}

/** 放入画布前重新分配 id，避免与现有节点冲突 */
export function remapSubtreeIds(
  subtree: DesignElement[],
  rootId: string
): { elements: DesignElement[]; newRootId: string } {
  const ids = collectSubtreeIds(subtree, rootId)
  const idMap = new Map<string, string>()
  for (const id of ids) {
    idMap.set(id, elUid())
  }
  const filtered = subtree.filter((e) => ids.has(e.id))
  const elements = filtered.map((e) => {
    const pid = e.parentId
    const newParentId =
      pid != null && ids.has(pid) ? (idMap.get(pid) as string) : null
    return {
      ...(JSON.parse(JSON.stringify(e)) as DesignElement),
      id: idMap.get(e.id) as string,
      parentId: newParentId
    }
  })
  return { elements, newRootId: idMap.get(rootId) as string }
}

export function newStashId(): string {
  return stashUid()
}
