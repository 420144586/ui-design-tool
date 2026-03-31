import { defineStore } from 'pinia'
import type {
  CanvasConfig,
  DesignElement,
  DragPreview,
  ElementPreset,
  LayoutMode,
  ViewMode,
  VirtualEnvConfig,
  VirtualEnvPosition,
  WorkspaceMode
} from '@renderer/types/design'
import type { DesignProjectFileV1 } from '@renderer/utils/designProjectFile'
import { pointInElementDataBox } from '@renderer/utils/designDropTarget'
import { canAddChildElements } from '@renderer/utils/designElementHost'
import { computeColumnChildHeights } from '@renderer/utils/columnLayout'
import { elementDomClass, generateElementDomClass } from '@renderer/utils/elementClassStrategy'
import {
  flexVisualMainAxisNeighborDelta,
  sortSiblingsForRenderOrder
} from '@renderer/utils/elementFlex'
import { resolveTableCols, resolveTableRows } from '@renderer/utils/tableDimensions'

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
  layoutMode: 'flex',
  zoom: 0.8
}

/** 全局 Flex 画布下新建元素（可挂载子节点的类型）默认启用子项 Flex 容器 */
function applyFlexCanvasDefaults(target: DesignElement): void {
  if (target.kind === 'table') return
  if (target.kind === 'image' && target.type === 'img') return
  if (target.isFlexPageShell) return
  const flexDefaults: Partial<DesignElement> = {
    flexLayoutEnabled: true,
    gridLayoutForChildren: false,
    flexDirection: 'row',
    flexWrap: 'nowrap',
    justifyContent: 'flex-start',
    alignItems: 'stretch',
    alignContent: 'stretch',
    flexGap: 0
  }
  if (target.isTableCell) {
    Object.assign(target, flexDefaults)
    return
  }
  Object.assign(target, flexDefaults)
}

const defaultPreview: DragPreview = {
  visible: false,
  x: 0,
  y: 0,
  width: 100,
  height: 100
}

/** 尺寸字段与 canvas 同步；展示以 canvas 为准 */
const defaultVirtualEnv = (): VirtualEnvConfig => ({
  width: 1920,
  height: 1080,
  background: '#0f131a',
  position: 'relative',
  presetTitleBar: true,
  presetFooter: true,
  presetTitleBarPosition: 'absolute',
  presetFooterPosition: 'absolute',
  presetTitleBarHeight: 36,
  presetFooterHeight: 44
})

function clampVirtualChromeHeight(n: unknown, fallback: number): number {
  const x = Math.floor(Number(n))
  if (!Number.isFinite(x)) return fallback
  return Math.min(400, Math.max(8, x))
}

function normalizeVirtualEnvPosition(p: unknown): VirtualEnvPosition {
  if (p === 'absolute' || p === 'fixed' || p === 'static' || p === 'relative') return p
  return 'relative'
}

const DESIGN_HISTORY_MAX = 80

/** 供设计稿 projectId 与「新建项目」使用；可从渲染层引用 */
export function newDesignProjectUuid(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `proj-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`
}

/** Pinia/Vue 下 elements 为 Proxy，structuredClone 会抛错；用 JSON 做深拷贝 */
const cloneElementsPlain = (elements: DesignElement[]): DesignElement[] =>
  JSON.parse(JSON.stringify(elements)) as DesignElement[]

export interface DesignHistorySnapshot {
  elements: DesignElement[]
  selectedElementIds: string[]
  nextSerial: number
}

