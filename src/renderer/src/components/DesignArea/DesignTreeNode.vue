<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import type { DesignElement, LayoutMode } from '@renderer/types/design'
import DButton from '@renderer/D-components/DButton.vue'
import DInput from '@renderer/D-components/DInput.vue'
import { useDesignStore } from '@renderer/store/design'
import { cssBackgroundFill } from '@renderer/utils/elementBackground'
import { applyBoxBorderToStyle, isBorderSideEnabled } from '@renderer/utils/elementBorder'
import { applyLayoutCenterToInlineStyle, gridPlacementForElement } from '@renderer/utils/layoutCenter'
import { cssWidthHeightStrings, resolveElementLayoutPxBox } from '@renderer/utils/elementLayoutSize'
import { applyPaddingMarginToStyle, effectivePaddingInsets } from '@renderer/utils/elementSpacing'
import { applyFlexContainerToStyle } from '@renderer/utils/elementFlex'

defineOptions({ name: 'DesignTreeNode' })

const props = defineProps<{
  element: DesignElement
  elements: DesignElement[]
  selectedElementIds: string[]
  layoutMode: LayoutMode
  gridSize: number
  /** 设计表面宽度（根级百分比基准） */
  surfaceWidth: number
  /** 设计表面高度（根级百分比基准） */
  surfaceHeight: number
  parent?: DesignElement
}>()

const emit = defineEmits<{
  /** 第二项为 click 事件（如表格单元格），便于 Ctrl 多选；仅 mousedown 选中的分支不会触发 */
  select: [id: string, event?: MouseEvent]
  mousedown: [event: MouseEvent, element: DesignElement]
}>()

const store = useDesignStore()

const colDrag = ref<{ edgeCol: number; lastX: number } | null>(null)
const rowDrag = ref<{ edgeRow: number; lastY: number } | null>(null)

const onColMove = (e: MouseEvent): void => {
  const d = colDrag.value
  if (!d || props.element.kind !== 'table') return
  const dx = e.clientX - d.lastX
  d.lastX = e.clientX
  if (dx !== 0) store.nudgeTableColumnEdge(props.element.id, d.edgeCol, dx, { skipHistory: true })
}

const onColUp = (): void => {
  colDrag.value = null
  window.removeEventListener('mousemove', onColMove)
}

const onColResizeStart = (edgeCol: number, e: MouseEvent): void => {
  if (props.element.kind !== 'table') return
  e.stopPropagation()
  e.preventDefault()
  store.pushDesignHistory()
  colDrag.value = { edgeCol, lastX: e.clientX }
  window.addEventListener('mousemove', onColMove)
  window.addEventListener('mouseup', onColUp, { once: true })
}

const onRowMove = (e: MouseEvent): void => {
  const d = rowDrag.value
  if (!d || props.element.kind !== 'table') return
  const dy = e.clientY - d.lastY
  d.lastY = e.clientY
  if (dy !== 0) store.nudgeTableRowEdge(props.element.id, d.edgeRow, dy, { skipHistory: true })
}

const onRowUp = (): void => {
  rowDrag.value = null
  window.removeEventListener('mousemove', onRowMove)
}

const onRowResizeStart = (edgeRow: number, e: MouseEvent): void => {
  if (props.element.kind !== 'table') return
  e.stopPropagation()
  e.preventDefault()
  store.pushDesignHistory()
  rowDrag.value = { edgeRow, lastY: e.clientY }
  window.addEventListener('mousemove', onRowMove)
  window.addEventListener('mouseup', onRowUp, { once: true })
}

onUnmounted(() => {
  window.removeEventListener('mousemove', onColMove)
  window.removeEventListener('mousemove', onRowMove)
})

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

/** 当前元素等效像素宽高（含百分比沿父链解析），用于网格占位与子层网格线 */
const layoutPxBox = computed(() =>
  resolveElementLayoutPxBox(props.element, props.elements, {
    width: props.surfaceWidth,
    height: props.surfaceHeight
  })
)

/**
 * 子节点坐标系在父的 padding 盒内（不含父边框），若仍用与父同值的宽高会溢出并压在父边框上。
 * border-box：用 max 100% 将整块限制在父内容区；content-box：边框在 width 外，需减去自身边框厚度。
 */
