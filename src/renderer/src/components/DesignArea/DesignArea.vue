<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { useDesignStore } from '@renderer/store/design'
import type { DesignElement, ElementPreset } from '@renderer/types/design'
import { computeColumnChildHeights } from '@renderer/utils/columnLayout'
import { clampAbsTopLeftInsideParentContent } from '@renderer/utils/designChildPosition'
import { resolveFlexContainerHitAscend } from '@renderer/utils/designDropTarget'
import { canAddChildElements } from '@renderer/utils/designElementHost'
import { sortSiblingsForRenderOrder } from '@renderer/utils/elementFlex'
import DesignTreeNode from './DesignTreeNode.vue'
import ElementContextDrawer from './ElementContextDrawer.vue'

const props = withDefaults(
  defineProps<{
    /**
     * 为 false 时不在画布上应用 zoom（由外层整体缩放，例如虚拟环境下的设备框）。
     * 标准视图保持默认 true，对整个 canvas-wrap 应用缩放。
     */
    applyCanvasZoom?: boolean
    /** 嵌入虚拟设备：非「标准画布」场景，无网格线、无边框，仅作元素预览层 */
    embeddedVirtual?: boolean
  }>(),
  { applyCanvasZoom: true, embeddedVirtual: false }
)

const store = useDesignStore()
const canvasRef = ref<HTMLElement | null>(null)
/** 正在拖动的顶层节点 id（多选时为多个根） */
const movingRootIds = ref<string[]>([])
const dragStartCanvas = ref({ x: 0, y: 0 })
/** 拖动开始时各根节点的 x/y 快照 */
const initialRootLayout = ref<{ id: string; x: number; y: number }[]>([])
/** 用于判断是否发生拖动，避免纯点击也触发挂接询问 */
const movePointerStart = ref<{ x: number; y: number } | null>(null)
/** 拖放结束后吞掉紧随的一次 canvas click，防止误触发「从预设添加」 */
const suppressNextCanvasClick = ref(false)
/**
 * 已选中祖先时在子元素上按下会暂不切到子元素，以便拖动祖先；
 * 若松手时未构成拖动，再选中该子元素（纯点击仍能钻入子级）。
 */
const pendingDrillDownSelectId = ref<string | null>(null)

/** 右键插入子元素：宿主 id、锚点（画布坐标）、面板锚点（视口 css px） */
const childInsertContext = ref<{
  hostId: string
  canvasX: number
  canvasY: number
  panelX: number
  panelY: number
} | null>(null)

const DRAG_THRESHOLD_PX = 4

