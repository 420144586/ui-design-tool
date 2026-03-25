<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
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

const store = useDesignStore()
const router = useRouter()

const views: Array<{ key: ViewMode; label: string }> = [
  { key: 'design', label: '设计视图' },
  { key: 'template', label: '模板代码' },
  { key: 'script', label: 'JS 代码' },
  { key: 'style', label: 'CSS 样式' }
]

const setLayoutMode = (mode: LayoutMode): void => store.setLayoutMode(mode)
const zoomPercent = computed(() => `${Math.round(store.canvas.zoom * 100)}%`)

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
  const result = await window.api.importVueFile()
  if (!result.ok || !result.content) return
  const imported = importVueToDesignElements(result.content, store.canvas.gridSize)
  store.setLayoutMode(imported.layoutMode)
  store.replaceElements(imported.elements)
  store.setActiveView('design')
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
  if (isTypingInField(event.target)) return
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
        <button class="tab" @click="goToTestPage">测试页面</button>
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
        <select
          @change="
            store.setCanvasPreset(
              ($event.target as HTMLSelectElement).value as '1920x1080' | '800x600'
            )
          "
        >
          <option value="1920x1080">1920x1080</option>
          <option value="800x600">800x600</option>
        </select>
        <button class="action" @click="store.adjustZoom(-0.1)">-</button>
        <span class="zoom">{{ zoomPercent }}</span>
        <button class="action" @click="store.adjustZoom(0.1)">+</button>
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
  justify-content: flex-end;
  gap: 8px;
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
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-top: 1px solid #2a2f3a;
  background: #131822;
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
</style>