function applyParentBoundsClamp(style: Record<string, string>, element: DesignElement): void {
  if (!props.parent) return
  const isContentBox = element.boxSizing === 'content-box'
  const bw = element.borderWidth
  const bs = element.borderStyle
  const hasBorder = !!(bw && bs && bs !== 'none')
  if (!isContentBox) {
    style.maxWidth = '100%'
    style.maxHeight = '100%'
    return
  }
  if (!hasBorder) {
    style.maxWidth = '100%'
    style.maxHeight = '100%'
    return
  }
  const l = isBorderSideEnabled(element, 'left') ? bw! : 0
  const r = isBorderSideEnabled(element, 'right') ? bw! : 0
  const t = isBorderSideEnabled(element, 'top') ? bw! : 0
  const b = isBorderSideEnabled(element, 'bottom') ? bw! : 0
  style.maxWidth = l + r > 0 ? `calc(100% - ${l + r}px)` : '100%'
  style.maxHeight = t + b > 0 ? `calc(100% - ${t + b}px)` : '100%'
}

const nodeStyle = computed(() => {
  const commonStyle: Record<string, string> = {}
  commonStyle.boxSizing = props.element.boxSizing === 'content-box' ? 'content-box' : 'border-box'
  if (props.element.color) commonStyle.color = props.element.color
  if (props.element.fontSize) commonStyle.fontSize = `${props.element.fontSize}px`
  if (props.element.fontWeight) commonStyle.fontWeight = props.element.fontWeight
  commonStyle.textAlign = props.element.textAlign ?? 'center'
  if (props.element.borderRadius) commonStyle.borderRadius = `${props.element.borderRadius}px`
  applyBoxBorderToStyle(commonStyle, props.element)
  applyPaddingMarginToStyle(commonStyle, props.element)

  if (props.parent?.kind === 'image' && props.parent.type === 'div') {
    const style: Record<string, string> = { ...commonStyle }
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
      style.background = cssBackgroundFill(props.element)
      style.opacity = String(props.element.opacity)
      style.display = 'flex'
      style.alignItems = 'center'
      style.justifyContent = 'center'
      return style
    }
  }

  /** 父级启用自定义 flex 时，子项参与主轴排版（非图片/Label 特殊结构） */
  const parentFlex =
    props.parent?.flexLayoutEnabled === true &&
    !(
      props.parent.kind === 'image' &&
      props.parent.type === 'div' &&
      (props.element.type === 'img' ||
        (props.parent.hasLabel &&
          props.element.type === 'div' &&
          props.element.name.endsWith('-label')))
    )
  if (parentFlex) {
    const style: Record<string, string> = { ...commonStyle }
    const wh = cssWidthHeightStrings(props.element)
    const isDComponent = props.element.kind === 'dcomponent'
    style.position = 'relative'
    style.left = '0'
    style.top = '0'
    style.width = wh.width
    style.height = wh.height
    style.flexShrink = '0'
    applyParentBoundsClamp(style, props.element)
    style.background = isDComponent ? 'transparent' : cssBackgroundFill(props.element)
    style.opacity = String(props.element.opacity)
    return style
  }

  /** Column 子项由父级 flex 均分高度（等价于 父高 / n），不参与网格/绝对像素叠放 */
  if (props.parent?.kind === 'column') {
    const style: Record<string, string> = { ...commonStyle }
    const isDComponent = props.element.kind === 'dcomponent'
    style.position = 'relative'
    style.left = '0'
    style.top = '0'
    style.width = '100%'
    style.flex = '1 1 0'
    style.minWidth = '0'
    style.minHeight = '0'
    style.display = 'flex'
    style.alignItems = 'center'
    style.justifyContent = 'center'
    style.height = 'auto'
    style.background = isDComponent ? 'transparent' : cssBackgroundFill(props.element)
    style.opacity = String(props.element.opacity)
    return style
  }

  const style: Record<string, string> = { ...commonStyle }
  const isDComponent = props.element.kind === 'dcomponent'
  const wh = cssWidthHeightStrings(props.element)
  if (props.layoutMode === 'grid') {
    const box = layoutPxBox.value
    const gp = gridPlacementForElement(
      { ...props.element, width: box.width, height: box.height },
      relativeX.value,
      relativeY.value,
      props.gridSize
    )
    /** 含子项的 flex 容器在网格模式下叠在格线上（和导出一致）；无子项时仍占网格元并用 flex 排版 */
    const flexGridAsAbsolute = props.element.flexLayoutEnabled && children.value.length > 0
    if (flexGridAsAbsolute) {
      style.position = 'absolute'
      style.left = `${relativeX.value}px`
      style.top = `${relativeY.value}px`
      style.zIndex = String(props.element.serial)
    } else if (!props.parent?.flexLayoutEnabled) {
      style.gridColumn = gp.gridColumn
      style.gridRow = gp.gridRow
    } else {
      style.flexShrink = '0'
    }
    style.width = wh.width
    style.height = wh.height
    applyParentBoundsClamp(style, props.element)
    style.background = isDComponent ? 'transparent' : cssBackgroundFill(props.element)
    style.opacity = String(props.element.opacity)
    if (!flexGridAsAbsolute) {
      style.position = 'relative'
    }
    if (
      props.element.kind === 'column' &&
      children.value.length > 0 &&
      !props.element.flexLayoutEnabled
    ) {
      style.display = 'flex'
      style.flexDirection = 'column'
      style.alignItems = 'stretch'
      style.justifyContent = 'flex-start'
    }
    if (props.element.flexLayoutEnabled) {
      applyFlexContainerToStyle(style, props.element)
      style.overflow =
        props.element.flexWrap === 'wrap' || props.element.flexWrap === 'wrap-reverse'
          ? 'auto'
          : 'hidden'
    }
    if (!props.element.flexLayoutEnabled) {
      applyLayoutCenterToInlineStyle(style, props.element, props.layoutMode)
    }
    return style
  }

  style.position = 'absolute'
  style.left = `${relativeX.value}px`
  style.top = `${relativeY.value}px`
  style.width = wh.width
  style.height = wh.height
  applyParentBoundsClamp(style, props.element)
  style.background = isDComponent ? 'transparent' : cssBackgroundFill(props.element)
  style.opacity = String(props.element.opacity)
  if (
    props.element.kind === 'column' &&
    children.value.length > 0 &&
    !props.element.flexLayoutEnabled
  ) {
    style.display = 'flex'
    style.flexDirection = 'column'
    style.alignItems = 'stretch'
    style.justifyContent = 'flex-start'
  }
  if (props.element.flexLayoutEnabled) {
    applyFlexContainerToStyle(style, props.element)
    style.overflow =
      props.element.flexWrap === 'wrap' || props.element.flexWrap === 'wrap-reverse'
        ? 'auto'
        : 'hidden'
  }
  if (!props.element.flexLayoutEnabled) {
    applyLayoutCenterToInlineStyle(style, props.element, props.layoutMode)
  }
  return style
})