export const useDesignStore = defineStore('design', {
  state: () => ({
    activeView: 'design' as ViewMode,
    canvas: { ...defaultCanvas },
    /** 标准工作区设计数据（保存/导出/导入的权威来源） */
    standardElements: [] as DesignElement[],
    standardNextSerial: 1,
    standardDesignHistoryPast: [] as DesignHistorySnapshot[],
    /** 虚拟环境独立副本：进入虚拟环境时从标准深拷贝，编辑不影响标准 */
    virtualElements: [] as DesignElement[],
    virtualNextSerial: 1,
    virtualDesignHistoryPast: [] as DesignHistorySnapshot[],
    selectedElementIds: [] as string[],
    dragPreview: { ...defaultPreview },
    activePreset: null as ElementPreset | null,
    historyMuted: false,
    historyBatchDepth: 0,
    layoutDragActive: false,
    layoutDragHistorySaved: false,
    workspaceMode: 'standard' as WorkspaceMode,
    virtualEnv: defaultVirtualEnv(),
    /**
     * 设计项目会话（与组件树挂载无关，避免切换设计/代码视图或路由重建后丢失绑定）
     */
    designProjectId: newDesignProjectUuid(),
    designProjectFilePath: null as string | null
  }),
  getters: {
    /** 与单选兼容：取最后一次点击（多选时为主编辑项） */
    selectedElementId: (state): string => state.selectedElementIds.at(-1) ?? '',
    /** 当前工作区下的元素列表（标准 / 虚拟互不覆盖） */
    elements: (state): DesignElement[] =>
      state.workspaceMode === 'virtual-env' ? state.virtualElements : state.standardElements,
    nextSerial: (state): number =>
      state.workspaceMode === 'virtual-env' ? state.virtualNextSerial : state.standardNextSerial,
    /** 标准工作区元素（保存设计稿、导出 Vue 等使用） */
    canonicalElements: (state): DesignElement[] => state.standardElements,
    canonicalNextSerial: (state): number => state.standardNextSerial,
    selectedElement: (state): DesignElement | undefined => {
      const els =
        state.workspaceMode === 'virtual-env' ? state.virtualElements : state.standardElements
      return els.find((item) => item.id === (state.selectedElementIds.at(-1) ?? ''))
    },
    /** 当前选中项是否有可切换到的父节点（数据中存在且 id 有效） */
    canSelectParent: (state): boolean => {
      const els =
        state.workspaceMode === 'virtual-env' ? state.virtualElements : state.standardElements
      const sid = state.selectedElementIds.at(-1) ?? ''
      if (!sid) return false
      const el = els.find((item) => item.id === sid)
      const pid = el?.parentId
      if (pid == null || pid === '') return false
      return els.some((item) => item.id === pid)
    },
    canUndoDesign: (state): boolean => {
      const past =
        state.workspaceMode === 'virtual-env'
          ? state.virtualDesignHistoryPast
          : state.standardDesignHistoryPast
      return past.length > 0
    },
    hasSelection: (state): boolean => state.selectedElementIds.length > 0,
    /** 当前工作区下的设计表面宽高：标准用 canvas，虚拟环境用 virtualEnv（互不覆盖） */
    designSurfaceWidth: (state): number =>
      state.workspaceMode === 'virtual-env' ? state.virtualEnv.width : state.canvas.width,
    designSurfaceHeight: (state): number =>
      state.workspaceMode === 'virtual-env' ? state.virtualEnv.height : state.canvas.height,
    /**
     * Flex：仅存在与画布同尺寸的「画布容器」且无子节点视为空；非 Flex：无任何元素。
     * 用于「清空画布」等：避免仅剩默认外壳时仍提示可清空。
     */
    isEffectivelyEmptyCanvas: (state): boolean => {
      const els =
        state.workspaceMode === 'virtual-env' ? state.virtualElements : state.standardElements
      if (state.canvas.layoutMode !== 'flex') {
        return els.length === 0
      }
      const shell = els.find((e) => e.parentId === null && e.isFlexPageShell)
      if (shell) {
        const hasChildOfShell = els.some((e) => e.parentId === shell.id)
        const orphanRoots = els.some((e) => e.parentId === null && !e.isFlexPageShell)
        return !hasChildOfShell && !orphanRoots
      }
      return els.length === 0
    },
    /**
     * Flex 模式下：选中唯一子项且父级为 flex 容器时，工具栏显示主轴方向交换按钮（←→ 或 ↑↓）。
     */
    flexSiblingReorderToolbar: (state): null | {
      axis: 'row' | 'column'
      canTowardStart: boolean
      canTowardEnd: boolean
    } => {
      if (state.canvas.layoutMode !== 'flex') return null
      if (state.selectedElementIds.length !== 1) return null
      const els =
        state.workspaceMode === 'virtual-env' ? state.virtualElements : state.standardElements
      const id = state.selectedElementIds[0]
      const el = els.find((e) => e.id === id)
      if (!el?.parentId) return null
      const parent = els.find((e) => e.id === el.parentId)
      if (!parent?.flexLayoutEnabled) return null
      const ordered = sortSiblingsForRenderOrder(els, parent.id)
      if (ordered.length < 2) return null
      const idx = ordered.findIndex((e) => e.id === id)
      if (idx < 0) return null
      const dir = parent.flexDirection ?? 'row'
      const d0 = flexVisualMainAxisNeighborDelta(dir, true)
      const d1 = flexVisualMainAxisNeighborDelta(dir, false)
      const canTowardStart = idx + d0 >= 0 && idx + d0 < ordered.length
      const canTowardEnd = idx + d1 >= 0 && idx + d1 < ordered.length
      const axis = dir === 'row' || dir === 'row-reverse' ? 'row' : 'column'
      return { axis, canTowardStart, canTowardEnd }
    }
  },
  actions: {
    _activeElements(): DesignElement[] {
      return this.workspaceMode === 'virtual-env' ? this.virtualElements : this.standardElements
    },
    _setActiveElements(next: DesignElement[]): void {
      if (this.workspaceMode === 'virtual-env') this.virtualElements = next
      else this.standardElements = next
    },
    /** Flex 画布唯一根「画布容器」与设计表面同尺寸 */
    _syncFlexPageShellSize(): void {
      if (this.canvas.layoutMode !== 'flex') return
      const w = this.designSurfaceWidth
      const h = this.designSurfaceHeight
      const shell = this._activeElements().find((e) => e.parentId === null && e.isFlexPageShell)
      if (!shell) return
      if (shell.width === w && shell.height === h && shell.x === 0 && shell.y === 0) return
      shell.width = w
      shell.height = h
      shell.x = 0
      shell.y = 0
    },
    /**
     * Flex 布局下保证存在唯一根容器，其它顶层节点归入其下（坐标仍为画布绝对坐标）。
     * skipHistory：在已 push 的同一用户步骤内合并变更（如 addElement 前）。
     */
    ensureFlexPageShell(options?: { skipHistory?: boolean }): void {
      if (this.canvas.layoutMode !== 'flex') return
      const els = this._activeElements()
      const roots = els.filter((e) => e.parentId === null)
      if (roots.some((e) => e.isFlexPageShell)) return

      const skipHistory = options?.skipHistory === true
      if (!skipHistory && !this.historyMuted) {
        this.pushDesignHistory()
      }
      const serial =
        this.workspaceMode === 'virtual-env' ? this.virtualNextSerial++ : this.standardNextSerial++
      const w = this.designSurfaceWidth
      const h = this.designSurfaceHeight
      const newShell: DesignElement = {
        id: uid(),
        serial,
        parentId: null,
        kind: 'div',
        type: 'div',
        name: '画布容器',
        x: 0,
        y: 0,
        width: w,
        height: h,
        background: 'transparent',
        text: '',
        opacity: 1,
        isFlexPageShell: true,
        flexLayoutEnabled: true,
        gridLayoutForChildren: false,
        flexDirection: 'row',
        flexWrap: 'nowrap',
        justifyContent: 'flex-start',
        alignItems: 'stretch',
        alignContent: 'stretch',
        flexGap: 0
      }
      newShell.domClass = generateElementDomClass({ element: newShell })
      for (const r of roots) {
        r.parentId = newShell.id
      }
      els.push(newShell)
    },
    _activePast(): DesignHistorySnapshot[] {
      return this.workspaceMode === 'virtual-env'
        ? this.virtualDesignHistoryPast
        : this.standardDesignHistoryPast
    },
    /** 从标准设计深拷贝到虚拟环境（每次进入虚拟工作区时调用） */
    reloadVirtualFromStandard(): void {
      this.virtualElements = cloneElementsPlain(this.standardElements)
      this.virtualNextSerial = this.standardNextSerial
      this.virtualDesignHistoryPast = []
    },
    /**
     * 切换工作区：进入虚拟环境时从标准重新加载一份独立副本；标准数据不被虚拟编辑污染。
     */
    setWorkspaceMode(mode: WorkspaceMode): void {
      if (mode === this.workspaceMode) return
      if (mode === 'virtual-env') {
        this.reloadVirtualFromStandard()
      }
      this.workspaceMode = mode
      this.selectedElementIds = []
    },
    pushDesignHistory(): void {
      if (this.historyMuted) return
      const snap: DesignHistorySnapshot = {
        elements: cloneElementsPlain(this._activeElements()),
        selectedElementIds: [...this.selectedElementIds],
        nextSerial: this.workspaceMode === 'virtual-env' ? this.virtualNextSerial : this.standardNextSerial
      }
      const past = this._activePast()
      past.push(snap)
      if (past.length > DESIGN_HISTORY_MAX) {
        past.shift()
      }
    },
    /** 将多处 addElement 合并为一步撤销（内部先 push 一次快照） */
    beginHistoryBatch(): void {
      if (this.historyBatchDepth === 0) {
        this.pushDesignHistory()
      }
      this.historyBatchDepth += 1
    },
    endHistoryBatch(): void {
      this.historyBatchDepth = Math.max(0, this.historyBatchDepth - 1)
    },
    undoDesign(): void {
      const past = this._activePast()
      const snap = past.pop()
      if (!snap) return
      this.historyMuted = true
      this._setActiveElements(cloneElementsPlain(snap.elements))
      this.selectedElementIds = snap.selectedElementIds ? [...snap.selectedElementIds] : []
      if (this.workspaceMode === 'virtual-env') {
        this.virtualNextSerial = snap.nextSerial
      } else {
        this.standardNextSerial = snap.nextSerial
      }
      this.historyMuted = false
    },
    /** 画布拖动元素：合并整次拖动为一步撤销 */
    startLayoutDrag(): void {
      this.layoutDragActive = true
      this.layoutDragHistorySaved = false
    },
    endLayoutDrag(): void {
      this.layoutDragActive = false
      this.layoutDragHistorySaved = false
    },
    setActiveView(view: ViewMode): void {
      this.activeView = view
    },
    setDesignProjectFilePath(path: string | null): void {
      this.designProjectFilePath = path
    },
    setDesignProjectId(id: string): void {
      this.designProjectId = id
    },
    /** 新建项目会话：新 id、解除磁盘路径绑定（画布清空由调用方 replaceElements 等完成） */
    beginNewDesignProjectSession(): void {
      this.designProjectFilePath = null
      this.designProjectId = newDesignProjectUuid()
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
      if (layoutMode === 'flex') {
        this.ensureFlexPageShell()
      }
    },
    setCanvasPreset(preset: '1920x1080' | '800x600'): void {
      const w = preset === '800x600' ? 800 : 1920
      const h = preset === '800x600' ? 600 : 1080
      if (this.canvas.width === w && this.canvas.height === h) return
      this.pushDesignHistory()
      this.canvas.width = w
      this.canvas.height = h
      this._syncFlexPageShellSize()
    },
    /** 自定义画布像素尺寸（宽×高），会记入撤销栈（仅标准工作区画布） */
    setCanvasDimensions(width: number, height: number): void {
      const w = Math.floor(Number(width))
      const h = Math.floor(Number(height))
      if (!Number.isFinite(w) || !Number.isFinite(h)) return
      const min = 1
      const max = 16000
      const nw = Math.min(max, Math.max(min, w))
      const nh = Math.min(max, Math.max(min, h))
      if (nw === this.canvas.width && nh === this.canvas.height) return
      this.pushDesignHistory()
      this.canvas.width = nw
      this.canvas.height = nh
      this._syncFlexPageShellSize()
    },
    /** 虚拟环境设备/设计表面尺寸（与标准画布独立） */
    setVirtualEnvPreset(preset: '1920x1080' | '800x600'): void {
      const w = preset === '800x600' ? 800 : 1920
      const h = preset === '800x600' ? 600 : 1080
      if (this.virtualEnv.width === w && this.virtualEnv.height === h) return
      this.pushDesignHistory()
      this.virtualEnv = { ...this.virtualEnv, width: w, height: h }
      this._syncFlexPageShellSize()
    },
    setVirtualEnvDimensions(width: number, height: number): void {
      const w = Math.floor(Number(width))
      const h = Math.floor(Number(height))
      if (!Number.isFinite(w) || !Number.isFinite(h)) return
      const min = 1
      const max = 16000
      const nw = Math.min(max, Math.max(min, w))
      const nh = Math.min(max, Math.max(min, h))
      if (nw === this.virtualEnv.width && nh === this.virtualEnv.height) return
      this.pushDesignHistory()
      this.virtualEnv = { ...this.virtualEnv, width: nw, height: nh }
      this._syncFlexPageShellSize()
    },
    setZoom(zoom: number): void {
      this.canvas.zoom = Math.min(2, Math.max(0.25, zoom))
    },
    adjustZoom(delta: number): void {
      this.setZoom(this.canvas.zoom + delta)
    },
    resolveParentForNewElement(
      rect: { x: number; y: number; width: number; height: number },
      hitElementId?: string | null,
      clientPointer?: { clientX: number; clientY: number } | null
    ): string | null {
      const findEl = (id: string): DesignElement | undefined =>
        this._activeElements().find((item) => item.id === id)

      if (hitElementId) {
        const px = clientPointer?.clientX
        const py = clientPointer?.clientY
        if (px != null && py != null) {
          let cur: DesignElement | undefined = findEl(hitElementId)
          while (cur) {
            if (
              canAddChildElements(cur) &&
              pointInElementDataBox(px, py, cur.id)
            ) {
              return cur.id
            }
            const pid = cur.parentId
            cur = pid ? findEl(pid) : undefined
          }
        } else {
          let cur: DesignElement | undefined = findEl(hitElementId)
          while (cur) {
            if (canAddChildElements(cur) && isInside(rect, cur)) return cur.id
            const pid = cur.parentId
            cur = pid ? findEl(pid) : undefined
          }
        }
      }

      const candidates = this._activeElements().filter(
        (item) => canAddChildElements(item) && isInside(rect, item)
      )
      const parent = candidates.sort((a, b) => a.width * a.height - b.width * b.height)[0]
      return parent?.id ?? null
    },
    addElement(
      element: Omit<DesignElement, 'id' | 'serial' | 'parentId'>,
      options?: {
        select?: boolean
        parentId?: string | null
        hitElementId?: string | null
        /** 放置预设时的视口指针位置，用于 Flex 下按 DOM 命中解析父级（与数据 x/y 是否同步无关） */
        clientPointer?: { clientX: number; clientY: number } | null
        skipHistory?: boolean
      }
    ): DesignElement {
      if (!options?.skipHistory && this.historyBatchDepth === 0) {
        this.pushDesignHistory()
      }
      if (this.canvas.layoutMode === 'flex') {
        this.ensureFlexPageShell({ skipHistory: true })
      }
      let parentId: string | null
      if (options?.parentId !== undefined) {
        parentId = options.parentId
      } else {
        parentId = this.resolveParentForNewElement(
          element,
          options?.hitElementId ?? null,
          options?.clientPointer ?? null
        )
      }
      if (parentId === null && this.canvas.layoutMode === 'flex') {
        const shell = this._activeElements().find((e) => e.parentId === null && e.isFlexPageShell)
        if (shell) parentId = shell.id
      }
      const serial =
        this.workspaceMode === 'virtual-env' ? this.virtualNextSerial++ : this.standardNextSerial++
      const nextElement: DesignElement = {
        ...element,
        id: uid(),
        serial,
        parentId
      }
      /** 未显式带 domClass 时再走策略；复制/粘贴数据时保留已有或 duplicate 注入的类名 */
      if (!nextElement.domClass?.trim()) {
        nextElement.domClass = generateElementDomClass({ element: nextElement })
      }
      this._activeElements().push(nextElement)
      if (this.canvas.layoutMode === 'flex') {
        applyFlexCanvasDefaults(nextElement)
      }
      if (options?.select !== false) {
        this.selectedElementIds = [nextElement.id]
      }
      return nextElement
    },
    /** 替换标准工作区元素（如 Vue 导入）；若在虚拟环境则随后从标准重载虚拟副本 */
    replaceElements(elements: DesignElement[]): void {
      if (!this.historyMuted && this.historyBatchDepth === 0) {
        const snap: DesignHistorySnapshot = {
          elements: cloneElementsPlain(this.standardElements),
          selectedElementIds: [...this.selectedElementIds],
          nextSerial: this.standardNextSerial
        }
        this.standardDesignHistoryPast.push(snap)
        if (this.standardDesignHistoryPast.length > DESIGN_HISTORY_MAX) {
          this.standardDesignHistoryPast.shift()
        }
      }
      this.standardElements = cloneElementsPlain(elements)
      this.selectedElementIds = []
      const maxSerial = this.standardElements.reduce((max, item) => Math.max(max, item.serial), 0)
      this.standardNextSerial = maxSerial + 1
      if (this.workspaceMode === 'virtual-env') {
        this.reloadVirtualFromStandard()
      }
      if (this.canvas.layoutMode === 'flex') {
        this.ensureFlexPageShell({ skipHistory: true })
      }
    },
    /** 从设计稿文件还原（不记入撤销栈，并清空历史；权威数据写入标准工作区） */
    applyDesignProjectFile(data: DesignProjectFileV1): void {
      this.historyMuted = true
      this.standardDesignHistoryPast = []
      this.virtualDesignHistoryPast = []
      this.historyBatchDepth = 0
      this.layoutDragActive = false
      this.layoutDragHistorySaved = false
      this.standardElements = cloneElementsPlain(data.elements)
      const maxSerial = this.standardElements.reduce((m, e) => Math.max(m, e.serial), 0)
      const ns = Math.floor(Number(data.nextSerial))
      this.standardNextSerial = Number.isFinite(ns) ? Math.max(ns, maxSerial + 1) : maxSerial + 1
      const c = data.canvas
      this.canvas = {
        width: Math.max(1, Math.min(16000, Math.floor(Number(c.width)) || defaultCanvas.width)),
        height: Math.max(1, Math.min(16000, Math.floor(Number(c.height)) || defaultCanvas.height)),
        gridSize: Math.max(1, Math.floor(Number(c.gridSize)) || defaultCanvas.gridSize),
        layoutMode:
          c.layoutMode === 'absolute'
            ? 'absolute'
            : c.layoutMode === 'flex'
              ? 'flex'
              : 'grid',
        zoom: Math.min(2, Math.max(0.25, Number(c.zoom) || defaultCanvas.zoom))
      }
      this.selectedElementIds = []
      this.activePreset = null
      this.activeView = 'design'
      this.dragPreview = { ...defaultPreview }
      if (data.workspaceMode === 'virtual-env' || data.workspaceMode === 'standard') {
        this.workspaceMode = data.workspaceMode
      } else {
        this.workspaceMode = 'standard'
      }
      if (data.virtualEnv && typeof data.virtualEnv === 'object') {
        const v = data.virtualEnv
        const def = defaultVirtualEnv()
        const ve = v as VirtualEnvConfig
        const vw = Math.floor(Number(ve.width))
        const vh = Math.floor(Number(ve.height))
        this.virtualEnv = {
          width: Math.max(1, Math.min(16000, Number.isFinite(vw) ? vw : def.width)),
          height: Math.max(1, Math.min(16000, Number.isFinite(vh) ? vh : def.height)),
          background: typeof v.background === 'string' ? v.background : def.background,
          position: normalizeVirtualEnvPosition(v.position),
          presetTitleBar: !!v.presetTitleBar,
          presetFooter: !!v.presetFooter,
          presetTitleBarPosition: normalizeVirtualEnvPosition(ve.presetTitleBarPosition ?? 'absolute'),
          presetFooterPosition: normalizeVirtualEnvPosition(ve.presetFooterPosition ?? 'absolute'),
          presetTitleBarHeight: clampVirtualChromeHeight(ve.presetTitleBarHeight, def.presetTitleBarHeight),
          presetFooterHeight: clampVirtualChromeHeight(ve.presetFooterHeight, def.presetFooterHeight)
        }
      } else {
        this.virtualEnv = defaultVirtualEnv()
      }
      if (this.canvas.layoutMode === 'flex') {
        this.ensureFlexPageShell({ skipHistory: true })
      }
      this.historyMuted = false
      if (this.workspaceMode === 'virtual-env') {
        this.reloadVirtualFromStandard()
      }
    },
    patchVirtualEnv(payload: Partial<VirtualEnvConfig>): void {
      if (payload.width !== undefined || payload.height !== undefined) {
        const w =
          payload.width !== undefined
            ? Math.max(1, Math.min(16000, Math.floor(Number(payload.width))))
            : this.virtualEnv.width
        const h =
          payload.height !== undefined
            ? Math.max(1, Math.min(16000, Math.floor(Number(payload.height))))
            : this.virtualEnv.height
        this.setVirtualEnvDimensions(w, h)
      }
      const { width: _dw, height: _dh, ...rest } = payload
      const next: VirtualEnvConfig = { ...this.virtualEnv, ...rest }
      next.width = this.virtualEnv.width
      next.height = this.virtualEnv.height
      if (payload.position !== undefined) {
        next.position = normalizeVirtualEnvPosition(payload.position)
      }
      if (payload.background !== undefined && typeof payload.background === 'string') {
        next.background = payload.background
      }
      if (payload.presetTitleBar !== undefined) next.presetTitleBar = !!payload.presetTitleBar
      if (payload.presetFooter !== undefined) next.presetFooter = !!payload.presetFooter
      if (payload.presetTitleBarPosition !== undefined) {
        next.presetTitleBarPosition = normalizeVirtualEnvPosition(payload.presetTitleBarPosition)
      }
      if (payload.presetFooterPosition !== undefined) {
        next.presetFooterPosition = normalizeVirtualEnvPosition(payload.presetFooterPosition)
      }
      if (payload.presetTitleBarHeight !== undefined) {
        next.presetTitleBarHeight = clampVirtualChromeHeight(
          payload.presetTitleBarHeight,
          next.presetTitleBarHeight ?? defaultVirtualEnv().presetTitleBarHeight
        )
      }
      if (payload.presetFooterHeight !== undefined) {
        next.presetFooterHeight = clampVirtualChromeHeight(
          payload.presetFooterHeight,
          next.presetFooterHeight ?? defaultVirtualEnv().presetFooterHeight
        )
      }
      const defVe = defaultVirtualEnv()
      next.presetTitleBarHeight =
        next.presetTitleBarHeight ?? defVe.presetTitleBarHeight
      next.presetFooterHeight = next.presetFooterHeight ?? defVe.presetFooterHeight
      this.virtualEnv = next
    },
    updateElement(
      id: string,
      payload: Partial<DesignElement>,
      options?: { skipHistory?: boolean }
    ): void {
      const target = this._activeElements().find((item) => item.id === id)
      if (!target) return
      const skipHistory = options?.skipHistory === true
      if (!skipHistory) {
        if (this.layoutDragActive && (payload.x !== undefined || payload.y !== undefined)) {
          if (!this.layoutDragHistorySaved) {
            this.pushDesignHistory()
            this.layoutDragHistorySaved = true
          }
        } else if (!this.layoutDragActive) {
          this.pushDesignHistory()
        }
      }
      const oldX = target.x
      const oldY = target.y
      Object.assign(target, payload)
      if (payload.flexLayoutEnabled === true) {
        target.gridLayoutForChildren = false
        target.layoutCenterHorizontal = false
        target.layoutCenterVertical = false
        this._activeElements().forEach((el) => {
          if (el.parentId === target.id) {
            el.layoutCenterHorizontal = false
            el.layoutCenterVertical = false
          }
        })
      }
      if (payload.gridLayoutForChildren === true) {
        target.flexLayoutEnabled = false
        target.layoutCenterHorizontal = false
        target.layoutCenterVertical = false
        this._activeElements().forEach((el) => {
          if (el.parentId === target.id) {
            el.layoutCenterHorizontal = false
            el.layoutCenterVertical = false
          }
        })
      }
      if (this.layoutDragActive && (payload.x !== undefined || payload.y !== undefined)) {
        target.layoutCenterHorizontal = false
        target.layoutCenterVertical = false
      }
      if (payload.x !== undefined || payload.y !== undefined) {
        const dx = target.x - oldX
        const dy = target.y - oldY
        // 子节点存的是画布绝对坐标；表格由 syncTableCellsLayout 统一重算单元格，勿重复平移
        if ((dx !== 0 || dy !== 0) && target.kind !== 'table') {
          this.shiftDescendants(target.id, dx, dy)
        }
      }
      if (target.type === 'img' && target.parentId && payload.imageSrc !== undefined) {
        const parent = this._activeElements().find((item) => item.id === target.parentId)
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
          const haveCells = this._activeElements().some(
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
      if (target.kind === 'column') {
        if (payload.width !== undefined || payload.height !== undefined) {
          this.syncColumnChildrenLayout(target.id)
        }
      }
    },
    shiftDescendants(rootId: string, dx: number, dy: number): void {
      this._activeElements()
        .filter((item) => item.parentId === rootId)
        .forEach((ch) => {
          ch.x += dx
          ch.y += dy
          this.shiftDescendants(ch.id, dx, dy)
        })
    },
    /** nodeId 是否位于 ancestorId 的子树中（直连或更深） */
    isDescendantOf(ancestorId: string, nodeId: string): boolean {
      let cur: DesignElement | undefined = this._activeElements().find((item) => item.id === nodeId)
      while (cur?.parentId) {
        const pid = cur.parentId
        if (pid === ancestorId) return true
        cur = this._activeElements().find((item) => item.id === pid)
      }
      return false
    },
    /**
     * 将子节点挂到新父级下，x/y 为画布绝对坐标，保持不变以维持视觉位置。
     */
    reparentElement(childId: string, newParentId: string): void {
      if (childId === newParentId) return
      const child = this._activeElements().find((item) => item.id === childId)
      const parent = this._activeElements().find((item) => item.id === newParentId)
      if (!child || !parent) return
      if (this.isDescendantOf(childId, newParentId)) return
      if (parent.kind === 'table') return
      this.pushDesignHistory()
      child.parentId = newParentId
      this.selectedElementIds = [childId]
    },
    /**
     * 批量挂到同一父级（一步撤销，用于多选拖入容器）。
     */
    reparentElements(childIds: string[], newParentId: string): void {
      const parent = this._activeElements().find((item) => item.id === newParentId)
      if (!parent || parent.kind === 'table') return
      const dragged = new Set(childIds)
      const toReparent: string[] = []
      for (const cid of childIds) {
        if (cid === newParentId) continue
        const child = this._activeElements().find((item) => item.id === cid)
        if (!child) continue
        if (child.parentId === newParentId) continue
        if (dragged.has(newParentId)) continue
        if (this.isDescendantOf(cid, newParentId)) continue
        toReparent.push(cid)
      }
      if (toReparent.length === 0) return
      this.pushDesignHistory()
      for (const cid of toReparent) {
        const c = this._activeElements().find((item) => item.id === cid)
        if (c) c.parentId = newParentId
      }
      this.selectedElementIds = [...toReparent]
    },
    /** 多选：在「选中集合」内的顶层节点（父子同时选中时只移动根） */
    selectionRoots(ids: string[]): string[] {
      const set = new Set(ids)
      return ids.filter((id) => {
        const el = this._activeElements().find((e) => e.id === id)
        if (!el?.parentId) return true
        return !set.has(el.parentId)
      })
    },
    /** 从当前单元格读列宽（首行）、行高（首列），缺则用均分 */
    _tableColRowArraysFromCells(tableId: string): { colW: number[]; rowH: number[] } {
      const t = this._activeElements().find((item) => item.id === tableId)
      if (!t || t.kind !== 'table') {
        return { colW: [1], rowH: [1] }
      }
      const rows = resolveTableRows(t.tableRows)
      const cols = resolveTableCols(t.tableCols)
      const cells = this._activeElements().filter((c) => c.parentId === tableId && c.isTableCell)
      const colW: number[] = []
      const rowH: number[] = []
      const ew = t.width / cols
      const eh = t.height / rows
      for (let c = 0; c < cols; c += 1) {
        const cell = cells.find((x) => x.tableCellRow === 0 && x.tableCellCol === c)
        colW.push(cell?.width && cell.width > 0 ? cell.width : ew)
      }
      for (let r = 0; r < rows; r += 1) {
        const cell = cells.find((x) => x.tableCellRow === r && x.tableCellCol === 0)
        rowH.push(cell?.height && cell.height > 0 ? cell.height : eh)
      }
      return { colW, rowH }
    },
    /** 按列宽/行高数组写回所有单元格的 x,y,width,height 并平移子节点 */
    _applyTableCellGeometry(tableId: string, colW: number[], rowH: number[]): void {
      const t = this._activeElements().find((item) => item.id === tableId)
      if (!t || t.kind !== 'table') return
      const rows = resolveTableRows(t.tableRows)
      const cols = resolveTableCols(t.tableCols)
      if (colW.length !== cols || rowH.length !== rows) return
      const cells = this._activeElements().filter((c) => c.parentId === tableId && c.isTableCell)
      let y = t.y
      for (let r = 0; r < rows; r += 1) {
        let x = t.x
        const h = rowH[r] ?? t.height / rows
        for (let c = 0; c < cols; c += 1) {
          const cell = cells.find((cc) => cc.tableCellRow === r && cc.tableCellCol === c)
          if (!cell) continue
          const w = colW[c] ?? t.width / cols
          const ox = cell.x
          const oy = cell.y
          cell.x = x
          cell.y = y
          cell.width = w
          cell.height = h
          const dx = cell.x - ox
          const dy = cell.y - oy
          if (dx !== 0 || dy !== 0) {
            this.shiftDescendants(cell.id, dx, dy)
          }
          x += w
        }
        y += h
      }
    },
    syncTableCellsLayout(tableId: string): void {
      const t = this._activeElements().find((item) => item.id === tableId)
      if (!t || t.kind !== 'table') return
      const rows = resolveTableRows(t.tableRows)
      const cols = resolveTableCols(t.tableCols)
      const cells = this._activeElements().filter((c) => c.parentId === tableId && c.isTableCell)
      if (cells.length === 0) {
        this.initTableCells(tableId)
        return
      }
      let { colW, rowH } = this._tableColRowArraysFromCells(tableId)
      const sumW = colW.reduce((a, b) => a + b, 0) || 1
      const sumH = rowH.reduce((a, b) => a + b, 0) || 1
      colW = colW.map((w) => (w * t.width) / sumW)
      rowH = rowH.map((h) => (h * t.height) / sumH)
      const wErr = t.width - colW.reduce((a, b) => a + b, 0)
      const hErr = t.height - rowH.reduce((a, b) => a + b, 0)
      if (cols > 0) colW[cols - 1] = (colW[cols - 1] ?? 0) + wErr
      if (rows > 0) rowH[rows - 1] = (rowH[rows - 1] ?? 0) + hErr
      this._applyTableCellGeometry(tableId, colW, rowH)
    },
    /** 各列宽均分 table.width（一步撤销） */
    equalizeTableColumnWidths(tableId: string): void {
      const t = this._activeElements().find((item) => item.id === tableId)
      if (!t || t.kind !== 'table') return
      this.pushDesignHistory()
      const cols = resolveTableCols(t.tableCols)
      const rows = resolveTableRows(t.tableRows)
      const ew = t.width / cols
      const colW = Array.from({ length: cols }, () => ew)
      const { rowH } = this._tableColRowArraysFromCells(tableId)
      if (rowH.length !== rows) return
      this._applyTableCellGeometry(tableId, colW, rowH)
    },
    /** 各行高均分 table.height（一步撤销） */
    equalizeTableRowHeights(tableId: string): void {
      const t = this._activeElements().find((item) => item.id === tableId)
      if (!t || t.kind !== 'table') return
      this.pushDesignHistory()
      const cols = resolveTableCols(t.tableCols)
      const rows = resolveTableRows(t.tableRows)
      const eh = t.height / rows
      const rowH = Array.from({ length: rows }, () => eh)
      const { colW } = this._tableColRowArraysFromCells(tableId)
      if (colW.length !== cols) return
      this._applyTableCellGeometry(tableId, colW, rowH)
    },
    /** 当前各列像素宽（来自首行单元格，供属性面板展示） */
    getTableColumnWidths(tableId: string): number[] {
      return this._tableColRowArraysFromCells(tableId).colW
    },
    /** 当前各行像素高（来自首列单元格） */
    getTableRowHeights(tableId: string): number[] {
      return this._tableColRowArraysFromCells(tableId).rowH
    },
    /**
     * 按草稿列宽（非负数字，可为比例）缩放后写满 table.width，并写回所有单元格几何。
     */
    applyTableColumnWidths(tableId: string, draft: number[]): void {
      const t = this._activeElements().find((item) => item.id === tableId)
      if (!t || t.kind !== 'table') return
      const cols = resolveTableCols(t.tableCols)
      const rows = resolveTableRows(t.tableRows)
      if (draft.length !== cols) return
      this.pushDesignHistory()
      let colW = draft.map((w) => Math.max(0, Number(w) || 0))
      let sumW = colW.reduce((a, b) => a + b, 0)
      if (sumW <= 0) {
        colW = Array.from({ length: cols }, () => t.width / cols)
        sumW = colW.reduce((a, b) => a + b, 0) || 1
      }
      colW = colW.map((w) => (w * t.width) / sumW)
      const wErr = t.width - colW.reduce((a, b) => a + b, 0)
      if (cols > 0) colW[cols - 1] = (colW[cols - 1] ?? 0) + wErr
      const { rowH } = this._tableColRowArraysFromCells(tableId)
      if (rowH.length !== rows) return
      this._applyTableCellGeometry(tableId, colW, rowH)
    },
    /** 按草稿行高缩放后写满 table.height */
    applyTableRowHeights(tableId: string, draft: number[]): void {
      const t = this._activeElements().find((item) => item.id === tableId)
      if (!t || t.kind !== 'table') return
      const cols = resolveTableCols(t.tableCols)
      const rows = resolveTableRows(t.tableRows)
      if (draft.length !== rows) return
      this.pushDesignHistory()
      let rowH = draft.map((h) => Math.max(0, Number(h) || 0))
      let sumH = rowH.reduce((a, b) => a + b, 0)
      if (sumH <= 0) {
        rowH = Array.from({ length: rows }, () => t.height / rows)
        sumH = rowH.reduce((a, b) => a + b, 0) || 1
      }
      rowH = rowH.map((h) => (h * t.height) / sumH)
      const hErr = t.height - rowH.reduce((a, b) => a + b, 0)
      if (rows > 0) rowH[rows - 1] = (rowH[rows - 1] ?? 0) + hErr
      const { colW } = this._tableColRowArraysFromCells(tableId)
      if (colW.length !== cols) return
      this._applyTableCellGeometry(tableId, colW, rowH)
    },
    initTableCells(tableId: string): void {
      const t = this._activeElements().find((item) => item.id === tableId)
      if (!t || t.kind !== 'table') return
      const rows = resolveTableRows(t.tableRows)
      const cols = resolveTableCols(t.tableCols)
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
            { select: false, parentId: tableId, skipHistory: true }
          )
        }
      }
    },
    rebuildTableCells(tableId: string): void {
      const t = this._activeElements().find((item) => item.id === tableId)
      if (!t || t.kind !== 'table') return
      this.pushDesignHistory()
      const toDrop = new Set<string>()
      const walk = (eid: string): void => {
        toDrop.add(eid)
        this._activeElements().filter((item) => item.parentId === eid).forEach((ch) => walk(ch.id))
      }
      this._activeElements()
        .filter((item) => item.parentId === tableId && item.isTableCell)
        .forEach((cell) => walk(cell.id))
      this._setActiveElements(this._activeElements().filter((item) => !toDrop.has(item.id)))
      this.initTableCells(tableId)
      this.selectedElementIds = [tableId]
    },
    setImageHasLabelForSelectedStyle(id: string, hasLabel: boolean): void {
      const el = this._activeElements().find((item) => item.id === id)
      if (!el || el.kind !== 'image') return
      if (el.type === 'img' && !hasLabel) return

      this.pushDesignHistory()

      if (el.type === 'img') {
        const pid = el.parentId
        const { x, y, opacity, imageSrc, name } = el
        this._setActiveElements(this._activeElements().filter((item) => item.id !== el.id))
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
          { parentId: pid, select: false, skipHistory: true }
        )
        this.rebuildImageChildren(container.id)
        this.selectedElementIds = [container.id]
        return
      }

      if (el.type !== 'div') return

      if (!hasLabel) {
        const pid = el.parentId
        const imgChild = this._activeElements().find((c) => c.parentId === el.id && c.type === 'img')
        const src = el.imageSrc ?? imgChild?.imageSrc ?? ''
        const { x, y, opacity, name } = el
        this._setActiveElements(
          this._activeElements().filter((item) => item.id !== el.id && item.parentId !== el.id)
        )
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
          { parentId: pid, select: false, skipHistory: true }
        )
        this.selectedElementIds = [img.id]
        return
      }

      Object.assign(el, { hasLabel: true, width: 130, height: 50, gap: el.gap ?? 10 })
      this.rebuildImageChildren(el.id)
      this.selectedElementIds = [el.id]
    },
    selectElement(id: string): void {
      this.selectedElementIds = [id]
    },
    /** Ctrl/Cmd 多选：已选则取消，未选则加入 */
    toggleSelectElement(id: string): void {
      const list = this.selectedElementIds
      const i = list.indexOf(id)
      if (i >= 0) {
        list.splice(i, 1)
      } else {
        list.push(id)
      }
    },
    /** 选中当前元素的父级（与 selectedElement getter 解耦，始终从 elements 解析） */
    selectParentOfSelected(): void {
      const sid = this.selectedElementIds.at(-1) ?? ''
      if (!sid) return
      const el = this._activeElements().find((item) => item.id === sid)
      const pid = el?.parentId
      if (pid == null || pid === '') return
      if (!this._activeElements().some((item) => item.id === pid)) return
      this.selectedElementIds = [pid]
    },
    /**
     * Flex 画布：与主轴上紧邻的另一子项交换槽位坐标（保持序列不变下整体平移子树）；
     * 若两格 x/y 相同则再交换 serial，否则排序不变（表现为「点了没反应」）。
     */
    swapSelectedFlexSiblingAlongMainAxis(towardMainStart: boolean): void {
      if (this.canvas.layoutMode !== 'flex') return
      if (this.selectedElementIds.length !== 1) return
      const id = this.selectedElementIds[0]
      const els = this._activeElements()
      const el = els.find((e) => e.id === id)
      if (!el?.parentId) return
      const parent = els.find((e) => e.id === el.parentId)
      if (!parent?.flexLayoutEnabled) return
      const ordered = sortSiblingsForRenderOrder(els, parent.id)
      const idx = ordered.findIndex((e) => e.id === id)
      if (idx < 0) return
      const delta = flexVisualMainAxisNeighborDelta(parent.flexDirection ?? 'row', towardMainStart)
      const j = idx + delta
      if (j < 0 || j >= ordered.length) return
      const perm = [...ordered]
      const t = perm[idx]
      perm[idx] = perm[j]
      perm[j] = t
      const slots = ordered.map((e) => ({ x: e.x, y: e.y }))
      const ei = ordered[idx]
      const ej = ordered[j]
      this.beginHistoryBatch()
      for (let k = 0; k < perm.length; k++) {
        const sk = slots[k]
        if (perm[k].x !== sk.x || perm[k].y !== sk.y) {
          this.updateElement(perm[k].id, { x: sk.x, y: sk.y }, { skipHistory: true })
        }
      }
      const desiredIds = perm.map((e) => e.id).join('\0')
      const actualIds = (): string =>
        sortSiblingsForRenderOrder(this._activeElements(), parent.id)
          .map((e) => e.id)
          .join('\0')
      if (actualIds() !== desiredIds) {
        const si = ei.serial
        const sj = ej.serial
        this.updateElement(ei.id, { serial: sj }, { skipHistory: true })
        this.updateElement(ej.id, { serial: si }, { skipHistory: true })
      }
      this.endHistoryBatch()
    },
    clearSelection(): void {
      this.selectedElementIds = []
    },
    deleteSelectedElement(): void {
      if (this.selectedElementIds.length === 0) return
      this.pushDesignHistory()
      const sel = new Set(this.selectedElementIds)
      const roots = this.selectedElementIds.filter((id) => {
        const el = this._activeElements().find((e) => e.id === id)
        if (!el) return false
        if (!el.parentId) return true
        return !sel.has(el.parentId)
      })
      const toDrop = new Set<string>()
      const walk = (id: string): void => {
        toDrop.add(id)
        this._activeElements().filter((item) => item.parentId === id).forEach((ch) => walk(ch.id))
      }
      const els = this._activeElements()
      for (const rid of roots) {
        const rootEl = els.find((e) => e.id === rid)
        if (rootEl?.isFlexPageShell) {
          els.filter((c) => c.parentId === rootEl.id).forEach((c) => {
            c.parentId = null
          })
          toDrop.add(rid)
        } else {
          walk(rid)
        }
      }
      this._setActiveElements(this._activeElements().filter((item) => !toDrop.has(item.id)))
      this.selectedElementIds = []
    },
    duplicateSelectedElement(): void {
      const sel = new Set(this.selectedElementIds)
      const roots = this.selectedElementIds.filter((id) => {
        const el = this._activeElements().find((e) => e.id === id)
        if (!el) return false
        if (!el.parentId) return true
        return !sel.has(el.parentId)
      })
      if (roots.length === 0) return
      const g = this.canvas.gridSize
      this.pushDesignHistory()
      const newIds: string[] = []
      for (const rid of roots) {
        const selected = this._activeElements().find((e) => e.id === rid)
        if (!selected) continue
        const { id, serial, parentId, domClass: _dupDom, ...rest } = selected
        void id
        void serial
        const added = this.addElement(
          {
            ...rest,
            domClass: elementDomClass(selected),
            x: rest.x + g,
            y: rest.y + g
          },
          { parentId: parentId ?? null, skipHistory: true, select: false }
        )
        newIds.push(added.id)
      }
      this.selectedElementIds = newIds
    },
    /** 按当前 Column 高度与子元素数量，均分高度并重排子块（不改子元素数量时用于宽高变化后同步） */
    syncColumnChildrenLayout(containerId: string): void {
      const container = this._activeElements().find((item) => item.id === containerId)
      if (!container || container.kind !== 'column') return
      const children = this._activeElements()
        .filter((item) => item.parentId === containerId)
        .sort((a, b) => a.y - b.y || a.x - b.x)
      const count = Math.max(1, container.childCount ?? 1)
      if (children.length !== count) {
        this.updateColumnChildCount(containerId, count, { skipHistory: true })
        return
      }
      const heights = computeColumnChildHeights(container.height, count)
      let yOffset = 0
      children.forEach((child, i) => {
        const childH = heights[i] ?? 0
        if (childH <= 0) return
        child.x = container.x
        child.y = container.y + yOffset
        child.width = container.width
        child.height = childH
        yOffset += childH
      })
    },
    updateColumnChildCount(
      containerId: string,
      nextCount: number,
      options?: { skipHistory?: boolean }
    ): void {
      const container = this._activeElements().find((item) => item.id === containerId)
      if (!container) return
      if (container.kind !== 'column') return
      if (!options?.skipHistory) {
        this.pushDesignHistory()
      }

      const raw = Math.floor(Number(nextCount))
      const count = Number.isFinite(raw) ? Math.max(1, raw) : 1
      container.childCount = count

      // remove existing children, keep container
      this._setActiveElements(
        this._activeElements().filter((item) => item.id === containerId || item.parentId !== containerId)
      )

      const containerH = container.height
      const heights = computeColumnChildHeights(containerH, count)
      let yOffset = 0
      for (let i = 0; i < count; i += 1) {
        const childH = heights[i] ?? 0
        if (childH <= 0) continue
        this.addElement(
          {
            kind: 'div',
            type: 'div',
            name: `ColumnChild-${container.serial}-${i + 1}`,
            x: container.x,
            y: container.y + yOffset,
            width: container.width,
            height: childH,
            background: container.background,
            text: '',
            opacity: 0.8
          },
          { select: false, parentId: containerId, skipHistory: true }
        )
        yOffset += childH
      }

      // keep container selected
      this.selectedElementIds = [containerId]
    },
    rebuildImageChildren(containerId: string): void {
      const c = this._activeElements().find((item) => item.id === containerId)
      if (!c || c.kind !== 'image' || c.type !== 'div' || !c.hasLabel) return

      const rawGap = Number(c.gap)
      const gap = Number.isFinite(rawGap) ? Math.max(0, Math.floor(rawGap)) : 10
      c.gap = gap
      const imgSize = 30
      const has = !!c.hasLabel

      const oldImg = this._activeElements().find((item) => item.parentId === c.id && item.type === 'img')
      const oldLabel = this._activeElements().find(
        (item) => item.parentId === c.id && item.type === 'div' && item.name.endsWith('-label')
      )
      const preservedCaption = oldLabel?.text ?? ''
      if (!c.imageSrc && oldImg?.imageSrc) {
        c.imageSrc = oldImg.imageSrc
      }

      this._setActiveElements(
        this._activeElements().filter((item) => item.id === c.id || item.parentId !== c.id)
      )

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
        { select: false, parentId: containerId, skipHistory: true }
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
          { select: false, parentId: containerId, skipHistory: true }
        )
      }

      this.selectedElementIds = [containerId]
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
