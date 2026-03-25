<script setup lang="ts">
import { computed } from 'vue'
import type { DesignElement, LayoutMode } from '@renderer/types/design'
import DButton from '@renderer/D-components/DButton.vue'

defineOptions({ name: 'DesignTreeNode' })

const props = defineProps<{
  element: DesignElement
  elements: DesignElement[]
  selectedElementId: string
  layoutMode: LayoutMode
  gridSize: number
  parent?: DesignElement
}>()

const emit = defineEmits<{
  select: [id: string]
  mousedown: [event: MouseEvent, element: DesignElement]
}>()

const children = computed(() => {
  const list = props.elements.filter((item) => item.parentId === props.element.id)
  const byLayer = (a: (typeof list)[0], b: (typeof list)[0]) => a.y - b.y || a.x - b.x
  const byHorizontal = (a: (typeof list)[0], b: (typeof list)[0]) => a.x - b.x || a.y - b.y
  if (props.element.kind === 'image' && props.element.type === 'div') {
    return [...list].sort(byHorizontal)
  }
  return [...list].sort(byLayer)
})

const relativeX = computed(() => (props.parent ? props.element.x - props.parent.x : props.element.x))
const relativeY = computed(() => (props.parent ? props.element.y - props.parent.y : props.element.y))

const PLACEHOLDER_IMG =
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30"><rect fill="#3d4555" width="30" height="30"/><path fill="#8b96ac" d="M8 10h14v2H8zm0 5h10v2H8z"/></svg>`
  )

const imgSrc = computed(
  () => props.element.imageSrc?.trim() || PLACEHOLDER_IMG
)

const nodeStyle = computed(() => {
  if (props.parent?.kind === 'image' && props.parent.type === 'div') {
    const style: Record<string, string> = {}
    if (props.element.type === 'img') {
      style.position = 'relative'
      style.width = '30px'
      style.height = '30px'
      style.flexShrink = '0'
      style.opacity = String(props.element.opacity)
      return style
    }
    if (props.parent.hasLabel && props.element.type === 'div') {
      style.position = 'relative'
      style.flex = '1 1 auto'
      style.minWidth = '100px'
      style.maxWidth = 'none'
      style.width = 'auto'
      style.height = '100%'
      style.boxSizing = 'border-box'
      style.background = props.element.background
      style.opacity = String(props.element.opacity)
      style.display = 'flex'
      style.alignItems = 'center'
      style.justifyContent = 'center'
      return style
    }
  }

  const style: Record<string, string> = {}
  const isDComponent = props.element.kind === 'dcomponent'
  if (props.layoutMode === 'grid') {
    const col = Math.floor(relativeX.value / props.gridSize) + 1
    const row = Math.floor(relativeY.value / props.gridSize) + 1
    const colSpan = Math.max(1, Math.ceil(props.element.width / props.gridSize))
    const rowSpan = Math.max(1, Math.ceil(props.element.height / props.gridSize))
    style.gridColumn = `${col} / span ${colSpan}`
    style.gridRow = `${row} / span ${rowSpan}`
    style.width = `${props.element.width}px`
    style.height = `${props.element.height}px`
    style.background = isDComponent ? 'transparent' : props.element.background
    style.opacity = String(props.element.opacity)
    style.position = 'relative'
    return style
  }

  style.position = 'absolute'
  style.left = `${relativeX.value}px`
  style.top = `${relativeY.value}px`
  style.width = `${props.element.width}px`
  style.height = `${props.element.height}px`
  style.background = isDComponent ? 'transparent' : props.element.background
  style.opacity = String(props.element.opacity)
  return style
})

const labelText = computed(() => props.element.text.trim())

const tableRows = computed(() =>
  Math.max(1, Math.floor(Number(props.element.tableRows) || 5))
)
const tableCols = computed(() =>
  Math.max(1, Math.floor(Number(props.element.tableCols) || 5))
)
const tableBorderColor = computed(() => props.element.borderColor ?? '#d0d0d0')
const tableStyle = computed(() => ({
  '--table-border': tableBorderColor.value
}))

const tableCellMap = computed(() => {
  const m = new Map<string, DesignElement>()
  if (props.element.kind !== 'table') return m
  for (const e of props.elements) {
    if (e.parentId !== props.element.id || !e.isTableCell) continue
    m.set(`${e.tableCellRow ?? 0},${e.tableCellCol ?? 0}`, e)
  }
  return m
})

const tableCellAt = (row: number, col: number): DesignElement | undefined =>
  tableCellMap.value.get(`${row},${col}`)

const tableCellChildren = (cell: DesignElement): DesignElement[] =>
  props.elements
    .filter((item) => item.parentId === cell.id)
    .sort((a, b) => a.y - b.y || a.x - b.x)

/** 单元格上默认 stop，否则会拦掉外层表格的 mousedown，表几乎无法拖动；选中整张表时再放开冒泡 */
const onTableCellSlotMouseDown = (e: MouseEvent): void => {
  if (props.selectedElementId === props.element.id) return
  e.stopPropagation()
}

