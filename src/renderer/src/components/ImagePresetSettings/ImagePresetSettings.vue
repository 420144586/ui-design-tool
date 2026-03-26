<script setup lang="ts">
import { computed } from 'vue'
import NumericInput from '@renderer/components/NumericInput/NumericInput.vue'
import { useDesignStore } from '@renderer/store/design'
import type { ImagePreset } from '@renderer/types/design'

const store = useDesignStore()

const imagePreset = computed<ImagePreset | null>(() => {
  const p = store.activePreset
  return p && p.kind === 'image' ? p : null
})

const setHasLabel = (checked: boolean): void => {
  if (!imagePreset.value) return
  if (checked) {
    store.updateActivePreset({
      hasLabel: true,
      width: 130,
      height: 50,
      gap: imagePreset.value.gap ?? 10
    } as Partial<ImagePreset>)
    return
  }
  store.updateActivePreset({
    hasLabel: false,
    width: 30,
    height: 30
  } as Partial<ImagePreset>)
}

const setGap = (value: number): void => {
  if (!imagePreset.value) return
  if (!Number.isFinite(value)) return
  store.updateActivePreset({ gap: Math.max(0, Math.floor(value)) } as Partial<ImagePreset>)
}
</script>

<template>
  <section v-if="imagePreset" class="panel preset-panel">
    <h3>Image 放置前预设</h3>
    <div class="form">
      <label class="check">
        <input
          type="checkbox"
          :checked="imagePreset.hasLabel"
          @change="setHasLabel(($event.target as HTMLInputElement).checked)"
        />
        Label（右侧文案区，默认 130×50）
      </label>
      <label>
        元素间距 gap（px）
        <NumericInput
          :model-value="imagePreset.gap ?? 10"
          :min="0"
          @update:model-value="setGap($event)"
        />
      </label>
      <div class="hint">左侧图为 30×30；带 Label 时右侧 div 最小宽度 100、最大宽度由 flex 决定。</div>
    </div>
  </section>
</template>

<style scoped>
.panel {
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

label.check {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
}

label.check input {
  width: auto;
  margin: 0;
}

input[type='number'] {
  width: 100%;
  background: #0f141c;
  color: #d7deec;
  border: 1px solid #2f3748;
  border-radius: 6px;
  padding: 6px 8px;
}

.hint {
  color: #8b96ac;
  font-size: 12px;
  line-height: 1.4;
}
</style>
