import type { DesignElement } from '@renderer/types/design'

type DropStoreSlice = {
  elements: DesignElement[]
}

/** 指针是否落在该设计节点对应 DOM 盒内（与 Flex 视觉排版一致，不依赖数据 x/y 是否已同步） */
export function pointInElementDataBox(clientX: number, clientY: number, elementId: string): boolean {
  const dom = document.querySelector(
    `[data-element-id="${CSS.escape(elementId)}"]`
  ) as HTMLElement | null
  if (!dom) return false
  const r = dom.getBoundingClientRect()
  return (
    clientX >= r.left &&
    clientX <= r.right &&
    clientY >= r.top &&
    clientY <= r.bottom
  )
}

/**
 * 指针落在开启了 Flex 的父级区域内，但不落在任一 flex 子项的 border 盒内时（间隙、padding 等），
 * 返回该 flex 父级 id。
 *
 * 若命中节点本身是 flex 容器：落点在其子项盒内则返回 null（交给当前 hitId，与 pass-through 配合）；
 * 若落在容器空白/间隙/无子项则返回该容器 id。
 */
export function flexParentIfPointerOutsideAllFlexChildren(
  store: DropStoreSlice,
  clientX: number,
  clientY: number,
  fromId: string
): string | null {
  const hit = store.elements.find((e) => e.id === fromId)
  if (!hit) return null

  if (hit.flexLayoutEnabled) {
    const kids = store.elements.filter((e) => e.parentId === hit.id)
    for (const k of kids) {
      if (pointInElementDataBox(clientX, clientY, k.id)) return null
    }
    return hit.id
  }

  if (!hit.parentId) return null
  const parent = store.elements.find((e) => e.id === hit.parentId)
  if (!parent?.flexLayoutEnabled) return null
  const siblings = store.elements.filter((e) => e.parentId === parent.id)
  for (const k of siblings) {
    if (pointInElementDataBox(clientX, clientY, k.id)) return null
  }
  return parent.id
}

/** 嵌套 flex 时沿链上升，直到指针不再处于「仅外层 flex 间隙 / flex 容器空白区」中 */
export function resolveFlexContainerHitAscend(
  store: DropStoreSlice,
  clientX: number,
  clientY: number,
  hitId: string
): string {
  let id = hitId
  for (let i = 0; i < 32; i++) {
    const next = flexParentIfPointerOutsideAllFlexChildren(store, clientX, clientY, id)
    if (!next || next === id) break
    id = next
  }
  return id
}