const labelText = computed(() => props.element.text.trim())

/** 封装组件根节点需直接承载排版样式，设计器内才能与导出 CSS 一致 */
const dcomponentTypographyStyle = computed((): Record<string, string> => {
  if (props.element.kind !== 'dcomponent') return {}
  const st: Record<string, string> = {}
  if (props.element.color) st.color = props.element.color
  st.textAlign = props.element.textAlign ?? 'center'
  if (props.element.fontSize != null && props.element.fontSize > 0) {
    st.fontSize = `${props.element.fontSize}px`
  }
  if (props.element.fontWeight) st.fontWeight = props.element.fontWeight
  return st
})

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

const showTableResizeHandles = computed(
  () =>
    props.element.kind === 'table' &&
    props.selectedElementIds.includes(props.element.id) &&
    !!props.element.tableResizeEnabled
)

/** 列分割线位置（%），长度 cols-1 */
const colResizeHandleLeftPct = computed(() => {
  if (props.element.kind !== 'table') return [] as number[]
  const cols = tableCols.value
  const tw = Math.max(1, props.element.width)
  const ws: number[] = []
  for (let c = 0; c < cols; c += 1) {
    const cell = tableCellAt(0, c)
    ws.push(cell?.width && cell.width > 0 ? cell.width : tw / cols)
  }
  const sum = ws.reduce((a, b) => a + b, 0) || 1
  const out: number[] = []
  let acc = 0
  for (let i = 0; i < cols - 1; i += 1) {
    acc += (ws[i]! / sum) * 100
    out.push(acc)
  }
  return out
})

