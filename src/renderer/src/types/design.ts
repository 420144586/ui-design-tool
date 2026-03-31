export type LayoutMode = 'absolute' | 'grid' | 'flex'

export type ViewMode = 'design' | 'template' | 'script' | 'style'

/** 设计区工作区：标准（左侧元素库）或虚拟环境（左侧环境属性 + 中间设备框预览） */
export type WorkspaceMode = 'standard' | 'virtual-env'

/** 虚拟设备框在预览区内的 CSS position */
export type VirtualEnvPosition = 'relative' | 'absolute' | 'fixed' | 'static'

/** 集成业务页前的环境预览（尺寸、背景、顶栏/底栏占位等） */
export interface VirtualEnvConfig {
  /** 与画布尺寸同步保存，展示时以 canvas 为准 */
  width: number
  height: number
  background: string
  /** 设备外框在预览区内的 CSS position */
  position: VirtualEnvPosition
  /** 预设状态栏 / 标题栏占位 */
  presetTitleBar: boolean
  /** 预设底部栏占位 */
  presetFooter: boolean
  /** TitleBar 占位层的 CSS position（叠在满屏画布之上） */
  presetTitleBarPosition: VirtualEnvPosition
  /** Footer 占位层的 CSS position */
  presetFooterPosition: VirtualEnvPosition
  /** TitleBar 占位高度（px） */
  presetTitleBarHeight: number
  /** Footer 占位高度（px） */
  presetFooterHeight: number
}

/** 动画与 Vue Transition 的衔接方式（导出代码） */
export type AnimationTimingMode = 'visible' | 'hidden' | 'v-if' | 'v-show'

/** 内置动画预设（生成 CSS 与 Transition 类名） */
export type AnimationPreset =
  | 'fade'
  | 'slide'
  | 'slide-left'
  | 'zoom'
  | 'bounce'
  | 'elastic'
  | 'flip'

export interface CanvasConfig {
  width: number
  height: number
  gridSize: number
  layoutMode: LayoutMode
  zoom: number
}

