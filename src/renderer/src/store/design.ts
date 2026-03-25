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
    updateActivePreset(patch: Partial<ElementPreset>): void {
      if (!this.activePreset) return
      this.activePreset = { ...this.activePreset, ...patch } as ElementPreset
      if ('width' in patch || 'height' in patch) {
        this.setDragPreview({
          width: this.activePreset.width,
          height: this.activePreset.height
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
    resolveParentForNewElement(
      rect: { x: number; y: number; width: number; height: number },
      hitElementId?: string | null
    ): string | null {
      const findEl = (id: string): DesignElement | undefined =>
        this.elements.find((item) => item.id === id)

      if (hitElementId) {
        let cur: DesignElement | undefined = findEl(hitElementId)
        while (cur) {
          if (isInside(rect, cur)) return cur.id
          const pid = cur.parentId
          cur = pid ? findEl(pid) : undefined
        }
      }

      const candidates = this.elements.filter((item) => isInside(rect, item))
      const parent = candidates.sort((a, b) => a.width * a.height - b.width * b.height)[0]
      return parent?.id ?? null
    },
    addElement(
      element: Omit<DesignElement, 'id' | 'serial' | 'parentId'>,
      options?: { select?: boolean; parentId?: string | null; hitElementId?: string | null }
    ): DesignElement {
      let parentId: string | null
      if (options?.parentId !== undefined) {
        parentId = options.parentId
      } else {
        parentId = this.resolveParentForNewElement(element, options?.hitElementId ?? null)
      }
      const nextElement: DesignElement = {
        ...element,
        id: uid(),
        serial: this.nextSerial++,
        parentId
      }
      this.elements.push(nextElement)
      if (options?.select !== false) {
        this.selectedElementId = nextElement.id
      }
      return nextElement
    },
    replaceElements(elements: DesignElement[]): void {
      this.elements = elements
      this.selectedElementId = ''
      const maxSerial = elements.reduce((max, item) => Math.max(max, item.serial), 0)
      this.nextSerial = maxSerial + 1
    },
    updateElement(id: string, payload: Partial<DesignElement>): void {
      const target = this.elements.find((item) => item.id === id)
      if (!target) return
      const oldX = target.x
      const oldY = target.y
      Object.assign(target, payload)
      if (payload.x !== undefined || payload.y !== undefined) {
        const dx = target.x - oldX
        const dy = target.y - oldY
        // 子节点存的是画布绝对坐标；表格由 syncTableCellsLayout 统一重算单元格，勿重复平移
        if ((dx !== 0 || dy !== 0) && target.kind !== 'table') {
          this.shiftDescendants(target.id, dx, dy)
        }
      }
      if (target.type === 'img' && target.parentId && payload.imageSrc !== undefined) {
        const parent = this.elements.find((item) => item.id === target.parentId)
        if (parent?.kind === 'image') {
          parent.imageSrc = String(payload.imageSrc ?? '')
        }
      }
      if (target.kind === 'image' && target.type === 'div' && target.hasLabel) {
        const structural: (keyof DesignElement)[] = [
          'hasLabel',
          'gap',
          'width',
          'height',
          'imageSrc'
        ]
        if (structural.some((key) => key in payload && payload[key] !== undefined)) {
          this.rebuildImageChildren(id)
        }
      }
      if (target.kind === 'table') {
        const structuralKey = ['tableRows', 'tableCols'] as const
        if (structuralKey.some((key) => key in payload && payload[key] !== undefined)) {
          this.rebuildTableCells(id)
        } else {
          const haveCells = this.elements.some(
            (e) => e.parentId === target.id && e.isTableCell
          )
          if (!haveCells) {
            this.initTableCells(target.id)
          } else {
            const layoutKeys = ['width', 'height', 'x', 'y'] as const
            if (layoutKeys.some((key) => key in payload && payload[key] !== undefined)) {
              this.syncTableCellsLayout(target.id)
            }
          }
        }
      }
    },
    shiftDescendants(rootId: string, dx: number, dy: number): void {
      this.elements
        .filter((item) => item.parentId === rootId)
        .forEach((ch) => {
          ch.x += dx
          ch.y += dy
          this.shiftDescendants(ch.id, dx, dy)
        })
    },
    /** nodeId 是否位于 ancestorId 的子树中（直连或更深） */
    isDescendantOf(ancestorId: string, nodeId: string): boolean {
      let cur: DesignElement | undefined = this.elements.find((item) => item.id === nodeId)
      while (cur?.parentId) {
        const pid = cur.parentId
        if (pid === ancestorId) return true
        cur = this.elements.find((item) => item.id === pid)
      }
      return false
    },
    /**
     * 将子节点挂到新父级下，x/y 为画布绝对坐标，保持不变以维持视觉位置。
     */
    reparentElement(childId: string, newParentId: string): void {
      if (childId === newParentId) return
      const child = this.elements.find((item) => item.id === childId)
      const parent = this.elements.find((item) => item.id === newParentId)
      if (!child || !parent) return
      if (this.isDescendantOf(childId, newParentId)) return
      if (parent.kind === 'table') return
      child.parentId = newParentId
      this.selectedElementId = childId
    },
    syncTableCellsLayout(tableId: string): void {
      const t = this.elements.find((item) => item.id === tableId)
      if (!t || t.kind !== 'table') return
      const rows = Math.max(1, Math.floor(Number(t.tableRows) || 5))
      const cols = Math.max(1, Math.floor(Number(t.tableCols) || 5))
      const cw = t.width / cols
      const ch = t.height / rows
      this.elements.forEach((cell) => {
        if (cell.parentId !== tableId || !cell.isTableCell) return
        const r = cell.tableCellRow ?? 0
        const c = cell.tableCellCol ?? 0
        const nx = t.x + c * cw
        const ny = t.y + r * ch
        const dx = nx - cell.x
        const dy = ny - cell.y
        cell.x = nx
        cell.y = ny
        cell.width = cw
        cell.height = ch
        if (dx !== 0 || dy !== 0) {
          this.shiftDescendants(cell.id, dx, dy)
        }
      })
    },
    initTableCells(tableId: string): void {
      const t = this.elements.find((item) => item.id === tableId)
      if (!t || t.kind !== 'table') return
      const rows = Math.max(1, Math.floor(Number(t.tableRows) || 5))
      const cols = Math.max(1, Math.floor(Number(t.tableCols) || 5))
      const cw = t.width / cols
      const ch = t.height / rows
      for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
          this.addElement(
            {
              kind: 'div',
              type: 'div',
              name: `TableCell-${t.serial}-${r}-${c}`,
              x: t.x + c * cw,
              y: t.y + r * ch,
              width: cw,
              height: ch,
              background: 'transparent',
              text: '',
              opacity: 1,
              isTableCell: true,
              tableCellRow: r,
              tableCellCol: c
            },
            { select: false, parentId: tableId }
          )
        }
      }
    },
    rebuildTableCells(tableId: string): void {
      const t = this.elements.find((item) => item.id === tableId)
      if (!t || t.kind !== 'table') return
      const toDrop = new Set<string>()
      const walk = (eid: string): void => {
        toDrop.add(eid)
        this.elements.filter((item) => item.parentId === eid).forEach((ch) => walk(ch.id))
      }
      this.elements
        .filter((item) => item.parentId === tableId && item.isTableCell)
        .forEach((cell) => walk(cell.id))
      this.elements = this.elements.filter((item) => !toDrop.has(item.id))
      this.initTableCells(tableId)
      this.selectedElementId = tableId
    },
    setImageHasLabelForSelectedStyle(id: string, hasLabel: boolean): void {
      const el = this.elements.find((item) => item.id === id)
      if (!el || el.kind !== 'image') return

      if (el.type === 'img') {
        if (!hasLabel) return
        const pid = el.parentId
        const { x, y, opacity, imageSrc, name } = el
        this.elements = this.elements.filter((item) => item.id !== el.id)
        const container = this.addElement(
          {
            kind: 'image',
            type: 'div',
            name,
            x,
            y,
            width: 130,
            height: 50,
            background: 'transparent',
            text: '',
            opacity,
            hasLabel: true,
            gap: 10,
            imageSrc: imageSrc ?? ''
          },
          { parentId: pid, select: false }
        )
        this.rebuildImageChildren(container.id)
        this.selectedElementId = container.id
        return
      }

      if (el.type !== 'div') return

      if (!hasLabel) {
        const pid = el.parentId
        const imgChild = this.elements.find((c) => c.parentId === el.id && c.type === 'img')
        const src = el.imageSrc ?? imgChild?.imageSrc ?? ''
        const { x, y, opacity, name } = el
        this.elements = this.elements.filter((item) => item.id !== el.id && item.parentId !== el.id)
        const img = this.addElement(
          {
            kind: 'image',
            type: 'img',
            name,
            x,
            y,
            width: 30,
            height: 30,
            background: 'transparent',
            text: '',
            opacity,
            imageSrc: src
          },
          { parentId: pid, select: false }
        )
        this.selectedElementId = img.id
        return
      }

      Object.assign(el, { hasLabel: true, width: 130, height: 50, gap: el.gap ?? 10 })
      this.rebuildImageChildren(el.id)
      this.selectedElementId = el.id
    },
    selectElement(id: string): void {
      this.selectedElementId = id
    },
    clearSelection(): void {
      this.selectedElementId = ''
    },
    deleteSelectedElement(): void {
      if (!this.selectedElementId) return
      const toDrop = new Set<string>()
      const walk = (id: string): void => {
        toDrop.add(id)
        this.elements.filter((item) => item.parentId === id).forEach((ch) => walk(ch.id))
      }
      walk(this.selectedElementId)
      this.elements = this.elements.filter((item) => !toDrop.has(item.id))
      this.selectedElementId = ''
    },
    duplicateSelectedElement(): void {
      const selected = this.selectedElement
      if (!selected) return
      const { id, serial, parentId, ...rest } = selected
      void id
      void serial
      this.addElement(
        {
          ...rest,
          x: rest.x + this.canvas.gridSize,
          y: rest.y + this.canvas.gridSize
        },
        { parentId: parentId ?? null }
      )
    },
    updateColumnChildCount(containerId: string, nextCount: number): void {
      const container = this.elements.find((item) => item.id === containerId)
      if (!container) return
      if (container.kind !== 'column') return

      const raw = Math.floor(Number(nextCount))
      const count = Number.isFinite(raw) ? Math.max(1, raw) : 1
      container.childCount = count

      // remove existing children, keep container
      this.elements = this.elements.filter((item) => item.id === containerId || item.parentId !== containerId)

      const grid = this.canvas.gridSize
      const containerH = container.height
      const childBaseH = Math.max(grid, Math.floor(containerH / count / grid) * grid)

      for (let i = 0; i < count; i += 1) {
        const isLast = i === count - 1
        const childH = isLast ? containerH - childBaseH * (count - 1) : childBaseH
        if (childH <= 0) continue
        this.addElement(
          {
            kind: 'div',
            type: 'div',
            name: `ColumnChild-${container.serial}-${i + 1}`,
            x: container.x,
            y: container.y + i * childBaseH,
            width: container.width,
            height: childH,
            background: container.background,
            text: '',
            opacity: 0.8
          },
          { select: false, parentId: containerId }
        )
      }

      // keep container selected
      this.selectedElementId = containerId
    },
    rebuildImageChildren(containerId: string): void {
      const c = this.elements.find((item) => item.id === containerId)
      if (!c || c.kind !== 'image' || c.type !== 'div' || !c.hasLabel) return

      const rawGap = Number(c.gap)
      const gap = Number.isFinite(rawGap) ? Math.max(0, Math.floor(rawGap)) : 10
      c.gap = gap
      const imgSize = 30
      const has = !!c.hasLabel

      const oldImg = this.elements.find((item) => item.parentId === c.id && item.type === 'img')
      const oldLabel = this.elements.find(
        (item) => item.parentId === c.id && item.type === 'div' && item.name.endsWith('-label')
      )
      const preservedCaption = oldLabel?.text ?? ''
      if (!c.imageSrc && oldImg?.imageSrc) {
        c.imageSrc = oldImg.imageSrc
      }

      this.elements = this.elements.filter((item) => item.id === c.id || item.parentId !== c.id)

      const imgY = has ? c.y + Math.max(0, (c.height - imgSize) / 2) : c.y
      const src = c.imageSrc ?? ''
      this.addElement(
        {
          kind: 'div',
          type: 'img',
          name: `Image-${c.serial}-img`,
          x: c.x,
          y: imgY,
          width: imgSize,
          height: imgSize,
          background: '#2a3142',
          text: '',
          opacity: 1,
          imageSrc: src
        },
        { select: false, parentId: containerId }
      )

      if (has) {
        const labelW = Math.max(0, c.width - imgSize - gap)
        this.addElement(
          {
            kind: 'div',
            type: 'div',
            name: `Image-${c.serial}-label`,
            x: c.x + imgSize + gap,
            y: c.y,
            width: labelW,
            height: c.height,
            background: 'rgba(255,255,255,0.08)',
            text: preservedCaption,
            opacity: 1
          },
          { select: false, parentId: containerId }
        )
      }

      this.selectedElementId = containerId
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
