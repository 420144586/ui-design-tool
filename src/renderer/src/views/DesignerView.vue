<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useDesignStore } from '@renderer/store/design'
import CodeView from '@renderer/components/CodeView/CodeView.vue'
import DesignArea from '@renderer/components/DesignArea/DesignArea.vue'
import ElementLibrary from '@renderer/components/ElementLibrary/ElementLibrary.vue'
import PropertyPanel from '@renderer/components/PropertyPanel/PropertyPanel.vue'
import ColumnPresetSettings from '@renderer/components/ColumnPresetSettings/ColumnPresetSettings.vue'
import ImagePresetSettings from '@renderer/components/ImagePresetSettings/ImagePresetSettings.vue'
import type { LayoutMode, ViewMode } from '@renderer/types/design'
import { generateVueSfcCode } from '@renderer/utils/codegen'
import { importVueToDesignElements } from '@renderer/utils/importVue'
import { parseDesignProjectFile, stringifyDesignProjectFile } from '@renderer/utils/designProjectFile'

const store = useDesignStore()
const router = useRouter()

/** 工具栏居中：直接 updateElement，避免模板里绑定 store.action 在部分环境下不是函数 */
function onToolbarLayoutCenter(mode: 'horizontal' | 'vertical' | 'both'): void {
  const id = store.selectedElementId
  if (!id) return
  if (mode === 'horizontal') {
    store.updateElement(id, { layoutCenterHorizontal: true, layoutCenterVertical: false })
  } else if (mode === 'vertical') {
    store.updateElement(id, { layoutCenterHorizontal: false, layoutCenterVertical: true })
  } else {
    store.updateElement(id, { layoutCenterHorizontal: true, layoutCenterVertical: true })
  }
}

const isLoading = ref(false)
const loadingText = ref('加载中...')
const toastMessage = ref('')
const currentFilePath = ref<string | null>(null)

const showToast = (msg: string) => {
  toastMessage.value = msg
  setTimeout(() => {
    if (toastMessage.value === msg) {
      toastMessage.value = ''
    }
  }, 3000)
}

const views: Array<{ key: ViewMode; label: string }> = [
  { key: 'design', label: '设计视图' },
  { key: 'template', label: '模板代码' },
  { key: 'script', label: 'JS 代码' },
  { key: 'style', label: 'CSS 样式' }
]

const setLayoutMode = (mode: LayoutMode): void => store.setLayoutMode(mode)
const zoomPercent = computed(() => `${Math.round(store.canvas.zoom * 100)}%`)

const canvasPresetKey = computed(() => {
  const { width, height } = store.canvas
  if (width === 1920 && height === 1080) return '1920x1080'
  if (width === 800 && height === 600) return '800x600'
  return 'custom'
})

const canvasWInput = ref(store.canvas.width)
const canvasHInput = ref(store.canvas.height)

watch(
  () => [store.canvas.width, store.canvas.height] as const,
  ([w, h]) => {
    canvasWInput.value = w
    canvasHInput.value = h
  }
)

const onCanvasPresetChange = (event: Event): void => {
  const v = (event.target as HTMLSelectElement).value
  if (v === 'custom') return
  store.setCanvasPreset(v as '1920x1080' | '800x600')
}

const applyCustomCanvasSize = (): void => {
  store.setCanvasDimensions(canvasWInput.value, canvasHInput.value)
}

const exportCurrentAsVue = async (): Promise<void> => {
  const content = generateVueSfcCode(store.elements, store.canvas.layoutMode, {
    width: store.canvas.width,
    height: store.canvas.height,
    gridSize: store.canvas.gridSize
  })
  await window.api.exportVueFile(content, 'generated-component.vue')
}

const goToTestPage = async (): Promise<void> => {
  const content = generateVueSfcCode(store.elements, store.canvas.layoutMode, {
    width: store.canvas.width,
    height: store.canvas.height,
    gridSize: store.canvas.gridSize
  })
  await window.api.exportGeneratedVueFile(content)
  router.push('/test/generated')
}

