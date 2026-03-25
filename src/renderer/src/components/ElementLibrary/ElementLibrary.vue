<script setup lang="ts">
import { ref } from 'vue'
import { useDesignStore } from '@renderer/store/design'
import type { ElementPreset } from '@renderer/types/design'

const store = useDesignStore()

const basicPresets = ref<ElementPreset[]>([
  {
    kind: 'div',
    type: 'div',
    name: 'Div 50x50',
    width: 50,
    height: 50,
    background: '#4f7cff',
    text: '',
    opacity: 0.9
  },
  {
    kind: 'div',
    type: 'div',
    name: 'Div 100x100',
    width: 100,
    height: 100,
    background: '#39b56a',
    text: '',
    opacity: 0.9
  },
  {
    kind: 'div',
    type: 'div',
    name: 'Div 300x300',
    width: 300,
    height: 300,
    background: '#ff8f3e',
    text: '',
    opacity: 0.9
  },
  {
    kind: 'column',
    type: 'div',
    name: 'Column 容器',
    width: 200,
    height: 400,
    background: '#7b5cff',
    text: '',
    opacity: 0.9,
    childCount: 8
  },
  {
    kind: 'image',
    type: 'div',
    name: 'Image 块',
    width: 30,
    height: 30,
    background: 'transparent',
    text: '',
    opacity: 1,
    hasLabel: false,
    gap: 10,
    imageSrc: ''
  },
  {
    kind: 'table',
    type: 'table',
    name: 'Table 5×5',
    width: 250,
    height: 250,
    background: '#1a1f2b',
    text: '',
    opacity: 1,
    tableRows: 5,
    tableCols: 5,
    borderColor: '#d0d0d0'
  }
])

const componentPresets = ref<ElementPreset[]>([
  {
    kind: 'dcomponent',
    type: 'div',
    name: 'DButton',
    width: 120,
    height: 40,
    background: 'transparent',
    text: '',
    opacity: 1,
    componentKey: 'DButton'
  }
])

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
            · {{ element.tableRows }}×{{ element.tableCols }}
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
  padding: 12px;
  border-right: 1px solid #2a2f3a;
  background: #161a22;
  overflow: auto;
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
