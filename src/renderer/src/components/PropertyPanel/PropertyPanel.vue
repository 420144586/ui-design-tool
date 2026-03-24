<script setup lang="ts">
import { computed } from 'vue'
import { useDesignStore } from '@renderer/store/design'
import type { DesignElement } from '@renderer/types/design'

const store = useDesignStore()

const selected = computed(() => store.selectedElement)

const update = <K extends keyof DesignElement>(key: K, value: DesignElement[K]): void => {
  if (!selected.value) return
  store.updateElement(selected.value.id, { [key]: value } as Partial<DesignElement>)
}
</script>

<template>
  <section class="panel">
    <h3>属性面板</h3>
    <template v-if="selected">
      <label>
        文本
        <input
          :value="selected.text"
          @input="update('text', ($event.target as HTMLInputElement).value)"
        />
      </label>
      <label>
        X
        <input
          type="number"
          :value="selected.x"
          @input="update('x', Number(($event.target as HTMLInputElement).value))"
        />
      </label>
      <label>
        Y
        <input
          type="number"
          :value="selected.y"
          @input="update('y', Number(($event.target as HTMLInputElement).value))"
        />
      </label>
      <label>
        宽度
        <input
          type="number"
          :value="selected.width"
          @input="update('width', Number(($event.target as HTMLInputElement).value))"
        />
      </label>
      <label>
        高度
        <input
          type="number"
          :value="selected.height"
          @input="update('height', Number(($event.target as HTMLInputElement).value))"
        />
      </label>
      <label>
        背景色
        <input
          :value="selected.background"
          @input="update('background', ($event.target as HTMLInputElement).value)"
        />
      </label>
    </template>
    <p v-else class="empty">请选择一个元素后编辑属性</p>
  </section>
</template>

<style scoped>
.panel {
  height: 100%;
  padding: 12px;
  border-left: 1px solid #2a2f3a;
  background: #161a22;
  overflow: auto;
}

h3 {
  margin: 0 0 12px;
  font-size: 14px;
  color: #c8d0df;
}

label {
  display: block;
  margin-bottom: 10px;
  color: #a5b2ca;
  font-size: 12px;
}

input {
  margin-top: 4px;
  width: 100%;
  background: #0f141c;
  color: #d7deec;
  border: 1px solid #2f3748;
  border-radius: 6px;
  padding: 6px 8px;
}

.empty {
  color: #8b96ac;
  font-size: 12px;
}
</style>