const importFromVue = async (): Promise<void> => {
  try {
    isLoading.value = true
    loadingText.value = '正在导入...'
    const result = await window.api.importVueFile()
    if (!result.ok || !result.content) return
    const imported = importVueToDesignElements(result.content, store.canvas.gridSize)
    store.setLayoutMode(imported.layoutMode)
    store.replaceElements(imported.elements)
    store.setActiveView('design')
  } finally {
    isLoading.value = false
  }
}

type SaveDesignProjectResult = {
  canceled: boolean
  filePath?: string
}

type LoadDesignProjectResult = {
  canceled: boolean
  filePath?: string
  content?: string
}

const invokeSaveDesignProject = async (content: string, filePath?: string): Promise<SaveDesignProjectResult> => {
  if (typeof window.api?.saveDesignProject === 'function') {
    return window.api.saveDesignProject(content, filePath)
  }
  const fallback = await window.electron.ipcRenderer.invoke('save-design-project', { content, filePath })
  return (fallback ?? { canceled: true }) as SaveDesignProjectResult
}

const invokeLoadDesignProject = async (): Promise<LoadDesignProjectResult> => {
  if (typeof window.api?.loadDesignProject === 'function') {
    return window.api.loadDesignProject()
  }
  const fallback = await window.electron.ipcRenderer.invoke('load-design-project')
  return (fallback ?? { canceled: true }) as LoadDesignProjectResult
}

const saveDesignProject = async (silent: boolean = false): Promise<void> => {
  try {
    if (!silent) {
      isLoading.value = true
      loadingText.value = '正在保存...'
    }
    const content = stringifyDesignProjectFile(store.canvas, store.elements, store.nextSerial)
    const result = await invokeSaveDesignProject(content, silent && currentFilePath.value ? currentFilePath.value : undefined)
    if (!result.canceled && result.filePath) {
      currentFilePath.value = result.filePath
      if (silent) {
        showToast('保存成功')
      } else {
        window.alert(`设计稿已保存到：\n${result.filePath}`)
      }
    }
  } finally {
    if (!silent) {
      isLoading.value = false
    }
  }
}

const loadDesignProject = async (): Promise<void> => {
  try {
    isLoading.value = true
    loadingText.value = '正在读取设计稿...'
    const result = await invokeLoadDesignProject()
    if (result.canceled || !result.content) return
    const data = parseDesignProjectFile(result.content)
    if (!data) {
      window.alert('无法解析设计稿文件，请确认是由本工具保存的 JSON。')
      return
    }
    store.applyDesignProjectFile(data)
    if (result.filePath) {
      currentFilePath.value = result.filePath
    }
  } finally {
    isLoading.value = false
  }
}

const isTypingInField = (target: EventTarget | null): boolean => {
  const el = target instanceof HTMLElement ? target : null
  if (!el) return false
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (el.isContentEditable) return true
  return el.closest('input, textarea, select, [contenteditable="true"]') !== null
}

const onDesignHotkeys = (event: KeyboardEvent): void => {
  if (store.activeView !== 'design') return

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
    event.preventDefault()
    if (currentFilePath.value) {
      saveDesignProject(true)
    } else {
      saveDesignProject(false)
    }
    return
  }

  if (isTypingInField(event.target)) return
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !event.shiftKey) {
    event.preventDefault()
    store.undoDesign()
    return
  }
  if (event.key !== 'Delete') return
  event.preventDefault()
  store.deleteSelectedElement()
}

onMounted(() => {
  window.addEventListener('keydown', onDesignHotkeys)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onDesignHotkeys)
})
</script>

