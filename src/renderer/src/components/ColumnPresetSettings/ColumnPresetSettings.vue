<script setup lang="ts">
import { computed } from 'vue'
import { useDesignStore } from '@renderer/store/design'
import type { ColumnPreset } from '@renderer/types/design'

const store = useDesignStore()

const columnPreset = computed<ColumnPreset | null>(() => {
  const p = store.activePreset
  return p && p.kind === 'column' ? p : null
})

const setWidth = (value: number): void => {
  if (!columnPreset.value) return
  if (!Number.isFinite(value)) return
  const next = Math.max(1, Math.round(value))
  store.updateActivePreset({ width: next } as Partial<ColumnPreset>)
}

const setHeight = (value: number): void => {
  if (!columnPreset.value) return
  if (!Number.isFinite(value)) return
  const next = Math.max(1, Math.round(value))
  store.updateActivePreset({ height: next } as Partial<ColumnPreset>)
}

const setChildCount = (value: number): void => {
  if (!columnPreset.value) return
  const next = Math.max(1, Math.floor(value))
  store.updateActivePreset({ childCount: next } as Partial<ColumnPreset>)
}
</script>

<template>
  <section class="panel preset-panel">
    <h3>Column 放置前预设</h3>
    <div v-if="columnPreset" class="form">
      <label>
        宽度（px）
        <input
          type="number"
          :value="columnPreset.width"
          @change="setWidth(Number(($event.target as HTMLInputElement).value))"
        />
      </label>
      <label>
        高度（px）
        <input
          type="number"
          :value="columnPreset.height"
          @change="setHeight(Number(($event.target as HTMLInputElement).value))"
        />
      </label>
      <label>
        子元素数量
        <input
          type="number"
          :value="columnPreset.childCount"
          @change="setChildCount(Number(($event.target as HTMLInputElement).value))"
        />
      </label>
      <div class="hint">激活后点击设计视图即可按此配置添加 Column。</div>
    </div>
  </section>
</template>

<style scoped>
.panel {
  height: 100%;
  padding: 12px;
  border-left: 1px solid #2a2f3a;
  background: #161a22;
  overflow: auto;
  position: relative;
  z-index: 10;
}

h3 {
  margin: 0 0 12px;
  font-size: 14px;
  color: #c8d0df;
}

.form {
  display: grid;
  gap: 10px;
}

label {
  display: grid;
  gap: 6px;
  color: #a5b2ca;
  font-size: 12px;
}

input {
  width: 100%;
  background: #0f141c;
  color: #d7deec;
  border: 1px solid #2f3748;
  border-radius: 6px;
  padding: 6px 8px;
  pointer-events: auto;
}

.hint {
  margin-top: 10px;
  color: #8b96ac;
  font-size: 12px;
  line-height: 1.4;
}
</style>

