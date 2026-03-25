export type LayoutMode = 'absolute' | 'grid'

export type ViewMode = 'design' | 'template' | 'script' | 'style'

export interface CanvasConfig {
  width: number
  height: number
  gridSize: number
  layoutMode: LayoutMode
  zoom: number
}

export interface DesignElement {
  id: string
  serial: number
  parentId: string | null
  kind: PresetKind
  type: 'div' | 'img' | 'table'
  name: string
  x: number
  y: number
  width: number
  height: number
  background: string
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
  /** 表格单元格占位节点（设计数据），导出 HTML 时不单独生成该节点 */
  isTableCell?: boolean
  tableCellRow?: number
  tableCellCol?: number
  /** 封装组件标识，如 DButton */
  componentKey?: string
  /** 追加到封装组件根节点上的 class，用于覆盖组件默认样式（空格分隔） */
  componentClass?: string
}

export type PresetKind = 'div' | 'column' | 'image' | 'table' | 'dcomponent'

export interface BasePreset {
  kind: PresetKind
  type: 'div'
  name: string
  width: number
  height: number
  background: string
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
