<script setup lang="ts">
import { useDesignStore } from '@renderer/store/design'
import type { ElementPreset } from '@renderer/types/design'
import {
  BASIC_ELEMENT_PRESETS,
  COMPONENT_LIBRARY_PRESETS
} from '@renderer/data/elementLibraryPresets'
import { resolveTableCols, resolveTableRows } from '@renderer/utils/tableDimensions'

const store = useDesignStore()

const basicPresets = BASIC_ELEMENT_PRESETS
const componentPresets = COMPONENT_LIBRARY_PRESETS

const isActive = (item: ElementPreset): boolean => store.activePreset?.name === item.name

const selectPreset = (item: ElementPreset): void => {
  if (isActive(item)) {
    store.setActivePreset(null)
    return
  }
  store.setActivePreset(item)
}
</script>

<template>
  <section class="panel">
    <h3>元素库</h3>
    <div class="list">
      <button
        v-for="element in basicPresets"
        :key="element.name"
        class="item"
        :class="{ active: isActive(element) }"
        @click="selectPreset(element)"
      >
        <div class="item-title">{{ element.name }}</div>
        <div class="item-meta">
          {{ element.width }} × {{ element.height }}
          <template v-if="element.kind === 'image' && element.hasLabel"> · Label</template>
          <template v-if="element.kind === 'table'">
            · {{ resolveTableRows(element.tableRows) }}×{{ resolveTableCols(element.tableCols) }}
          </template>
        </div>
      </button>
    </div>

    <h3 class="section-title">组件</h3>
    <div class="list">
      <button
        v-for="element in componentPresets"
        :key="element.name"
        class="item"
        :class="{ active: isActive(element) }"
        @click="selectPreset(element)"
      >
        <div class="item-title">{{ element.name }}</div>
        <div class="item-meta">Vue 组件 · {{ element.width }} × {{ element.height }}</div>
      </button>
    </div>
  </section>
</template>

<style scoped>
.panel {
  height: 100%;
  min-height: 0;
  padding: 12px;
  border-right: 1px solid #2a2f3a;
  background: #161a22;
  overflow: auto;
  box-sizing: border-box;
}

h3 {
  margin: 0 0 12px;
  font-size: 14px;
  color: #c8d0df;
}

.section-title {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid #2a2f3a;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.item {
  width: 100%;
  text-align: left;
  padding: 10px;
  border-radius: 6px;
  border: 1px dashed #394052;
  background: #1d2330;
  cursor: pointer;
}

.item.active {
  border-color: #4f7cff;
  background: #1b2b4c;
}

.item-title {
  color: #dce3f2;
  font-size: 13px;
}

.item-meta {
  margin-top: 4px;
  color: #9aa6bf;
  font-size: 12px;
}
</style>
