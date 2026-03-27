<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useDesignStore } from '@renderer/store/design'
import { generatePreviewHtml } from '@renderer/utils/codegen'

const route = useRoute()
const store = useDesignStore()
const replayKey = ref(0)
const previewHtml = ref('')
const loadHint = ref('')
const previewDirInfo = ref('')

onMounted(async () => {
  try {
    const info = await window.api.getPreviewDir()
    previewDirInfo.value = `userData: ${info.userDataPath}  |  预览目录: ${info.previewDir}`
  } catch {
    previewDirInfo.value = '（无法获取预览目录信息）'
  }
})

const loadPreview = async (): Promise<void> => {
  loadHint.value = ''

  if (store.canonicalElements.length > 0) {
    previewHtml.value = generatePreviewHtml(
      store.canonicalElements,
      store.canvas.layoutMode,
      { width: store.canvas.width, height: store.canvas.height, gridSize: store.canvas.gridSize }
    )
    loadHint.value = '（从内存 store 生成）'
    return
  }

  try {
    const r = await window.api.readGeneratedPreview()
    if (r.ok && r.content?.trim()) {
      previewHtml.value = r.content
      loadHint.value = `（从文件加载：${r.filePath}）`
      return
    }
    loadHint.value = r.filePath
      ? `预览文件不存在：${r.filePath}`
      : '尚未生成预览。请先在设计视图创建设计或加载设计稿。'
  } catch (e) {
    loadHint.value = `读取预览失败：${e instanceof Error ? e.message : String(e)}`
  }
  previewHtml.value = ''
}

watch(
  () => [route.fullPath, replayKey.value] as const,
  () => {
    if (route.path.includes('/generated')) {
      void loadPreview()
    }
  },
  { immediate: true }
)
</script>

<template>
  <div class="test-generated">
    <p v-if="loadHint" class="preview-hint">{{ loadHint }}</p>
    <iframe
      v-if="previewHtml"
      :srcdoc="previewHtml"
      :key="replayKey"
      class="preview-iframe"
    />
    <p v-if="previewDirInfo" class="dir-info">{{ previewDirInfo }}</p>
  </div>
</template>

<style scoped>
.test-generated {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.preview-hint {
  font-size: 11px;
  color: #8b96ac;
  margin: 0 0 8px;
  padding: 6px 8px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 6px;
  flex-shrink: 0;
}

.preview-iframe {
  flex: 1;
  width: 100%;
  border: none;
  background: #fff;
  border-radius: 6px;
}

.dir-info {
  font-size: 10px;
  color: #5c6678;
  margin: 4px 0 0;
  padding: 4px 8px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 4px;
  flex-shrink: 0;
  word-break: break-all;
  user-select: all;
}
</style>