const finishPointerDrag = (event: MouseEvent): void => {
  window.removeEventListener('mousemove', onWindowPointerMove, true)
  window.removeEventListener('mouseup', finishPointerDrag, true)
  store.endLayoutDrag()
  const roots = [...movingRootIds.value]
  movingRootIds.value = []
  initialRootLayout.value = []

  if (roots.length === 0 || !movePointerStart.value) {
    movePointerStart.value = null
    pendingDrillDownSelectId.value = null
    return
  }

  const dragged =
    Math.abs(event.clientX - movePointerStart.value.x) > DRAG_THRESHOLD_PX ||
    Math.abs(event.clientY - movePointerStart.value.y) > DRAG_THRESHOLD_PX
  movePointerStart.value = null

  /** 松手时始终夹回设计表面内（拖动中允许暂时越界以便拖回） */
  const W = store.designSurfaceWidth
  const H = store.designSurfaceHeight
  for (const rid of roots) {
    const el = store.elements.find((e) => e.id === rid)
    if (!el) continue
    const nx = Math.min(Math.max(0, el.x), Math.max(0, W - el.width))
    const ny = Math.min(Math.max(0, el.y), Math.max(0, H - el.height))
    if (nx !== el.x || ny !== el.y) {
      store.updateElement(rid, { x: nx, y: ny }, { skipHistory: true })
    }
  }

  if (!dragged) {
    const pending = pendingDrillDownSelectId.value
    pendingDrillDownSelectId.value = null
    if (pending) {
      store.selectElement(pending)
    }
    return
  }

  pendingDrillDownSelectId.value = null

  suppressNextCanvasClick.value = true

  const movedSet = new Set(roots)

  const stack = document.elementsFromPoint(event.clientX, event.clientY)
  let dropTargetId: string | null = null
  for (const node of stack) {
    if (!(node instanceof HTMLElement)) continue
    const id = node.dataset.elementId
    if (!id || movedSet.has(id)) continue
    const el = store.elements.find((item) => item.id === id)
    if (!el) continue
    if (el.kind === 'table') continue
    let invalid = false
    for (const r of roots) {
      if (store.isDescendantOf(r, id)) {
        invalid = true
        break
      }
    }
    if (invalid) continue
    dropTargetId = id
    break
  }

  if (!dropTargetId) return

  const resolved = resolveFlexContainerHitAscend(store, event.clientX, event.clientY, dropTargetId)
  if (!movedSet.has(resolved)) {
    let invalidResolved = false
    for (const r of roots) {
      if (store.isDescendantOf(r, resolved)) {
        invalidResolved = true
        break
      }
    }
    if (!invalidResolved) dropTargetId = resolved
  }
  if (roots.every((rid) => store.elements.find((e) => e.id === rid)?.parentId === dropTargetId)) {
    return
  }

  const msg =
    roots.length === 1
      ? '是否将此元素作为子元素加入？'
      : `是否将选中的 ${roots.length} 个元素作为子元素加入？`
  if (window.confirm(msg)) {
    store.reparentElements(roots, dropTargetId)
  }
}

const gridBackground = computed(() => {
  const size = store.canvas.gridSize
  return {
    '--grid-size': `${size}px`
  }
})

const layerStyle = computed(() => {
  if (store.canvas.layoutMode === 'grid') {
    return {
      display: 'grid',
      /** 与子项 grid 占位（含 1/-1 跨满）配合，使 place-self/justify-self 在可视区域内生效 */
      placeItems: 'center',
      gridTemplateColumns: `repeat(${Math.max(1, Math.floor(store.designSurfaceWidth / store.canvas.gridSize))}, ${store.canvas.gridSize}px)`,
      gridTemplateRows: `repeat(${Math.max(1, Math.floor(store.designSurfaceHeight / store.canvas.gridSize))}, ${store.canvas.gridSize}px)`
    }
  }
  if (store.canvas.layoutMode === 'flex') {
    /**
     * 设计器内与画布像素区域完全重合（无 padding/gap），避免「画布容器」与灰底画布错位。
     * 导出 HTML 中 body 仍可保留 gap/padding（见 codegen flexCanvasRootCss）。
     */
    return {
      display: 'flex',
      flexFlow: 'row wrap',
      alignItems: 'stretch',
      alignContent: 'stretch',
      gap: 0,
      padding: 0,
      boxSizing: 'border-box' as const,
      width: '100%',
      height: '100%'
    }
  }
  return {}
})

const canvasWrapStyle = computed(() => {
  const w = store.designSurfaceWidth
  const h = store.designSurfaceHeight
  const base: Record<string, string> = {
    width: `${w}px`,
    height: `${h}px`,
    transformOrigin: 'top center'
  }
  if (!props.applyCanvasZoom) return base
  return { ...base, transform: `scale(${store.canvas.zoom})` }
})

const rootElements = computed(() => sortSiblingsForRenderOrder(store.elements, null))

onUnmounted(() => {
  window.removeEventListener('mousemove', onWindowPointerMove, true)
  window.removeEventListener('mouseup', finishPointerDrag, true)
})

/** 指针移出 .canvas 后仍要继续更新拖动，故在 window 上监听（与 canvas 上的 mousemove 二选一即可，逻辑共用） */
const onWindowPointerMove = (event: MouseEvent): void => {
  onMouseMove(event)
}