const rowResizeHandleTopPct = computed(() => {
  if (props.element.kind !== 'table') return [] as number[]
  const rows = tableRows.value
  const th = Math.max(1, props.element.height)
  const hs: number[] = []
  for (let r = 0; r < rows; r += 1) {
    const cell = tableCellAt(r, 0)
    hs.push(cell?.height && cell.height > 0 ? cell.height : th / rows)
  }
  const sum = hs.reduce((a, b) => a + b, 0) || 1
  const out: number[] = []
  let acc = 0
  for (let i = 0; i < rows - 1; i += 1) {
    acc += (hs[i]! / sum) * 100
    out.push(acc)
  }
  return out
})

function tableTrStyle(row: number): Record<string, string> {
  if (props.element.kind !== 'table') return {}
  const isOddRow = row % 2 === 0
  const st: Record<string, string> = {}
  if (props.element.tableTrOddBgEnabled && isOddRow) {
    st.background = props.element.tableTrOddBg?.trim() || '#e8eef5'
  } else if (props.element.tableTrEvenBgEnabled && !isOddRow) {
    st.background = props.element.tableTrEvenBg?.trim() || '#ffffff'
  }
  return st
}

function tableTdStyle(row: number, col: number): Record<string, string> {
  if (props.element.kind !== 'table') return {}
  const cell = tableCellAt(row, col)
  if (!cell) return {}
  const tw = Math.max(1, props.element.width)
  const th = Math.max(1, props.element.height)
  const cols = tableCols.value
  const rows = tableRows.value
  const ws: number[] = []
  for (let c = 0; c < cols; c += 1) {
    const cl = tableCellAt(0, c)
    ws.push(cl?.width && cl.width > 0 ? cl.width : tw / cols)
  }
  const hs: number[] = []
  for (let r = 0; r < rows; r += 1) {
    const cl = tableCellAt(r, 0)
    hs.push(cl?.height && cl.height > 0 ? cl.height : th / rows)
  }
  const sumW = ws.reduce((a, b) => a + b, 0) || 1
  const sumH = hs.reduce((a, b) => a + b, 0) || 1
  const wPct = ((ws[col] ?? 0) / sumW) * 100
  const hPct = ((hs[row] ?? 0) / sumH) * 100
  const st: Record<string, string> = {
    width: `${wPct}%`,
    height: `${hPct}%`
  }
  applyPaddingMarginToStyle(st, cell)
  const colOdd = col % 2 === 0
  if (props.element.tableTdOddBgEnabled && colOdd) {
    st.background = props.element.tableTdOddBg?.trim() || '#e8eef5'
  } else if (props.element.tableTdEvenBgEnabled && !colOdd) {
    st.background = props.element.tableTdEvenBg?.trim() || '#ffffff'
  }
  return st
}

function tableTdSlotWrapperStyle(row: number, col: number): Record<string, string> {
  const cell = tableCellAt(row, col)
  const base: Record<string, string> = {}
  if (cell?.flexLayoutEnabled) {
    applyFlexContainerToStyle(base, cell)
    base.width = '100%'
    base.height = '100%'
    base.minHeight = '0'
    base.boxSizing = 'border-box'
    base.position = 'relative'
    base.overflow =
      cell.flexWrap === 'wrap' || cell.flexWrap === 'wrap-reverse' ? 'auto' : 'hidden'
  }
  return base
}

/**
 * 已选中整张表：不拦截，让 mousedown 冒泡到表根以便拖动。
 * 未选中：仅当点中单元格槽位自身（非子元素）时不拦截，冒泡到表根以便再次选中表；
 * 子元素上的 mousedown 已由子节点 .stop 消化，不会进入此处。
 */
const tableSlotPointerHadTableSelected = ref(false)

const onTableCellSlotMouseDown = (e: MouseEvent): void => {
  const tableSelected = props.selectedElementIds.includes(props.element.id)
  tableSlotPointerHadTableSelected.value = tableSelected
  if (tableSelected) return
  if (e.target !== e.currentTarget) return
}

/** 仅在「按下时整张表已选中」时用 click 切换到单元格，避免未选表时空格点选后被 click 抢成单元格选中 */
const onTableCellSlotClick = (e: MouseEvent, row: number, col: number): void => {
  if (e.target !== e.currentTarget) return
  if (!tableSlotPointerHadTableSelected.value) return
  const cell = tableCellAt(row, col)
  if (!cell) return
  emit('select', cell.id, e)
}