<template>
  <div class="designer-page">
    <header class="topbar">
      <div class="top-left">
        <span class="title">Electron-Vite H5 Vue 设计工具</span>
      </div>
      <div class="top-center">
        <button class="tab" @click="goToTestPage">预览</button>
        <button
          v-for="tab in views"
          :key="tab.key"
          class="tab"
          :class="{ active: store.activeView === tab.key }"
          @click="store.setActiveView(tab.key)"
        >
          {{ tab.label }}
        </button>
      </div>
      <div class="top-right">
        <select
          :value="store.canvas.layoutMode"
          @change="setLayoutMode(($event.target as HTMLSelectElement).value as LayoutMode)"
        >
          <option value="absolute">绝对定位</option>
          <option value="grid">Grid 布局</option>
        </select>
        <select class="canvas-preset-select" :value="canvasPresetKey" @change="onCanvasPresetChange">
          <option value="1920x1080">1920×1080</option>
          <option value="800x600">800×600</option>
          <option value="custom">自定义尺寸…</option>
        </select>
        <div class="canvas-dim-custom" title="自定义画布宽高（像素），修改后点应用">
          <label class="dim-field">
            <span>W</span>
            <input
              v-model.number="canvasWInput"
              type="number"
              min="1"
              max="16000"
              class="dim-input"
            />
          </label>
          <span class="dim-mult">×</span>
          <label class="dim-field">
            <span>H</span>
            <input
              v-model.number="canvasHInput"
              type="number"
              min="1"
              max="16000"
              class="dim-input"
            />
          </label>
          <button type="button" class="action dim-apply" @click="applyCustomCanvasSize">应用</button>
        </div>
        <button class="action" @click="store.adjustZoom(-0.1)">-</button>
        <span class="zoom">{{ zoomPercent }}</span>
        <button class="action" @click="store.adjustZoom(0.1)">+</button>
        <button class="action" type="button" @click="saveDesignProject()">保存设计稿</button>
        <button class="action" type="button" @click="loadDesignProject()">读取设计稿</button>
        <button class="action" @click="importFromVue()">导入 .vue</button>
        <button class="action export" @click="exportCurrentAsVue()">导出 .vue</button>
      </div>
    </header>

    <main class="main-layout">
      <aside class="left-panel">
        <ElementLibrary />
      </aside>
      <section class="center-panel">
        <div v-if="store.activeView === 'design'" class="design-stack">
          <div class="design-stack-body">
            <DesignArea />
          </div>
          <footer class="design-toolbar" aria-label="设计工具栏">
            <button
              type="button"
              class="tb-btn"
              :disabled="!store.canUndoDesign"
              title="撤销上一步设计操作（Ctrl+Z）"
              @click="store.undoDesign()"
            >
              撤销
            </button>
            <button
              type="button"
              class="tb-btn"
              :disabled="!store.selectedElementId"
              title="复制选中元素（含同级偏移）"
              @click="store.duplicateSelectedElement()"
            >
              复制
            </button>
            <button
              type="button"
              class="tb-btn danger"
              :disabled="!store.selectedElementId"
              title="删除选中元素及子树"
              @click="store.deleteSelectedElement()"
            >
              删除
            </button>
            <template v-if="store.selectedElementId">
              <span class="tb-sep" aria-hidden="true" />
              <button
                type="button"
                class="tb-btn"
                :disabled="!store.canSelectParent"
                title="切换到父级节点。根节点或选中 Column 容器本身时无父级；请先选中 Column 内的子块再使用。"
                @click="store.selectParentOfSelected()"
              >
                选中上级
              </button>
              <button
                type="button"
                class="tb-btn"
                title="在父容器内垂直居中（top:50% + translateY）"
                @click="onToolbarLayoutCenter('vertical')"
              >
                垂直居中
              </button>
              <button
                type="button"
                class="tb-btn"
                title="在父容器内水平居中（left:50% + translateX）"
                @click="onToolbarLayoutCenter('horizontal')"
              >
                水平居中
              </button>
              <button
                type="button"
                class="tb-btn"
                title="在父容器内水平与垂直均居中"
                @click="onToolbarLayoutCenter('both')"
              >
                居中
              </button>
            </template>
          </footer>
        </div>
        <CodeView v-else />
      </section>
      <aside class="right-panel">
        <PropertyPanel />
        <ColumnPresetSettings
          v-if="store.activePreset?.kind === 'column' && store.selectedElement?.kind !== 'column'"
        />
        <ImagePresetSettings
          v-if="
            store.activePreset?.kind === 'image' &&
            !(store.selectedElement?.kind === 'image' && store.selectedElement?.type === 'div')
          "
        />
      </aside>
    </main>

    <div v-if="isLoading" class="global-loading-overlay">
      <div class="loading-spinner"></div>
      <div class="loading-text">{{ loadingText }}</div>
    </div>

    <div class="toast-container" :class="{ 'toast-visible': toastMessage }">
      {{ toastMessage }}
    </div>
  </div>