const onMouseMove = (event: MouseEvent): void => {
  const rect = canvasRef.value?.getBoundingClientRect()
  if (!rect) return
  const zoom = store.canvas.zoom
  const x = store.snap((event.clientX - rect.left) / zoom)
  const y = store.snap((event.clientY - rect.top) / zoom)
  if (movingRootIds.value.length > 0) {
    const curX = store.snap((event.clientX - rect.left) / zoom)
    const curY = store.snap((event.clientY - rect.top) / zoom)
    const ddx = curX - dragStartCanvas.value.x
    const ddy = curY - dragStartCanvas.value.y
    for (const row of initialRootLayout.value) {
      const element = store.elements.find((item) => item.id === row.id)
      if (!element) continue
      /** 拖动过程中允许暂时超出画布，便于从外侧拖回；松手时在 finishPointerDrag 再夹紧 */
      const rawX = row.x + ddx
      const rawY = row.y + ddy
      const nx = store.snap(rawX)
      const ny = store.snap(rawY)
      store.updateElement(element.id, { x: nx, y: ny })
    }
    return
  }
  if (!store.activePreset) {
    store.clearDragPreview()
    return
  }
  store.setDragPreview({
    visible: true,
    x,
    y,
    width: store.activePreset.width,
    height: store.activePreset.height
  })
}

const onMouseLeave = (): void => {
  store.clearDragPreview()
}

/** 表格单元格空白处点击等仍走 click；须与 Ctrl 多选一致，且勿与 mousedown 重复覆盖 */
const onTreeSelect = (id: string, event?: MouseEvent): void => {
  if (event && (event.ctrlKey || event.metaKey)) {
    store.toggleSelectElement(id)
  } else {
    store.selectElement(id)
  }
}

const onElementMouseDown = (event: MouseEvent, element: DesignElement): void => {
  const rect = canvasRef.value?.getBoundingClientRect()
  if (!rect) return
  const zoom = store.canvas.zoom

  const mod = event.ctrlKey || event.metaKey
  if (mod) {
    pendingDrillDownSelectId.value = null
    store.toggleSelectElement(element.id)
    if (!store.selectedElementIds.includes(element.id)) {
      return
    }
  } else if (!store.selectedElementIds.includes(element.id)) {
    const keepSelectionBecauseAncestorSelected = store.selectedElementIds.some((sid) =>
      store.isDescendantOf(sid, element.id)
    )
    if (keepSelectionBecauseAncestorSelected) {
      pendingDrillDownSelectId.value = element.id
    } else {
      pendingDrillDownSelectId.value = null
      store.selectElement(element.id)
    }
  } else {
    pendingDrillDownSelectId.value = null
  }

  /**
   * 居中时视觉位置由 CSS（% / grid 跨轨）控制，数据里的 x/y 仍是旧值；按下时根据 DOM 同步左上角并关闭居中。
   */
  const shell = (event.target as HTMLElement).closest('[data-element-id]') as HTMLElement | null
  if (
    shell?.dataset.elementId === element.id &&
    (element.layoutCenterHorizontal || element.layoutCenterVertical)
  ) {
    const elRect = shell.getBoundingClientRect()
    const topX = store.snap((elRect.left - rect.left) / zoom)
    const topY = store.snap((elRect.top - rect.top) / zoom)
    store.updateElement(
      element.id,
      {
        x: topX,
        y: topY,
        layoutCenterHorizontal: false,
        layoutCenterVertical: false
      },
      { skipHistory: true }
    )
  }

  const roots = store.selectionRoots(store.selectedElementIds)
  if (roots.length === 0) return

  /** Flex 模式下由浏览器布局定位，不启用画布拖拽移动/拖放改父级 */
  if (store.canvas.layoutMode === 'flex') return

  dragStartCanvas.value = {
    x: store.snap((event.clientX - rect.left) / zoom),
    y: store.snap((event.clientY - rect.top) / zoom)
  }
  initialRootLayout.value = roots.map((rid) => {
    const el = store.elements.find((e) => e.id === rid)
    return { id: rid, x: el?.x ?? 0, y: el?.y ?? 0 }
  })
  movingRootIds.value = roots

  movePointerStart.value = { x: event.clientX, y: event.clientY }
  store.startLayoutDrag()
  window.removeEventListener('mousemove', onWindowPointerMove, true)
  window.removeEventListener('mouseup', finishPointerDrag, true)
  window.addEventListener('mousemove', onWindowPointerMove, true)
  window.addEventListener('mouseup', finishPointerDrag, true)
}