export interface DesignElement {
  id: string
  /** 导出 HTML/CSS 使用的主 class（有意义、可改）；设计器 data-element-id 仍用 id */
  domClass?: string
  serial: number
  parentId: string | null
  kind: PresetKind
  type: 'div' | 'img' | 'table'
  name: string
  x: number
  y: number
  width: number
  height: number
  /** 为 true 时 width 表示父级内容宽度（根级为设计表面宽度）的百分比 */
  widthIsPercent?: boolean
  /** 为 true 时 height 表示父级内容高度（根级为设计表面高度）的百分比 */
  heightIsPercent?: boolean
  background: string
  /** 为 true 时背景填充为 transparent，保留 background / 渐变数据便于取消勾选后恢复 */
  backgroundTransparent?: boolean
  text: string
  opacity: number
  childCount?: number
  /** image 容器：是否带右侧文案区；子 img 为左侧 30×30 */
  hasLabel?: boolean
  /** image 容器：左右间距 px */
  gap?: number
  /** 图片地址（image 容器与其 img 子节点共用，重建子节点时会同步） */
  imageSrc?: string
  /** table 元素 */
  tableRows?: number
  tableCols?: number
  /** 表格单元格边框颜色 */
  borderColor?: string
  /** 所有 td 统一内边距（px）；不设时：flex 导出默认 2px，fixed 网格导出默认 0 */
  tableTdPadding?: number
  /** td 边框宽度（px），默认可视作 1 */
  tableTdBorderWidth?: number
  /** td 边框样式（与 borderStyle 取值一致） */
  tableTdBorderStyle?: 'none' | 'solid' | 'dashed' | 'dotted'
  /** td 内文字颜色 */
  tableCellTextColor?: string
  /** tr 最小高度（px），可选 */
  tableTrMinHeight?: number
  /** tr:nth-child(odd) 行背景 */
  tableTrOddBgEnabled?: boolean
  tableTrOddBg?: string
  /** tr:nth-child(even) 行背景 */
  tableTrEvenBgEnabled?: boolean
  tableTrEvenBg?: string
  /** td:nth-child(odd) 列背景（每行内第 1、3、5… 列） */
  tableTdOddBgEnabled?: boolean
  tableTdOddBg?: string
  /** td:nth-child(even) 列背景 */
  tableTdEvenBgEnabled?: boolean
  tableTdEvenBg?: string
  /** 表格单元格占位节点（设计数据），导出 HTML 时不单独生成该节点 */
  isTableCell?: boolean
  tableCellRow?: number
  tableCellCol?: number
  /** 封装组件标识，如 DButton、DInput */
  componentKey?: string
  /** 追加到封装组件根节点上的 class，用于覆盖组件默认样式（空格分隔） */
  componentClass?: string
  /** 是否使用渐变背景 */
  isGradient?: boolean
  /** 渐变类型 */
  gradientType?: 'linear' | 'radial'
  /** 线性渐变角度 */
  gradientAngle?: number
  /** 渐变颜色列表 */
  gradientColors?: string[]
  /** 文本颜色 */
  color?: string
  /** 字体大小 */
  fontSize?: number
  /** 字体粗细 */
  fontWeight?: string
  /** 文本对齐 */
  textAlign?: 'left' | 'center' | 'right' | 'justify'
  /** 圆角 */
  borderRadius?: number
  /** 盒模型：border-box 时边框计入宽高，不易撑出父容器；未设置时设计器按 border-box 渲染 */
  boxSizing?: 'content-box' | 'border-box'
  /** 边框宽度 */
  borderWidth?: number
  /** 边框样式 */
  borderStyle?: 'none' | 'solid' | 'dashed' | 'dotted'
  /** 是否显示上边边框（false 为不显示；未设置时默认四边均显示） */
  borderTop?: boolean
  borderRight?: boolean
  borderBottom?: boolean
  borderLeft?: boolean
  /** 内边距（px），未设置视为 0 */
  paddingTop?: number
  paddingRight?: number
  paddingBottom?: number
  paddingLeft?: number
  /** 外边距（px），未设置视为 0 */
  marginTop?: number
  marginRight?: number
  marginBottom?: number
  marginLeft?: number
  /** 为 false 时不生成该侧的 padding（与四边数值配合，类似边框「显示边」） */
  paddingUseTop?: boolean
  paddingUseRight?: boolean
  paddingUseBottom?: boolean
  paddingUseLeft?: boolean
  /** 为 false 时不生成该侧的 margin */
  marginUseTop?: boolean
  marginUseRight?: boolean
  marginUseBottom?: boolean
  marginUseLeft?: boolean
  /** 在父容器内水平居中（absolute：left:50%+translateX；grid：justify-self） */
  layoutCenterHorizontal?: boolean
  /** 在父容器内垂直居中（absolute：top:50%+translateY；grid：align-self） */
  layoutCenterVertical?: boolean
  /** 子级容器使用 flex 布局（children-layer / 表格单元格槽位） */
  flexLayoutEnabled?: boolean
  /** 子级容器使用与设计器 Grid 模式相同的网格排版（与 flexLayoutEnabled 互斥；全局 Flex 画布下由属性面板「Grid」勾选） */
  gridLayoutForChildren?: boolean
  /** Flex 画布自动生成的最外层根容器（唯一；删壳时会提升其子节点为顶层） */
  isFlexPageShell?: boolean
  flexDirection?: FlexDirection
  flexWrap?: FlexWrap
  justifyContent?: JustifyContent
  alignItems?: AlignItems
  alignContent?: AlignContent
  /** flex 子项间距（px） */
  flexGap?: number
  /** 是否启用导出动画（Vue Transition + CSS） */
  animationEnabled?: boolean
  /** 动画触发方式：visible=appear 入场；hidden/v-if/v-show 与脚本 animShow 联动 */
  animationTimingMode?: AnimationTimingMode
  /** 动画预设类型 */
  animationPreset?: AnimationPreset
  /** 动画时长 ms */
  animationDurationMs?: number
  /** cubic-bezier 控制点 */
  animationBezierX1?: number
  animationBezierY1?: number
  animationBezierX2?: number
  animationBezierY2?: number
}

export type FlexDirection = 'row' | 'row-reverse' | 'column' | 'column-reverse'
export type FlexWrap = 'nowrap' | 'wrap' | 'wrap-reverse'
export type JustifyContent =
  | 'flex-start'
  | 'flex-end'
  | 'center'
  | 'space-between'
  | 'space-around'
  | 'space-evenly'
export type AlignItems = 'stretch' | 'flex-start' | 'flex-end' | 'center' | 'baseline'
export type AlignContent =
  | 'stretch'
  | 'flex-start'
  | 'flex-end'
  | 'center'
  | 'space-between'
  | 'space-around'
  | 'space-evenly'

export type PresetKind = 'div' | 'column' | 'image' | 'table' | 'dcomponent'

export interface BasePreset {
  kind: PresetKind
  type: 'div'
  name: string
  width: number
  height: number
  background: string
  /** 为 true 时不输出背景色（表格等默认无填充） */
  backgroundTransparent?: boolean
  text: string
  opacity: number
}

export interface DivPreset extends BasePreset {
  kind: 'div'
}

export interface ColumnPreset extends BasePreset {
  kind: 'column'
  childCount: number
}

export interface ImagePreset extends BasePreset {
  kind: 'image'
  hasLabel: boolean
  gap: number
  imageSrc?: string
}

export interface TablePreset extends Omit<BasePreset, 'type'> {
  kind: 'table'
  type: 'table'
  tableRows: number
  tableCols: number
  borderColor: string
}

export interface DComponentPreset extends BasePreset {
  kind: 'dcomponent'
  componentKey: string
}

export type ElementPreset =
  | DivPreset
  | ColumnPreset
  | ImagePreset
  | TablePreset
  | DComponentPreset

export interface DragPreview {
  visible: boolean
  x: number
  y: number
  width: number
  height: number
}