</template>

<style scoped>
.designer-page {
  height: 100vh;
  display: grid;
  grid-template-rows: 52px 1fr;
  background: #0b0f15;
  color: #dde5f3;
}

.topbar {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 12px;
  padding: 0 12px;
  border-bottom: 1px solid #2a2f3a;
  background: #121722;
}

.top-left .title {
  font-size: 14px;
  font-weight: 600;
}

.top-center {
  display: flex;
  gap: 8px;
}

.tab {
  border: 1px solid #30384a;
  border-radius: 6px;
  background: #1a2230;
  color: #b8c3da;
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;
}

.tab.active {
  border-color: #4f7cff;
  color: #f0f4ff;
}

.top-right {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
}

.canvas-preset-select {
  max-width: 128px;
}

.canvas-dim-custom {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #8b96ac;
}

.dim-field {
  display: flex;
  align-items: center;
  gap: 4px;
}

.dim-field span {
  min-width: 1em;
}

.dim-input {
  width: 64px;
  margin: 0;
  padding: 4px 6px;
  border: 1px solid #30384a;
  border-radius: 6px;
  background: #0f141c;
  color: #d7deec;
  font-size: 12px;
}

.dim-mult {
  color: #5c6678;
  user-select: none;
}

.dim-apply {
  padding: 4px 10px;
  flex-shrink: 0;
}

select,
.action {
  border: 1px solid #30384a;
  border-radius: 6px;
  background: #1a2230;
  color: #d2dbee;
  padding: 4px 8px;
  font-size: 12px;
}

.action {
  cursor: pointer;
}

.action.danger {
  border-color: #7d2f35;
  color: #f4c8cd;
}

.main-layout {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr) 300px;
  min-height: 0;
}

.left-panel,
.right-panel,
.center-panel {
  min-height: 0;
}

.center-panel {
  min-width: 0;
  overflow: hidden;
  position: relative;
  z-index: 1;
}

.design-stack {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.design-stack-body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.design-toolbar {
  flex-shrink: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-top: 1px solid #2a2f3a;
  background: #131822;
}

.tb-sep {
  width: 1px;
  height: 22px;
  background: #2f3748;
  flex-shrink: 0;
}

.tb-btn {
  border: 1px solid #30384a;
  border-radius: 6px;
  background: #1a2230;
  color: #d2dbee;
  padding: 6px 16px;
  font-size: 12px;
  cursor: pointer;
}

.tb-btn:hover:not(:disabled) {
  border-color: #4a5570;
  color: #eef2fb;
}

.tb-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.tb-btn.danger {
  border-color: #7d2f35;
  color: #f4c8cd;
}

.tb-btn.danger:hover:not(:disabled) {
  border-color: #a33d45;
}

.left-panel,
.right-panel {
  position: relative;
  z-index: 5;
}

.zoom {
  display: inline-flex;
  align-items: center;
  color: #aebad3;
  font-size: 12px;
  min-width: 44px;
  justify-content: center;
}

.action.export {
  border-color: #37674e;
  color: #bde8cc;
}

.global-loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(11, 15, 21, 0.8);
  backdrop-filter: blur(4px);
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #dde5f3;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #30384a;
  border-top-color: #4f7cff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

.loading-text {
  font-size: 14px;
  letter-spacing: 1px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.toast-container {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%) translateY(-20px);
  background: #4f7cff;
  color: #fff;
  padding: 8px 24px;
  border-radius: 6px;
  font-size: 14px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  z-index: 10000;
  opacity: 0;
  pointer-events: none;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.toast-visible {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}
</style>