/** children-layer 用 absolute + inset 铺满父盒；若父有 padding，inset 需设为四边 padding，否则子项会画进 padding 带里 */
function applyChildrenLayerInset(style: Record<string, string>, el: DesignElement): void {
  const p = effectivePaddingInsets(el)
  if (p.top === 0 && p.right === 0 && p.bottom === 0 && p.left === 0) {
    style.inset = '0'
  } else {
    style.top = `${p.top}px`
    style.right = `${p.right}px`
    style.bottom = `${p.bottom}px`
    style.left = `${p.left}px`
  }
}

const childContainerStyle = computed(() => {
  const style: Record<string, string> = {}
  if (children.value.length === 0) return style
  if (props.element.flexLayoutEnabled) {
    style.position = 'absolute'
    applyChildrenLayerInset(style, props.element)
    applyFlexContainerToStyle(style, props.element)
    style.boxSizing = 'border-box'
    style.overflow =
      props.element.flexWrap === 'wrap' || props.element.flexWrap === 'wrap-reverse'
        ? 'auto'
        : 'hidden'
    return style
  }
  if (props.element.kind === 'column') {
    style.position = 'absolute'
    applyChildrenLayerInset(style, props.element)
    style.display = 'flex'
    style.flexDirection = 'column'
    style.alignItems = 'stretch'
    style.boxSizing = 'border-box'
    style.overflow = 'hidden'
    return style
  }
  if (props.element.kind === 'image' && props.element.type === 'div') {
    style.position = 'absolute'
    applyChildrenLayerInset(style, props.element)
    style.display = 'flex'
    style.flexDirection = 'row'
    style.alignItems = 'center'
    style.gap = `${props.element.gap ?? 10}px`
    style.boxSizing = 'border-box'
    return style
  }
  if (props.layoutMode === 'grid') {
    const box = layoutPxBox.value
    style.position = 'absolute'
    applyChildrenLayerInset(style, props.element)
    style.display = 'grid'
    style.placeItems = 'center'
    style.gridTemplateColumns = `repeat(${Math.max(1, Math.floor(box.width / props.gridSize))}, ${props.gridSize}px)`
    style.gridTemplateRows = `repeat(${Math.max(1, Math.floor(box.height / props.gridSize))}, ${props.gridSize}px)`
    return style
  }
  style.position = 'absolute'
  applyChildrenLayerInset(style, props.element)
  return style
})
</script>

