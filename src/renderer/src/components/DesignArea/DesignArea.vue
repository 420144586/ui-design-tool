<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { useDesignStore } from '@renderer/store/design'
import type { DesignElement } from '@renderer/types/design'
import { computeColumnChildHeights } from '@renderer/utils/columnLayout'
import DesignTreeNode from './DesignTreeNode.vue'

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

const DRAG_THRESHOLD_PX = 4

const finishPointerDrag = (event: MouseEvent): void => {
  window.removeEventListener('mouseup', finishPointerDrag, true)
  store.endLayoutDrag()
  const roots = [...movingRootIds.value]
  movingRootIds.value = []
  initialRootLayout.value = []

  if (roots.length === 0 || !movePointerStart.value) {
    movePointerStart.value = null
    return
  }

  const dragged =
    Math.abs(event.clientX - movePointerStart.value.x) > DRAG_THRESHOLD_PX ||
    Math.abs(event.clientY - movePointerStart.value.y) > DRAG_THRESHOLD_PX
  movePointerStart.value = null

  if (!dragged) return

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
  if (store.canvas.layoutMode !== 'grid') return {}
  return {
    display: 'grid',
    /** 与子项 grid 占位（含 1/-1 跨满）配合，使 place-self/justify-self 在可视区域内生效 */
    placeItems: 'center',
    gridTemplateColumns: `repeat(${Math.max(1, Math.floor(store.canvas.width / store.canvas.gridSize))}, ${store.canvas.gridSize}px)`,
    gridTemplateRows: `repeat(${Math.max(1, Math.floor(store.canvas.height / store.canvas.gridSize))}, ${store.canvas.gridSize}px)`
  }
})

const rootElements = computed(() =>
  store.elements.filter((item) => item.parentId === null).sort((a, b) => a.y - b.y || a.x - b.x)
)

onUnmounted(() => {
  window.removeEventListener('mouseup', finishPointerDrag, true)
})

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
      const nx = Math.min(
        Math.max(0, row.x + ddx),
        store.canvas.width - element.width
      )
      const ny = Math.min(
        Math.max(0, row.y + ddy),
        store.canvas.height - element.height
      )
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
    store.toggleSelectElement(element.id)
    if (!store.selectedElementIds.includes(element.id)) {
      return
    }
  } else if (!store.selectedElementIds.includes(element.id)) {
    store.selectElement(element.id)
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
  window.removeEventListener('mouseup', finishPointerDrag, true)
  window.addEventListener('mouseup', finishPointerDrag, true)
}

/** 在画布坐标下放置当前激活的预设（元素库 / 含组件） */
const placeActivePresetAtPointer = (event: MouseEvent): void => {
  const rect = canvasRef.value?.getBoundingClientRect()
  if (!rect) return
  const zoom = store.canvas.zoom
  const x = store.snap((event.clientX - rect.left) / zoom)
  const y = store.snap((event.clientY - rect.top) / zoom)
  const hitEl = (event.target as HTMLElement).closest('[data-element-id]') as HTMLElement | null
  const hitElementId = hitEl?.dataset.elementId ?? null

  const preset = store.activePreset
  if (!preset) return

  if (preset.kind === 'div') {
    store.addElement(
      {
        ...preset,
        x: Math.min(Math.max(0, x), store.canvas.width - preset.width),
        y: Math.min(Math.max(0, y), store.canvas.height - preset.height)
      },
      { hitElementId }
    )
    return
  }

  if (preset.kind === 'image') {
    const w = preset.width
    const h = preset.height
    const x0 = Math.min(Math.max(0, x), store.canvas.width - w)
    const y0 = Math.min(Math.max(0, y), store.canvas.height - h)
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
        { hitElementId }
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
      { hitElementId }
    )
    store.rebuildImageChildren(container.id)
    store.endHistoryBatch()
    return
  }

  if (preset.kind === 'table') {
    const w = preset.width
    const h = preset.height
    const x0 = Math.min(Math.max(0, x), store.canvas.width - w)
    const y0 = Math.min(Math.max(0, y), store.canvas.height - h)
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
      { hitElementId }
    )
    store.initTableCells(tableEl.id)
    store.endHistoryBatch()
    return
  }

  if (preset.kind === 'dcomponent') {
    const w = preset.width
    const h = preset.height
    const x0 = Math.min(Math.max(0, x), store.canvas.width - w)
    const y0 = Math.min(Math.max(0, y), store.canvas.height - h)
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
      { hitElementId }
    )
    return
  }

  // column preset: add container + N children stacked vertically
  const containerW = preset.width
  const containerH = preset.height
  const containerX = Math.min(Math.max(0, x), store.canvas.width - containerW)
  const containerY = Math.min(Math.max(0, y), store.canvas.height - containerH)

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
    { hitElementId }
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
  <section class="design-area">
    <div
      class="canvas-wrap"
      :style="{
        width: `${store.canvas.width}px`,
        height: `${store.canvas.height}px`,
        transform: `scale(${store.canvas.zoom})`,
        transformOrigin: 'top center'
      }"
    >
      <div
        ref="canvasRef"
        class="canvas"
        :style="gridBackground"
        @mousemove="onMouseMove"
        @mouseleave="onMouseLeave"
      >
        <div
          class="layer"
          :style="layerStyle"
          @click.capture="onLayerPresetClickCapture"
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

.canvas-wrap {
  flex-shrink: 0;
  border: 1px solid #2c3342;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.35);
}

.canvas {
  position: relative;
  width: 100%;
  height: 100%;
  background-color: #1a1f2b;
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
