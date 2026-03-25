<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { useDesignStore } from '@renderer/store/design'
import type { DesignElement } from '@renderer/types/design'
import DesignTreeNode from './DesignTreeNode.vue'

const store = useDesignStore()
const canvasRef = ref<HTMLElement | null>(null)
const movingElementId = ref<string>('')
const moveOffset = ref({ x: 0, y: 0 })
/** 用于判断是否发生拖动，避免纯点击也触发挂接询问 */
const movePointerStart = ref<{ x: number; y: number } | null>(null)
/** 拖放结束后吞掉紧随的一次 canvas click，防止误触发「从预设添加」 */
const suppressNextCanvasClick = ref(false)

const DRAG_THRESHOLD_PX = 4

const finishPointerDrag = (event: MouseEvent): void => {
  window.removeEventListener('mouseup', finishPointerDrag, true)
  const movedId = movingElementId.value
  movingElementId.value = ''

  if (!movedId || !movePointerStart.value) {
    movePointerStart.value = null
    return
  }

  const dragged =
    Math.abs(event.clientX - movePointerStart.value.x) > DRAG_THRESHOLD_PX ||
    Math.abs(event.clientY - movePointerStart.value.y) > DRAG_THRESHOLD_PX
  movePointerStart.value = null

  if (!dragged) return

  suppressNextCanvasClick.value = true

  const moved = store.elements.find((item) => item.id === movedId)
  if (!moved) return

  const stack = document.elementsFromPoint(event.clientX, event.clientY)
  let dropTargetId: string | null = null
  for (const node of stack) {
    if (!(node instanceof HTMLElement)) continue
    const id = node.dataset.elementId
    if (!id || id === movedId) continue
    const el = store.elements.find((item) => item.id === id)
    if (!el) continue
    if (el.kind === 'table') continue
    if (store.isDescendantOf(movedId, id)) continue
    dropTargetId = id
    break
  }

  if (!dropTargetId || moved.parentId === dropTargetId) return

  const ok = window.confirm('是否将此元素作为子元素加入？')
  if (ok) {
    store.reparentElement(movedId, dropTargetId)
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
  if (movingElementId.value) {
    const element = store.elements.find((item) => item.id === movingElementId.value)
    if (!element) return
    const nextX = store.snap((event.clientX - rect.left) / zoom - moveOffset.value.x)
    const nextY = store.snap((event.clientY - rect.top) / zoom - moveOffset.value.y)
    store.updateElement(element.id, {
      x: Math.min(Math.max(0, nextX), store.canvas.width - element.width),
      y: Math.min(Math.max(0, nextY), store.canvas.height - element.height)
    })
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

const onElementMouseDown = (event: MouseEvent, element: DesignElement): void => {
  const rect = canvasRef.value?.getBoundingClientRect()
  if (!rect) return
  const zoom = store.canvas.zoom
  movingElementId.value = element.id
  movePointerStart.value = { x: event.clientX, y: event.clientY }
  moveOffset.value = {
    x: (event.clientX - rect.left) / zoom - element.x,
    y: (event.clientY - rect.top) / zoom - element.y
  }
  store.selectElement(element.id)
  window.removeEventListener('mouseup', finishPointerDrag, true)
  window.addEventListener('mouseup', finishPointerDrag, true)
}

const onCanvasClick = (event: MouseEvent): void => {
  if (suppressNextCanvasClick.value) {
    suppressNextCanvasClick.value = false
    return
  }

  const clickedElement = (event.target as HTMLElement).closest('.designer-element')

  if (!store.activePreset || movingElementId.value) {
    if (!clickedElement) {
      store.clearSelection()
    }
    return
  }
  const rect = canvasRef.value?.getBoundingClientRect()
  if (!rect) return
  const zoom = store.canvas.zoom
  const x = store.snap((event.clientX - rect.left) / zoom)
  const y = store.snap((event.clientY - rect.top) / zoom)
  const hitEl = (event.target as HTMLElement).closest('[data-element-id]') as HTMLElement | null
  const hitElementId = hitEl?.dataset.elementId ?? null

  const preset = store.activePreset
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
    return
  }

  if (preset.kind === 'table') {
    const w = preset.width
    const h = preset.height
    const x0 = Math.min(Math.max(0, x), store.canvas.width - w)
    const y0 = Math.min(Math.max(0, y), store.canvas.height - h)
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
  const grid = store.canvas.gridSize
  const childBaseH = Math.max(grid, Math.floor(containerH / childCount / grid) * grid)

  for (let i = 0; i < childCount; i += 1) {
    const isLast = i === childCount - 1
    const childH = isLast ? containerH - childBaseH * (childCount - 1) : childBaseH
    if (childH <= 0) continue
    store.addElement(
      {
        kind: 'div',
        type: 'div',
        name: `ColumnChild-${container.serial}-${i + 1}`,
        x: containerX,
        y: containerY + i * childBaseH,
        width: containerW,
        height: childH,
        background: preset.background,
        text: '',
        opacity: 0.8
      },
      { select: false, parentId: container.id }
    )
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
        <div class="layer" :style="layerStyle" @click="onCanvasClick">
          <DesignTreeNode
            v-for="element in rootElements"
            :key="element.id"
            :element="element"
            :elements="store.elements"
            :selected-element-id="store.selectedElementId"
            :layout-mode="store.canvas.layoutMode"
            :grid-size="store.canvas.gridSize"
            @mousedown="onElementMouseDown"
            @select="store.selectElement"
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
  width: 100%;
  max-width: 100%;
  height: 100%;
  overflow: auto;
  padding: 20px 12px 80px;
  background: #0f131a;
}

.canvas-wrap {
  margin: 0 auto;
  border: 1px solid #2c3342;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.35);
}

.canvas {
  position: relative;
  width: 100%;
  height: 100%;
  background-color: #1a1f2b;
}

.canvas::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(to right, rgba(255, 255, 255, 0.08) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(255, 255, 255, 0.08) 1px, transparent 1px);
  background-size: var(--grid-size) var(--grid-size);
  pointer-events: none;
  z-index: 9999;
}

.layer {
  position: absolute;
  inset: 0;
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