const childContainerStyle = computed(() => {
  const style: Record<string, string> = {}
  if (children.value.length === 0) return style
  if (props.element.kind === 'image' && props.element.type === 'div') {
    style.position = 'absolute'
    style.inset = '0'
    style.display = 'flex'
    style.flexDirection = 'row'
    style.alignItems = 'center'
    style.gap = `${props.element.gap ?? 10}px`
    style.boxSizing = 'border-box'
    return style
  }
  if (props.layoutMode === 'grid') {
    style.position = 'absolute'
    style.inset = '0'
    style.display = 'grid'
    style.gridTemplateColumns = `repeat(${Math.max(1, Math.floor(props.element.width / props.gridSize))}, ${props.gridSize}px)`
    style.gridTemplateRows = `repeat(${Math.max(1, Math.floor(props.element.height / props.gridSize))}, ${props.gridSize}px)`
    return style
  }
  style.position = 'absolute'
  style.inset = '0'
  return style
})
</script>

<template>
  <div
    v-if="element.type === 'img'"
    class="designer-element designer-element--img"
    :data-element-id="element.id"
    :class="{ active: selectedElementId === element.id }"
    :style="nodeStyle"
    @mousedown.stop="emit('mousedown', $event, element)"
    @click.stop="emit('select', element.id)"
  >
    <img class="designer-img" :src="imgSrc" alt="" draggable="false" />
  </div>
  <div
    v-else-if="element.kind === 'table'"
    class="designer-element designer-element--table"
    :data-element-id="element.id"
    :class="{ active: selectedElementId === element.id }"
    :style="{ ...nodeStyle, ...tableStyle }"
    @mousedown.stop="emit('mousedown', $event, element)"
    @click.stop="emit('select', element.id)"
  >
    <table class="designer-table">
      <tr v-for="ri in tableRows" :key="'tr-' + ri">
        <td v-for="ci in tableCols" :key="'td-' + ri + '-' + ci">
          <div
            v-if="tableCellAt(ri - 1, ci - 1)"
            class="designer-td-slot"
            :data-element-id="tableCellAt(ri - 1, ci - 1)!.id"
            @mousedown="onTableCellSlotMouseDown"
            @click.self="emit('select', tableCellAt(ri - 1, ci - 1)!.id)"
          >
            <DesignTreeNode
              v-for="sub in tableCellChildren(tableCellAt(ri - 1, ci - 1)!)"
              :key="sub.id"
              :element="sub"
              :elements="elements"
              :selected-element-id="selectedElementId"
              :layout-mode="layoutMode"
              :grid-size="gridSize"
              :parent="tableCellAt(ri - 1, ci - 1)"
              @select="emit('select', $event)"
              @mousedown="(event, node) => emit('mousedown', event, node)"
            />
          </div>
        </td>
      </tr>
    </table>
  </div>
  <div
    v-else-if="element.kind === 'dcomponent'"
    class="designer-element designer-element--dcomponent"
    :data-element-id="element.id"
    :class="{ active: selectedElementId === element.id }"
    :style="nodeStyle"
    @mousedown.stop="emit('mousedown', $event, element)"
    @click.stop="emit('select', element.id)"
  >
    <DButton
      v-if="element.componentKey === 'DButton'"
      class="dcomponent-root"
      :class="[element.id, element.componentClass?.trim()].filter(Boolean)"
      :surface-background="element.background"
    />
  </div>
  <div
    v-else
    class="designer-element"
    :data-element-id="element.id"
    :class="{ active: selectedElementId === element.id }"
    :style="nodeStyle"
    @mousedown.stop="emit('mousedown', $event, element)"
    @click.stop="emit('select', element.id)"
  >
    <span v-if="labelText" class="element-label">{{ labelText }}</span>

    <div v-if="children.length" class="children-layer" :style="childContainerStyle">
      <DesignTreeNode
        v-for="child in children"
        :key="child.id"
        :element="child"
        :elements="elements"
        :selected-element-id="selectedElementId"
        :layout-mode="layoutMode"
        :grid-size="gridSize"
        :parent="element"
        @select="emit('select', $event)"
        @mousedown="(event, node) => emit('mousedown', event, node)"
      />
    </div>
  </div>
</template>

<style scoped>
.designer-element {
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

.element-label {
  position: relative;
  z-index: 2;
  text-align: center;
  word-break: break-word;
  padding: 2px 4px;
  pointer-events: none;
}

.children-layer {
  pointer-events: none;
}

.children-layer :deep(.designer-element) {
  pointer-events: auto;
}

.designer-element--img {
  padding: 0;
  overflow: hidden;
}

.designer-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  pointer-events: none;
}

.designer-element--table {
  padding: 0;
  display: block;
}

.designer-table {
  width: 100%;
  height: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.designer-table td {
  border: 1px solid var(--table-border, #d0d0d0);
  vertical-align: top;
  padding: 0;
}

.designer-td-slot {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 100%;
  box-sizing: border-box;
  pointer-events: auto;
}

.designer-td-slot :deep(.designer-element) {
  pointer-events: auto;
}

.designer-element--dcomponent {
  padding: 0;
  overflow: hidden;
}

.dcomponent-root {
  display: block;
  width: 100%;
  height: 100%;
  min-height: 0;
}
</style>