<template>
  <div
    v-if="element.type === 'img'"
    class="designer-element designer-element--img"
    :data-element-id="element.id"
    :class="{ active: selectedElementIds.includes(element.id) }"
    :style="nodeStyle"
    @mousedown.stop="emit('mousedown', $event, element)"
  >
    <img class="designer-img" :src="imgSrc" alt="" draggable="false" />
  </div>
  <div
    v-else-if="element.kind === 'table'"
    class="designer-element designer-element--table"
    :data-element-id="element.id"
    :class="{ active: selectedElementIds.includes(element.id) }"
    :style="{ ...nodeStyle, ...tableStyle }"
    @mousedown.stop="emit('mousedown', $event, element)"
  >
    <div class="designer-table-shell">
      <table class="designer-table">
        <tr
          v-for="ri in tableRows"
          :key="'tr-' + ri"
          :style="tableTrStyle(ri - 1)"
        >
          <td
            v-for="ci in tableCols"
            :key="'td-' + ri + '-' + ci"
            :style="tableTdStyle(ri - 1, ci - 1)"
          >
            <div
              v-if="tableCellAt(ri - 1, ci - 1)"
              class="designer-td-slot"
              :style="tableTdSlotWrapperStyle(ri - 1, ci - 1)"
              :data-element-id="tableCellAt(ri - 1, ci - 1)!.id"
              @mousedown="onTableCellSlotMouseDown"
              @click.self="onTableCellSlotClick($event, ri - 1, ci - 1)"
            >
              <DesignTreeNode
                v-for="sub in tableCellChildren(tableCellAt(ri - 1, ci - 1)!)"
                :key="sub.id"
                :element="sub"
                :elements="elements"
                :selected-element-ids="selectedElementIds"
                :layout-mode="layoutMode"
                :grid-size="gridSize"
                :surface-width="surfaceWidth"
                :surface-height="surfaceHeight"
                :parent="tableCellAt(ri - 1, ci - 1)"
                @select="(id, ev) => emit('select', id, ev)"
                @mousedown="(event, node) => emit('mousedown', event, node)"
              />
            </div>
          </td>
        </tr>
      </table>
      <div v-if="showTableResizeHandles" class="table-resize-overlay" aria-hidden="true">
        <div
          v-for="(pct, idx) in colResizeHandleLeftPct"
          :key="'col-edge-' + idx"
          class="table-resize-handle table-resize-handle--col"
          :style="{ left: pct + '%' }"
          title="拖拽调整列宽"
          @mousedown="onColResizeStart(idx + 1, $event)"
        />
        <div
          v-for="(pct, idx) in rowResizeHandleTopPct"
          :key="'row-edge-' + idx"
          class="table-resize-handle table-resize-handle--row"
          :style="{ top: pct + '%' }"
          title="拖拽调整行高"
          @mousedown="onRowResizeStart(idx + 1, $event)"
        />
      </div>
    </div>
  </div>
  <div
    v-else-if="element.kind === 'dcomponent'"
    class="designer-element designer-element--dcomponent"
    :data-element-id="element.id"
    :class="{ active: selectedElementIds.includes(element.id) }"
    :style="nodeStyle"
    @mousedown.stop="emit('mousedown', $event, element)"
  >
    <DButton
      v-if="element.componentKey === 'DButton'"
      class="dcomponent-root"
      :class="[element.id, element.componentClass?.trim()].filter(Boolean)"
      :style="dcomponentTypographyStyle"
      :surface-background="cssBackgroundFill(element)"
    />
    <DInput
      v-else-if="element.componentKey === 'DInput'"
      class="dcomponent-root"
      :class="[element.id, element.componentClass?.trim()].filter(Boolean)"
      :style="dcomponentTypographyStyle"
      :surface-background="cssBackgroundFill(element)"
    />
  </div>
  <div
    v-else
    class="designer-element"
    :data-element-id="element.id"
    :class="{ active: selectedElementIds.includes(element.id) }"
    :style="nodeStyle"
    @mousedown.stop="emit('mousedown', $event, element)"
  >
    <span v-if="labelText" class="element-label">
      <span class="element-label-inner">{{ labelText }}</span>
    </span>

    <div v-if="children.length" class="children-layer" :style="childContainerStyle">
      <DesignTreeNode
        v-for="child in children"
        :key="child.id"
        :element="child"
        :elements="elements"
        :selected-element-ids="selectedElementIds"
        :layout-mode="layoutMode"
        :grid-size="gridSize"
        :surface-width="surfaceWidth"
        :surface-height="surfaceHeight"
        :parent="element"
        @select="(id, ev) => emit('select', id, ev)"
        @mousedown="(event, node) => emit('mousedown', event, node)"
      />
    </div>
  </div>
</template>

<style scoped>
.designer-element {
  outline: 1px solid rgba(255, 255, 255, 0.3);
  outline-offset: -1px;
  color: #f1f4fb;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  overflow: hidden;
  box-sizing: border-box;
}

/* 选中框用 ::after 画在盒内，避免 outline 被 overflow:hidden 裁掉（与元素自身边框样式无关） */
.designer-element.active {
  outline: none;
  z-index: 100;
}

.designer-element.active::after {
  content: '';
  position: absolute;
  inset: 0;
  border: 2px dashed #7dd3fc;
  border-radius: inherit;
  box-sizing: border-box;
  pointer-events: none;
  z-index: 200;
}

.element-label {
  position: relative;
  z-index: 2;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  word-break: break-word;
  padding: 2px 4px;
  pointer-events: none;
  text-align: inherit;
  display: flex;
  align-items: center;
}

.element-label-inner {
  display: block;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  text-align: inherit;
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

.designer-table-shell {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
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

.table-resize-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 40;
}

.table-resize-handle {
  pointer-events: auto;
  position: absolute;
  box-sizing: border-box;
}

.table-resize-handle--col {
  top: 0;
  bottom: 0;
  width: 10px;
  transform: translateX(-50%);
  cursor: col-resize;
  background: transparent;
}

.table-resize-handle--col:hover {
  background: rgba(127, 212, 252, 0.35);
}

.table-resize-handle--row {
  left: 0;
  right: 0;
  height: 10px;
  transform: translateY(-50%);
  cursor: row-resize;
  background: transparent;
}

.table-resize-handle--row:hover {
  background: rgba(127, 212, 252, 0.35);
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
