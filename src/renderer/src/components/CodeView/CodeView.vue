<script setup lang="ts">
import { computed } from 'vue'
import { useDesignStore } from '@renderer/store/design'
import {
  generateVueSfcCode,
  generateScriptCode,
  generateStyleCode,
  generateTemplateCode
} from '@renderer/utils/codegen'

const store = useDesignStore()

/** 与保存/导出一致：始终基于标准工作区权威数据，与虚拟预览中的临时编辑分离 */
const codegenCanvas = computed(() => ({
  width: store.canvas.width,
  height: store.canvas.height,
  gridSize: store.canvas.gridSize
}))

const templateCode = computed(() =>
  generateTemplateCode(store.canonicalElements, store.canvas.layoutMode)
)
const scriptCode = computed(() => generateScriptCode(store.canonicalElements))
const styleCode = computed(() =>
  generateStyleCode(store.canonicalElements, store.canvas.layoutMode, codegenCanvas.value)
)

const currentCode = computed(() => {
  if (store.activeView === 'template') return templateCode.value
  if (store.activeView === 'script') return scriptCode.value
  return styleCode.value
})

const exportVueFile = async (): Promise<void> => {
  const content = generateVueSfcCode(store.canonicalElements, store.canvas.layoutMode, codegenCanvas.value)
  await window.api.exportVueFile(content, 'generated-component.vue')
}
</script>

<template>
  <section class="code-view">
    <div class="code-toolbar">
      <button @click="exportVueFile">导出 .vue 文件</button>
    </div>
    <pre><code>{{ currentCode }}</code></pre>
  </section>
</template>

<style scoped>
.code-view {
  height: 100%;
  overflow: auto;
  background: #0d1117;
  border: 1px solid #2a313d;
  border-radius: 8px;
}

pre {
  margin: 0;
  padding: 16px;
  color: #d9e1ee;
  font-size: 12px;
  line-height: 1.5;
}

.code-toolbar {
  display: flex;
  justify-content: flex-end;
  padding: 8px 10px 0;
}

.code-toolbar button {
  border: 1px solid #33507a;
  background: #16263a;
  color: #d8e7ff;
  border-radius: 6px;
  font-size: 12px;
  padding: 4px 10px;
  cursor: pointer;
}
</style>
