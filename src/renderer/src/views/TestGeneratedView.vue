<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import GeneratedFromDesigner from '@renderer/generated/GeneratedFromDesigner.vue'
import { resetTestAnimDebugBridge, testAnimDebugBridge } from '@renderer/utils/testAnimDebugBridge'

/** 生成页通过 defineExpose 暴露（需从设计器重新导出后才有） */
type GenExpose = { animShow?: Record<string, boolean> }

const replayKey = ref(0)
const genRef = ref<GenExpose | null>(null)

const animShowRef = computed(() => genRef.value?.animShow)

const animIds = computed(() => {
  const a = animShowRef.value
  if (!a) return [] as string[]
  return Object.keys(a)
})

const hasAnimShow = computed(() => animIds.value.length > 0)

const animShowJson = computed(() => {
  const a = animShowRef.value
  if (!a) return '（无 animShow：时机选 hidden / v-if / v-show 并重新导出）'
  try {
    return JSON.stringify({ ...a }, null, 0)
  } catch {
    return '—'
  }
})

const replayAppear = (): void => {
  replayKey.value += 1
}

const setAll = (v: boolean): void => {
  const a = animShowRef.value
  if (!a) return
  for (const k of Object.keys(a)) {
    a[k] = v
  }
}

const setOne = (id: string, v: boolean): void => {
  const a = animShowRef.value
  if (!a) return
  a[id] = v
}

function syncBridge(): void {
  testAnimDebugBridge.active = true
  testAnimDebugBridge.replayAppear = replayAppear
  testAnimDebugBridge.setAll = setAll
  testAnimDebugBridge.setOne = setOne
  testAnimDebugBridge.hasAnimShow = hasAnimShow.value
  testAnimDebugBridge.animIds = [...animIds.value]
  testAnimDebugBridge.animShowJson = animShowJson.value
}

watch(
  [hasAnimShow, animIds, animShowJson, replayKey],
  () => {
    syncBridge()
  },
  { immediate: true }
)
watch(animShowRef, () => syncBridge(), { deep: true })

onUnmounted(() => {
  resetTestAnimDebugBridge()
})
</script>

<template>
  <div class="test-generated">
    <GeneratedFromDesigner ref="genRef" :key="replayKey" />
  </div>
</template>

<style scoped>
.test-generated {
  height: 100%;
  min-height: 0;
  overflow: auto;
}
</style>
