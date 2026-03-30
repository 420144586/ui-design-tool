<script setup lang="ts">
import { computed } from 'vue'

defineOptions({ name: 'DInput' })

const props = defineProps<{
  /** 设计器 / 数据里的背景色；空或 transparent 时用组件默认白色 */
  surfaceBackground?: string
  placeholder?: string
}>()

const surfaceStyle = computed(() => {
  const bg = props.surfaceBackground?.trim()
  if (!bg || bg.toLowerCase() === 'transparent') return {}
  return { background: bg }
})
</script>

<template>
  <input
    type="text"
    class="d-input"
    :style="surfaceStyle"
    :placeholder="placeholder ?? ''"
  />
</template>

<style scoped>
:where(.d-input) {
  display: block;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  margin: 0;
  padding: 0 14px;
  border-radius: 2px;
  border: 1.5px solid #becad6;
  background: #fff;
  color: #39434e;
  font-size: 22px;
  outline: none;
}

:where(.d-input)::placeholder {
  color: #818f9b;
  opacity: 1;
}
</style>