/** 将预设作为指定宿主的子元素，锚点（画布坐标）对齐新块中心并限制在宿主内容区内 */
const placePresetAsChildOf = (
  hostId: string,
  preset: ElementPreset,
  anchorCanvasX: number,
  anchorCanvasY: number
): void => {
  const host = store.elements.find((e) => e.id === hostId)
  if (!host || !canAddChildElements(host)) return
  const snap = (n: number) => store.snap(n)
  const tl = (w: number, h: number) =>
    clampAbsTopLeftInsideParentContent(
      host,
      w,
      h,
      anchorCanvasX - w / 2,
      anchorCanvasY - h / 2,
      snap
    )

  if (preset.kind === 'div') {
    const { x, y } = tl(preset.width, preset.height)
    store.addElement({ ...preset, x, y }, { parentId: host.id })
    return
  }

  if (preset.kind === 'image') {
    const w = preset.width
    const h = preset.height
    const { x: x0, y: y0 } = tl(w, h)
    if (!preset.hasLabel) {
      store.addElement(
        {
          kind: 'image',
          type: 'img',
          name: preset.name,
          x: x0,
          y: y0,
          width: w,
          height: h,
          background: preset.background,
          text: '',
          opacity: preset.opacity,
          imageSrc: preset.imageSrc ?? ''
        },
        { parentId: host.id }
      )
      return
    }
    store.beginHistoryBatch()
    const container = store.addElement(
      {
        kind: 'image',
        type: 'div',
        name: preset.name,
        x: x0,
        y: y0,
        width: w,
        height: h,
        background: preset.background,
        text: preset.text,
        opacity: preset.opacity,
        hasLabel: true,
        gap: preset.gap ?? 10,
        imageSrc: preset.imageSrc ?? ''
      },
      { parentId: host.id }
    )
    store.rebuildImageChildren(container.id)
    store.endHistoryBatch()
    return
  }

  if (preset.kind === 'table') {
    const w = preset.width
    const h = preset.height
    const { x: x0, y: y0 } = tl(w, h)
    store.beginHistoryBatch()
    const tableEl = store.addElement(
      {
        kind: 'table',
        type: 'table',
        name: preset.name,
        x: x0,
        y: y0,
        width: w,
        height: h,
        background: preset.background,
        text: '',
        opacity: preset.opacity,
        tableRows: preset.tableRows,
        tableCols: preset.tableCols,
        borderColor: preset.borderColor
      },
      { parentId: host.id }
    )
    store.initTableCells(tableEl.id)
    store.endHistoryBatch()
    return
  }

  if (preset.kind === 'dcomponent') {
    const w = preset.width
    const h = preset.height
    const { x: x0, y: y0 } = tl(w, h)
    store.addElement(
      {
        kind: 'dcomponent',
        type: 'div',
        name: preset.name,
        x: x0,
        y: y0,
        width: w,
        height: h,
        background: preset.background,
        text: '',
        opacity: preset.opacity,
        componentKey: preset.componentKey,
        componentClass: ''
      },
      { parentId: host.id }
    )
    return
  }

  const containerW = preset.width
  const containerH = preset.height
  const { x: containerX, y: containerY } = tl(containerW, containerH)
  store.beginHistoryBatch()
  const container = store.addElement(
    {
      kind: 'column',
      type: 'div',
      name: preset.name,
      x: containerX,
      y: containerY,
      width: containerW,
      height: containerH,
      background: preset.background,
      text: preset.text,
      opacity: preset.opacity,
      childCount: Math.max(1, Math.floor(preset.childCount))
    },
    { parentId: host.id }
  )
  const childCount = Math.max(1, Math.floor(preset.childCount))
  const heights = computeColumnChildHeights(containerH, childCount)
  let yOffset = 0
  for (let i = 0; i < childCount; i += 1) {
    const childH = heights[i] ?? 0
    if (childH <= 0) continue
    store.addElement(
      {
        kind: 'div',
        type: 'div',
        name: `ColumnChild-${container.serial}-${i + 1}`,
        x: containerX,
        y: containerY + yOffset,
        width: containerW,
        height: childH,
        background: preset.background,
        text: '',
        opacity: 0.8
      },
      { select: false, parentId: container.id }
    )
    yOffset += childH
  }
  store.endHistoryBatch()
}

