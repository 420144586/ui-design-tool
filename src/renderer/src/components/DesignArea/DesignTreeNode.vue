<script setup lang="ts">
import { computed, ref } from 'vue'
import type { DesignElement, LayoutMode } from '@renderer/types/design'
import DButton from '@renderer/D-components/DButton.vue'
import DInput from '@renderer/D-components/DInput.vue'
import { cssBackgroundFill } from '@renderer/utils/elementBackground'
import { applyBoxBorderToStyle, isBorderSideEnabled } from '@renderer/utils/elementBorder'
import { applyLayoutCenterToInlineStyle, gridPlacementForElement } from '@renderer/utils/layoutCenter'
import { cssWidthHeightStrings, resolveElementLayoutPxBox } from '@renderer/utils/elementLayoutSize'
import { applyPaddingMarginToStyle, effectivePaddingInsets } from '@renderer/utils/elementSpacing'
import { applyFlexContainerToStyle, sortSiblingsForRenderOrder } from '@renderer/utils/elementFlex'
import { elementDomClass } from '@renderer/utils/elementClassStrategy'
import { resolveTableCols, resolveTableRows } from '@renderer/utils/tableDimensions'

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

const children = computed(() => sortSiblingsForRenderOrder(props.elements, props.element.id))

/** 全局 Grid 或父级勾选「子级 Grid」时，子项走网格占位（与 codegen shouldUseGridPlacementCss 一致） */
const useGridLikePlacement = computed(
  () => props.layoutMode === 'grid' || props.parent?.gridLayoutForChildren === true
)

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

  /** Flex 画布：表格统一相对定位 + flex 子项（避免落入 absolute 叠放，含嵌在列等容器内） */
  if (props.element.kind === 'table' && props.layoutMode === 'flex') {
    const style: Record<string, string> = { ...commonStyle }
    const wh = cssWidthHeightStrings(props.element)
    style.position = 'relative'
    style.width = wh.width
    style.height = wh.height
    style.flexShrink = '0'
    applyParentBoundsClamp(style, props.element)
    if (
      !props.element.backgroundTransparent &&
      String(props.element.background ?? '').trim() &&
      String(props.element.background ?? '').trim().toLowerCase() !== 'transparent'
    ) {
      style.background = cssBackgroundFill(props.element)
    }
    style.opacity = String(props.element.opacity)
    return style
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

  /** Flex 画布根节点：作为 .layer flex 容器内的子项，与导出 rootStackingCss 一致 */
  if (!props.parent && props.layoutMode === 'flex') {
    const style: Record<string, string> = { ...commonStyle }
    const isDComponent = props.element.kind === 'dcomponent'
    const wh = cssWidthHeightStrings(props.element)
    style.position = 'relative'
    style.zIndex = String(props.element.serial)
    /** 画布容器：满铺 .layer，与画布可视区域完全重叠（数据宽高仍用于导出与命中） */
    if (props.element.isFlexPageShell) {
      style.width = '100%'
      style.height = '100%'
      style.flex = '1 1 auto'
      style.flexShrink = '1'
      style.minWidth = '0'
      style.minHeight = '0'
      style.alignSelf = 'stretch'
    } else {
      style.flexShrink = '0'
      style.width = wh.width
      style.height = wh.height
    }
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
  }

  const style: Record<string, string> = { ...commonStyle }
  const isDComponent = props.element.kind === 'dcomponent'
  const wh = cssWidthHeightStrings(props.element)
  if (useGridLikePlacement.value) {
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

/** 表格行列数（与 store / 导出一致） */
const tableRowCount = computed(() => resolveTableRows(props.element.tableRows))
const tableColCount = computed(() => resolveTableCols(props.element.tableCols))
/** 0 .. n-1，模板用 v-for 避免把「行数」误当作可迭代对象 */
const tableRowIndices = computed(() =>
  Array.from({ length: tableRowCount.value }, (_, i) => i)
)
const tableColIndices = computed(() =>
  Array.from({ length: tableColCount.value }, (_, i) => i)
)
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

/** 与导出一致的 td 边框、内边距、文字色 */
function applyTableTdSharedVisual(st: Record<string, string>, cell: DesignElement): void {
  const borderColor = props.element.borderColor ?? '#d0d0d0'
  const bwRaw = props.element.tableTdBorderWidth
  const bw =
    bwRaw != null && Number.isFinite(bwRaw) && bwRaw >= 0 ? Math.floor(bwRaw) : 1
  const bs = props.element.tableTdBorderStyle ?? 'solid'
  if (bw === 0 || bs === 'none') st.border = 'none'
  else st.border = `${bw}px ${bs} ${borderColor}`
  const tc = props.element.tableCellTextColor?.trim()
  if (tc) st.color = tc
  applyPaddingMarginToStyle(st, cell)
  const tp = props.element.tableTdPadding
  if (tp != null && Number.isFinite(tp) && tp >= 0) {
    st.padding = `${Math.floor(tp)}px`
  } else if (!st.padding && !st.paddingTop) {
    st.padding = props.layoutMode === 'flex' ? '2px' : '0px'
  }
}

function tableTrStyle(row: number): Record<string, string> {
  if (props.element.kind !== 'table') return {}
  const isOddRow = row % 2 === 0
  const st: Record<string, string> = {}
  const trMin = props.element.tableTrMinHeight
  if (trMin != null && Number.isFinite(trMin) && trMin > 0) {
    st.minHeight = `${Math.floor(trMin)}px`
  }
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
  const st: Record<string, string> = {}
  const tw = Math.max(1, props.element.width)
  const th = Math.max(1, props.element.height)
  const cols = tableColCount.value
  const rows = tableRowCount.value
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
  st.width = `${wPct}%`
  st.height = `${hPct}%`
  applyTableTdSharedVisual(st, cell)
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
    base.boxSizing = 'border-box'
    base.position = 'relative'
    base.overflow =
      cell.flexWrap === 'wrap' || cell.flexWrap === 'wrap-reverse' ? 'auto' : 'hidden'
    if (props.layoutMode === 'flex') {
      base.minWidth = '0'
      base.minHeight = '0'
    } else {
      base.width = '100%'
      base.height = '100%'
      base.minHeight = '0'
    }
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
    applyFlexContainerToStyle(style, props.element)
    style.boxSizing = 'border-box'
    style.overflow =
      props.element.flexWrap === 'wrap' || props.element.flexWrap === 'wrap-reverse'
        ? 'auto'
        : 'hidden'
    if (props.layoutMode === 'flex') {
      style.position = 'relative'
      style.flex = '1 1 auto'
      style.minWidth = '0'
      style.minHeight = '0'
      style.width = '100%'
      style.height = '100%'
      style.alignSelf = 'stretch'
      return style
    }
    style.position = 'absolute'
    applyChildrenLayerInset(style, props.element)
    return style
  }
  if (props.element.kind === 'column') {
    if (props.layoutMode === 'flex') {
      style.position = 'relative'
      style.flex = '1 1 auto'
      style.minWidth = '0'
      style.minHeight = '0'
      style.width = '100%'
      style.height = '100%'
      style.alignSelf = 'stretch'
      style.display = 'flex'
      style.flexDirection = 'column'
      style.alignItems = 'stretch'
      style.boxSizing = 'border-box'
      style.overflow = 'hidden'
      return style
    }
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
    if (props.layoutMode === 'flex') {
      style.position = 'relative'
      style.flex = '1 1 auto'
      style.minWidth = '0'
      style.minHeight = '0'
      style.width = '100%'
      style.height = '100%'
      style.alignSelf = 'stretch'
      style.display = 'flex'
      style.flexDirection = 'row'
      style.alignItems = 'center'
      style.gap = `${props.element.gap ?? 10}px`
      style.boxSizing = 'border-box'
      return style
    }
    style.position = 'absolute'
    applyChildrenLayerInset(style, props.element)
    style.display = 'flex'
    style.flexDirection = 'row'
    style.alignItems = 'center'
    style.gap = `${props.element.gap ?? 10}px`
    style.boxSizing = 'border-box'
    return style
  }
  if (props.layoutMode === 'grid' || props.element.gridLayoutForChildren) {
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
    :style="nodeStyle"
    @mousedown.stop="emit('mousedown', $event, element)"
  >
    <div
      class="designer-table-shell"
      :class="{ 'designer-table-shell--flex-native': layoutMode === 'flex' }"
    >
      <table
        class="designer-table"
        :class="{ 'designer-table--flex-native': layoutMode === 'flex' }"
      >
        <tbody>
          <tr
            v-for="r in tableRowIndices"
            :key="'tr-' + r"
            :style="tableTrStyle(r)"
          >
            <td
              v-for="c in tableColIndices"
              :key="'td-' + r + '-' + c"
              :style="tableTdStyle(r, c)"
            >
              <div
                v-if="tableCellAt(r, c)"
                class="designer-td-slot"
                :style="tableTdSlotWrapperStyle(r, c)"
                :data-element-id="tableCellAt(r, c)!.id"
                @mousedown="onTableCellSlotMouseDown"
                @click.self="onTableCellSlotClick($event, r, c)"
              >
                <DesignTreeNode
                  v-for="sub in tableCellChildren(tableCellAt(r, c)!)"
                  :key="sub.id"
                  :element="sub"
                  :elements="elements"
                  :selected-element-ids="selectedElementIds"
                  :layout-mode="layoutMode"
                  :grid-size="gridSize"
                  :surface-width="surfaceWidth"
                  :surface-height="surfaceHeight"
                  :parent="tableCellAt(r, c)"
                  @select="(id, ev) => emit('select', id, ev)"
                  @mousedown="(event, node) => emit('mousedown', event, node)"
                />
              </div>
            </td>
          </tr>
        </tbody>
      </table>
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
      :class="[elementDomClass(element), element.componentClass?.trim()].filter(Boolean)"
      :style="dcomponentTypographyStyle"
      :surface-background="cssBackgroundFill(element)"
    />
    <DInput
      v-else-if="element.componentKey === 'DInput'"
      class="dcomponent-root"
      :class="[elementDomClass(element), element.componentClass?.trim()].filter(Boolean)"
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

/**
 * 子层需参与命中（auto），否则在 flex-direction 等样式重排后，部分环境下会出现子项无法稳定接收点击。
 * 点到子层空白处时事件会冒泡到外层 .designer-element，仍可选中父容器。
 */
.children-layer {
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

/** Flex 画布：表壳填满元素盒，表格高度与导出一致 */
.designer-table-shell--flex-native {
  height: 100%;
  min-height: 0;
}

.designer-table {
  width: 100%;
  height: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.designer-table--flex-native {
  width: 100%;
  height: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.designer-table td {
  vertical-align: top;
  /** 边框与 padding 由内联样式与属性面板「表格单元格」一致 */
}

.designer-td-slot {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 100%;
  box-sizing: border-box;
  pointer-events: auto;
}

.designer-table--flex-native .designer-td-slot {
  width: 100%;
  height: 100%;
  min-height: 0;
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
