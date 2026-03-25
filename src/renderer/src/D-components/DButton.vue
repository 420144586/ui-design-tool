<script setup lang="ts">
import { computed } from 'vue'

defineOptions({ name: 'DButton' })

const props = defineProps<{
  /** 设计器 / 数据里的背景色；空或 transparent 时保留组件默认渐变 */
  surfaceBackground?: string
}>()

const surfaceStyle = computed(() => {
  const bg = props.surfaceBackground?.trim()
  if (!bg || bg.toLowerCase() === 'transparent') return {}
  return { background: bg }
})
</script>

<template>
  <button type="button" class="d-button" :style="surfaceStyle">按钮</button>
</template>

<style scoped>
/* :where 降低优先级，便于外部 class 覆盖（属性面板追加的类或项目全局样式） */
:where(.d-button) {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  padding: 8px 16px;
  border-radius: 6px;
  border: 1px solid #4f7cff;
  background: linear-gradient(180deg, #5b8cff 0%, #4f7cff 100%);
  color: #fff;
  cursor: pointer;
  font-size: 14px;
}
</style>

<style>
/* 设计器内可直接在属性面板填写以下 class 名预览效果；导出后请在页面中保留对应样式或使用自己的类名 */
.d-button.d-button--ghost {
  background: transparent;
  color: #8fb2ff;
  border-color: #5a7ddb;
}
.d-button.d-button--danger {
  border-color: #c44;
  background: linear-gradient(180deg, #e05555 0%, #c62828 100%);
  color: #fff;
}
.d-button.d-button--success {
  border-color: #2e7d32;
  background: linear-gradient(180deg, #4caf50 0%, #2e7d32 100%);
  color: #fff;
}
.d-button.d-button--pill {
  border-radius: 999px;
}
.d-button.d-button--compact {
  padding: 4px 10px;
  font-size: 12px;
}
</style>