const onLayerContextMenu = (event: MouseEvent): void => {
  if (movingRootIds.value.length > 0) return
  const rect = canvasRef.value?.getBoundingClientRect()
  if (!rect) return
  const zoom = store.canvas.zoom
  const canvasX = store.snap((event.clientX - rect.left) / zoom)
  const canvasY = store.snap((event.clientY - rect.top) / zoom)
  const stack = document.elementsFromPoint(event.clientX, event.clientY)
  let hostId: string | null = null
  for (const node of stack) {
    if (!(node instanceof HTMLElement)) continue
    const id = node.dataset.elementId
    if (!id) continue
    const el = store.elements.find((item) => item.id === id)
    if (!el || !canAddChildElements(el)) continue
    hostId = id
    break
  }
  if (!hostId) return
  event.preventDefault()
  event.stopPropagation()
  const panelW = 280
  const panelMaxH = 420
  childInsertContext.value = {
    hostId,
    canvasX,
    canvasY,
    panelX: Math.min(event.clientX, Math.max(8, window.innerWidth - panelW - 8)),
    panelY: Math.min(event.clientY, Math.max(8, window.innerHeight - panelMaxH - 8))
  }
}

const onChildInsertPick = (preset: ElementPreset): void => {
  const ctx = childInsertContext.value
  if (!ctx) return
  placePresetAsChildOf(ctx.hostId, preset, ctx.canvasX, ctx.canvasY)
  childInsertContext.value = null
}

const closeChildInsertDrawer = (): void => {
  childInsertContext.value = null
}

