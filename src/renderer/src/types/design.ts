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
  type: 'div'
  name: string
  x: number
  y: number
  width: number
  height: number
  background: string
  text: string
  opacity: number
}

export type ElementPreset = Pick<
  DesignElement,
  'type' | 'name' | 'width' | 'height' | 'background' | 'text' | 'opacity'
>

export interface DragPreview {
  visible: boolean
  x: number
  y: number
  width: number
  height: number
}
