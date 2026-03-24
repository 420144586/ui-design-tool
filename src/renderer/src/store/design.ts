import { defineStore } from 'pinia'
import type {
  CanvasConfig,
  DesignElement,
  DragPreview,
  ElementPreset,
  LayoutMode,
  ViewMode
} from '@renderer/types/design'

const uid = (): string => `el-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
const isInside = (
  target: { x: number; y: number; width: number; height: number },
  container: { x: number; y: number; width: number; height: number }
): boolean =>
  target.x >= container.x &&
  target.y >= container.y &&
  target.x + target.width <= container.x + container.width &&
  target.y + target.height <= container.y + container.height

const defaultCanvas: CanvasConfig = {
  width: 1920,
  height: 1080,
  gridSize: 10,
  layoutMode: 'grid',
  zoom: 1
}

const defaultPreview: DragPreview = {
  visible: false,
  x: 0,
  y: 0,
  width: 100,
  height: 100
}

export const useDesignStore = defineStore('design', {
  state: () => ({
    activeView: 'design' as ViewMode,
    canvas: { ...defaultCanvas },
    elements: [] as DesignElement[],
    nextSerial: 1,
    selectedElementId: '' as string,
    dragPreview: { ...defaultPreview },
    activePreset: null as ElementPreset | null
  }),
  getters: {
    selectedElement: (state): DesignElement | undefined =>
      state.elements.find((item) => item.id === state.selectedElementId)
  },
  actions: {
    setActiveView(view: ViewMode): void {
      this.activeView = view
    },
    setActivePreset(preset: ElementPreset | null): void {
      this.activePreset = preset
      if (preset) {
        this.setDragPreview({
          width: preset.width,
          height: preset.height
        })
      }
    },
    setLayoutMode(layoutMode: LayoutMode): void {
      this.canvas.layoutMode = layoutMode
    },
    setCanvasPreset(preset: '1920x1080' | '800x600'): void {
      if (preset === '800x600') {
        this.canvas.width = 800
        this.canvas.height = 600
        return
      }
      this.canvas.width = 1920
      this.canvas.height = 1080
    },
    setZoom(zoom: number): void {
      this.canvas.zoom = Math.min(2, Math.max(0.25, zoom))
    },
    adjustZoom(delta: number): void {
      this.setZoom(this.canvas.zoom + delta)
    },
    addElement(element: Omit<DesignElement, 'id' | 'serial' | 'parentId'>): DesignElement {
      const candidates = this.elements.filter((item) => isInside(element, item))
      const parent = candidates.sort((a, b) => a.width * a.height - b.width * b.height)[0]
      const nextElement: DesignElement = {
        ...element,
        id: uid(),
        serial: this.nextSerial++,
        parentId: parent?.id ?? null
      }
      this.elements.push(nextElement)
      this.selectedElementId = nextElement.id
      return nextElement
    },
    updateElement(id: string, payload: Partial<DesignElement>): void {
      const target = this.elements.find((item) => item.id === id)
      if (!target) return
      Object.assign(target, payload)
    },
    selectElement(id: string): void {
      this.selectedElementId = id
    },
    clearSelection(): void {
      this.selectedElementId = ''
    },
    deleteSelectedElement(): void {
      if (!this.selectedElementId) return
      this.elements = this.elements.filter((item) => item.id !== this.selectedElementId)
      this.selectedElementId = ''
    },
    duplicateSelectedElement(): void {
      const selected = this.selectedElement
      if (!selected) return
      const { id, serial, parentId, ...rest } = selected
      void id
      void serial
      void parentId
      this.addElement({
        ...rest,
        x: rest.x + this.canvas.gridSize,
        y: rest.y + this.canvas.gridSize
      })
    },
    snap(value: number): number {
      return Math.max(0, Math.round(value / this.canvas.gridSize) * this.canvas.gridSize)
    },
    setDragPreview(value: Partial<DragPreview>): void {
      this.dragPreview = { ...this.dragPreview, ...value }
    },
    clearDragPreview(): void {
      this.dragPreview = { ...defaultPreview }
    }
  }
})