/** 在画布坐标下放置当前激活的预设（元素库 / 含组件） */
const placeActivePresetAtPointer = (event: MouseEvent): void => {
  const rect = canvasRef.value?.getBoundingClientRect()
  if (!rect) return
  const zoom = store.canvas.zoom
  const x = store.snap((event.clientX - rect.left) / zoom)
  const y = store.snap((event.clientY - rect.top) / zoom)
  let hitElementId: string | null = null
  const stack = document.elementsFromPoint(event.clientX, event.clientY)
  for (const node of stack) {
    if (!(node instanceof HTMLElement)) continue
    const id = node.dataset.elementId
    if (!id) continue
    const el = store.elements.find((item) => item.id === id)
    if (!el || el.kind === 'table') continue
    hitElementId = resolveFlexContainerHitAscend(store, event.clientX, event.clientY, id)
    break
  }

  const clientPointer = { clientX: event.clientX, clientY: event.clientY }

  const preset = store.activePreset
  if (!preset) return

  const presetPlaceOpts = { hitElementId, clientPointer }

  if (preset.kind === 'div') {
    store.addElement(
      {
        ...preset,
        x: Math.min(Math.max(0, x), store.designSurfaceWidth - preset.width),
        y: Math.min(Math.max(0, y), store.designSurfaceHeight - preset.height)
      },
      presetPlaceOpts
    )
    return
  }

  if (preset.kind === 'image') {
    const w = preset.width
    const h = preset.height
    const x0 = Math.min(Math.max(0, x), store.designSurfaceWidth - w)
    const y0 = Math.min(Math.max(0, y), store.designSurfaceHeight - h)
    if (!preset.hasLabel) {
      store.addElement(
        {
          kind: 'image',
          type: 'img',
          name: preset.name,
          x: x0,
          y: y0,
          width: w,
          height: h,
          background: preset.background,
          text: '',
          opacity: preset.opacity,
          imageSrc: preset.imageSrc ?? ''
        },
        presetPlaceOpts
      )
      return
    }
    store.beginHistoryBatch()
    const container = store.addElement(
      {
        kind: 'image',
        type: 'div',
        name: preset.name,
        x: x0,
        y: y0,
        width: w,
        height: h,
        background: preset.background,
        text: preset.text,
        opacity: preset.opacity,
        hasLabel: true,
        gap: preset.gap ?? 10,
        imageSrc: preset.imageSrc ?? ''
      },
      presetPlaceOpts
    )
    store.rebuildImageChildren(container.id)
    store.endHistoryBatch()
    return
  }

  if (preset.kind === 'table') {
    const w = preset.width
    const h = preset.height
    const x0 = Math.min(Math.max(0, x), store.designSurfaceWidth - w)
    const y0 = Math.min(Math.max(0, y), store.designSurfaceHeight - h)
    store.beginHistoryBatch()
    const tableEl = store.addElement(
      {
        kind: 'table',
        type: 'table',
        name: preset.name,
        x: x0,
        y: y0,
        width: w,
        height: h,
        background: preset.background,
        text: '',
        opacity: preset.opacity,
        tableRows: preset.tableRows,
        tableCols: preset.tableCols,
        borderColor: preset.borderColor
      },
      presetPlaceOpts
    )
    store.initTableCells(tableEl.id)
    store.endHistoryBatch()
    return
  }

  if (preset.kind === 'dcomponent') {
    const w = preset.width
    const h = preset.height
    const x0 = Math.min(Math.max(0, x), store.designSurfaceWidth - w)
    const y0 = Math.min(Math.max(0, y), store.designSurfaceHeight - h)
    store.addElement(
      {
        kind: 'dcomponent',
        type: 'div',
        name: preset.name,
        x: x0,
        y: y0,
        width: w,
        height: h,
        background: preset.background,
        text: '',
        opacity: preset.opacity,
        componentKey: preset.componentKey,
        componentClass: ''
      },
      presetPlaceOpts
    )
    return
  }

  // column preset: add container + N children stacked vertically
  const containerW = preset.width
  const containerH = preset.height
  const containerX = Math.min(Math.max(0, x), store.designSurfaceWidth - containerW)
  const containerY = Math.min(Math.max(0, y), store.designSurfaceHeight - containerH)

  store.beginHistoryBatch()
  const container = store.addElement(
    {
      kind: 'column',
      type: 'div',
      name: preset.name,
      x: containerX,
      y: containerY,
      width: containerW,
      height: containerH,
      background: preset.background,
      text: preset.text,
      opacity: preset.opacity,
      childCount: Math.max(1, Math.floor(preset.childCount))
    },
    presetPlaceOpts
  )

  const childCount = Math.max(1, Math.floor(preset.childCount))
  const heights = computeColumnChildHeights(containerH, childCount)
  let yOffset = 0
  for (let i = 0; i < childCount; i += 1) {
    const childH = heights[i] ?? 0
    if (childH <= 0) continue
    store.addElement(
      {
        kind: 'div',
        type: 'div',
        name: `ColumnChild-${container.serial}-${i + 1}`,
        x: containerX,
        y: containerY + yOffset,
        width: containerW,
        height: childH,
        background: preset.background,
        text: '',
        opacity: 0.8
      },
      { select: false, parentId: container.id }
    )
    yOffset += childH
  }
  store.endHistoryBatch()
}

/**
 * 子树 designer-element 使用 @click.stop 防止冒泡抢选中，但会导致「在容器内点击放置预设」无法到达 .layer。
 * 捕获阶段在子节点之前执行，在此处放置预设并阻止传递，即可在任意嵌套内落点。
 */
const onLayerPresetClickCapture = (event: MouseEvent): void => {
  if (!store.activePreset) return
  if (suppressNextCanvasClick.value) {
    suppressNextCanvasClick.value = false
    event.stopPropagation()
    event.stopImmediatePropagation()
    return
  }
  if (movingRootIds.value.length > 0) return
  placeActivePresetAtPointer(event)
  event.stopPropagation()
  event.stopImmediatePropagation()
}

