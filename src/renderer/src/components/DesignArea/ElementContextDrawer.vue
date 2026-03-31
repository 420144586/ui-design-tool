<script setup lang="ts">
import { computed, nextTick, onUnmounted, watch } from 'vue'
import type { ElementPreset } from '@renderer/types/design'
import { BASIC_ELEMENT_PRESETS, COMPONENT_LIBRARY_PRESETS } from '@renderer/data/elementLibraryPresets'

const props = defineProps<{
  visible: boolean
  anchorX: number
  anchorY: number
}>()

const emit = defineEmits<{
  pick: [preset: ElementPreset]
  close: []
}>()

function pick(preset: ElementPreset): void {
  emit('pick', preset)
  emit('close')
}

function onDocPointerDown(e: PointerEvent): void {
  const t = e.target as Node | null
  const panel = document.querySelector('.element-context-drawer')
  if (panel && t && panel.contains(t)) return
  emit('close')
}

watch(
  () => props.visible,
  (v) => {
    document.removeEventListener('pointerdown', onDocPointerDown, true)
    if (!v) return
    nextTick(() => {
      setTimeout(() => {
        document.addEventListener('pointerdown', onDocPointerDown, true)
      }, 0)
    })
  }
)

onUnmounted(() => {
  document.removeEventListener('pointerdown', onDocPointerDown, true)
})

const panelPositionStyle = computed((): Record<string, string> => {
  const w = 280
  const maxH = 420
  const x = Math.min(props.anchorX, Math.max(8, window.innerWidth - w - 8))
  const y = Math.min(props.anchorY, Math.max(8, window.innerHeight - maxH - 8))
  return {
    left: `${x}px`,
    top: `${y}px`,
    width: `${w}px`,
    maxHeight: `${maxH}px`
  }
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="element-context-drawer"
      :style="panelPositionStyle"
      role="dialog"
      aria-label="插入子元素"
      @contextmenu.prevent
    >
      <div class="drawer-head">插入为子元素</div>
      <div class="drawer-scroll">
        <h4 class="sub">元素库</h4>
        <div class="list">
          <button
            v-for="el in BASIC_ELEMENT_PRESETS"
            :key="el.name"
            type="button"
            class="item"
            @click="pick(el)"
          >
            <span class="item-title">{{ el.name }}</span>
            <span class="item-meta">
              {{ el.width }} × {{ el.height }}
              <template v-if="el.kind === 'image' && el.hasLabel"> · Label</template>
              <template v-if="el.kind === 'table'">
                · {{ el.tableRows }}×{{ el.tableCols }}
              </template>
            </span>
          </button>
        </div>
        <h4 class="sub sub-border">组件库</h4>
        <div class="list">
          <button
            v-for="el in COMPONENT_LIBRARY_PRESETS"
            :key="el.name"
            type="button"
            class="item"
            @click="pick(el)"
          >
            <span class="item-title">{{ el.name }}</span>
            <span class="item-meta">Vue 组件 · {{ el.width }} × {{ el.height }}</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.element-context-drawer {
  position: fixed;
  z-index: 100000;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  border-radius: 10px;
  border: 1px solid #2f3d52;
  background: #161a22;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
  overflow: hidden;
}

.drawer-head {
  flex-shrink: 0;
  padding: 10px 12px;
  font-size: 13px;
  font-weight: 600;
  color: #dce3f2;
  border-bottom: 1px solid #2a2f3a;
  background: #1e2430;
}

.drawer-scroll {
  overflow: auto;
  padding: 10px 10px 12px;
  min-height: 0;
}

.sub {
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 600;
  color: #9aa6bf;
}

.sub-border {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid #2a2f3a;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.item {
  width: 100%;
  text-align: left;
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px dashed #394052;
  background: #1d2330;
  cursor: pointer;
  font: inherit;
}

.item:hover {
  border-color: #4f7cff;
  background: #1b2738;
}

.item-title {
  display: block;
  color: #dce3f2;
  font-size: 13px;
}

.item-meta {
  display: block;
  margin-top: 4px;
  color: #8b96ac;
  font-size: 11px;
}
</style>
