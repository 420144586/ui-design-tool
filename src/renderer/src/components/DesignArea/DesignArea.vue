<script setup lang="ts">
import { computed, ref } from 'vue'
import { useDesignStore } from '@renderer/store/design'
import type { DesignElement } from '@renderer/types/design'

const store = useDesignStore()
const canvasRef = ref<HTMLElement | null>(null)
const movingElementId = ref<string>('')
const moveOffset = ref({ x: 0, y: 0 })

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

const elementStyle = (element: DesignElement): Record<string, string> => {
  if (store.canvas.layoutMode === 'grid') {
    const col = Math.floor(element.x / store.canvas.gridSize) + 1
    const row = Math.floor(element.y / store.canvas.gridSize) + 1
    const colSpan = Math.max(1, Math.ceil(element.width / store.canvas.gridSize))
    const rowSpan = Math.max(1, Math.ceil(element.height / store.canvas.gridSize))
    return {
      gridColumn: `${col} / span ${colSpan}`,
      gridRow: `${row} / span ${rowSpan}`,
      width: `${element.width}px`,
      height: `${element.height}px`,
      background: element.background,
      opacity: String(element.opacity),
      position: 'relative'
    }
  }

  return {
    left: `${element.x}px`,
    top: `${element.y}px`,
    width: `${element.width}px`,
    height: `${element.height}px`,
    background: element.background,
    opacity: String(element.opacity),
    zIndex: String(element.serial)
  }
}

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
  moveOffset.value = {
    x: (event.clientX - rect.left) / zoom - element.x,
    y: (event.clientY - rect.top) / zoom - element.y
  }
  store.selectElement(element.id)
}

const onMouseUp = (): void => {
  movingElementId.value = ''
}

const onCanvasClick = (event: MouseEvent): void => {
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
  const preset = store.activePreset
  store.addElement({
    ...preset,
    x: Math.min(Math.max(0, x), store.canvas.width - preset.width),
    y: Math.min(Math.max(0, y), store.canvas.height - preset.height)
  })
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
        @mouseup="onMouseUp"
        @mouseleave="onMouseLeave"
      >
        <div class="layer" :style="layerStyle" @click="onCanvasClick">
          <div
            v-for="element in store.elements"
            :key="element.id"
            class="designer-element"
            :class="{ active: store.selectedElementId === element.id }"
            :style="elementStyle(element)"
            @mousedown.stop="onElementMouseDown($event, element)"
            @click="store.selectElement(element.id)"
          >
            {{ element.serial }}
          </div>
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

.designer-element {
  position: absolute;
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: #f1f4fb;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  overflow: hidden;
}

.designer-element.active {
  outline: 2px solid #58a6ff;
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