const onCanvasClick = (event: MouseEvent): void => {
  if (store.activePreset) return

  if (suppressNextCanvasClick.value) {
    suppressNextCanvasClick.value = false
    return
  }

  const clickedElement = (event.target as HTMLElement).closest('.designer-element')
  if (!clickedElement) {
    store.clearSelection()
  }
}
</script>

<template>
  <section class="design-area" :class="{ 'design-area--embedded-virtual': embeddedVirtual }">
    <div
      class="canvas-wrap"
      :class="{ 'canvas-wrap--embedded-virtual': embeddedVirtual }"
      :style="canvasWrapStyle"
    >
      <div
        ref="canvasRef"
        class="canvas"
        :class="{ 'canvas--no-grid': embeddedVirtual || store.canvas.layoutMode === 'flex' }"
        :style="embeddedVirtual ? {} : gridBackground"
        @mousemove="onMouseMove"
        @mouseleave="onMouseLeave"
      >
        <div
          class="layer"
          :style="layerStyle"
          @click.capture="onLayerPresetClickCapture"
          @contextmenu.capture="onLayerContextMenu"
          @click="onCanvasClick"
        >
          <DesignTreeNode
            v-for="element in rootElements"
            :key="element.id"
            :element="element"
            :elements="store.elements"
            :selected-element-ids="store.selectedElementIds"
            :layout-mode="store.canvas.layoutMode"
            :grid-size="store.canvas.gridSize"
            :surface-width="store.designSurfaceWidth"
            :surface-height="store.designSurfaceHeight"
            @mousedown="onElementMouseDown"
            @select="onTreeSelect"
          />
        </div>
        <div
          v-if="store.dragPreview.visible"
          class="hover-cell"
          :style="{ left: `${store.dragPreview.x}px`, top: `${store.dragPreview.y}px` }"
        />
        <div
          v-if="store.dragPreview.visible"
          class="preview"
          :style="{
            left: `${store.dragPreview.x}px`,
            top: `${store.dragPreview.y}px`,
            width: `${store.dragPreview.width}px`,
            height: `${store.dragPreview.height}px`
          }"
        />
      </div>
    </div>
    <ElementContextDrawer
      :visible="!!childInsertContext"
      :anchor-x="childInsertContext?.panelX ?? 0"
      :anchor-y="childInsertContext?.panelY ?? 0"
      @pick="onChildInsertPick"
      @close="closeChildInsertDrawer"
    />
  </section>
</template>

<style scoped>
.design-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: safe center;
  width: 100%;
  max-width: 100%;
  height: 100%;
  min-height: 0;
  overflow: auto;
  padding: 20px 12px 80px;
  box-sizing: border-box;
  background: #0f131a;
}

.design-area--embedded-virtual {
  padding: 0;
  justify-content: stretch;
  align-items: stretch;
  background: transparent;
  overflow: hidden;
}

.canvas-wrap {
  flex-shrink: 0;
  border: 1px solid #2c3342;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.35);
}

.canvas-wrap--embedded-virtual {
  border: none;
  box-shadow: none;
}

.canvas {
  position: relative;
  width: 100%;
  height: 100%;
  background-color: #1a1f2b;
}

.design-area--embedded-virtual .canvas {
  background-color: transparent;
}

/* 虚拟设备内不显示对齐网格线（与标准画布无关） */
.canvas--no-grid::after {
  display: none !important;
}

/* 网格在元素之下，避免压住选中虚线；线较淡以减轻与 1px 边框的视觉冲突 */
.canvas::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(to right, rgba(255, 255, 255, 0.04) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(255, 255, 255, 0.04) 1px, transparent 1px);
  background-size: var(--grid-size) var(--grid-size);
  pointer-events: none;
  z-index: 1;
}

.layer {
  position: absolute;
  inset: 0;
  z-index: 2;
}

.preview {
  position: absolute;
  border: 1px dashed #58a6ff;
  background: rgba(88, 166, 255, 0.25);
  pointer-events: none;
  z-index: 10001;
}

.hover-cell {
  position: absolute;
  width: 10px;
  height: 10px;
  background: rgba(255, 255, 255, 0.2);
  pointer-events: none;
  z-index: 10000;
}
</style>
