<script setup lang="ts">
import NumericInput from '@renderer/components/NumericInput/NumericInput.vue'
import { useDesignStore } from '@renderer/store/design'
import type { VirtualEnvPosition } from '@renderer/types/design'

const store = useDesignStore()

const positions: { value: VirtualEnvPosition; label: string }[] = [
  { value: 'relative', label: 'relative（常规文档流）' },
  { value: 'absolute', label: 'absolute（相对定位上下文）' },
  { value: 'fixed', label: 'fixed（相对视口）' },
  { value: 'static', label: 'static' }
]

const patch = store.patchVirtualEnv
</script>

<template>
  <section class="ve-panel">
    <h3 class="title">虚拟环境属性</h3>
    <p class="intro">
      虚拟环境是独立预览场景，与标准画布的数据（尺寸、网格、布局模式）互不关联，仅用于在设备框内查看设计元素。设备内不滚动，由中间设计区滚动。TitleBar
      / Footer 可设 position 与高度。
    </p>

    <div class="group">
      <div class="group-title">设备尺寸（px）</div>
      <div class="row">
        <label class="half">
          宽
          <NumericInput
            :model-value="store.virtualEnv.width"
            :min="1"
            :max="16000"
            @update:model-value="patch({ width: $event })"
          />
        </label>
        <label class="half">
          高
          <NumericInput
            :model-value="store.virtualEnv.height"
            :min="1"
            :max="16000"
            @update:model-value="patch({ height: $event })"
          />
        </label>
      </div>
    </div>

    <div class="group">
      <div class="group-title">环境背景色</div>
      <div class="color-row">
        <input
          type="color"
          :value="store.virtualEnv.background"
          class="color-picker"
          @input="patch({ background: ($event.target as HTMLInputElement).value })"
        />
        <input
          type="text"
          :value="store.virtualEnv.background"
          class="color-text"
          @input="patch({ background: ($event.target as HTMLInputElement).value })"
        />
      </div>
    </div>

    <div class="group">
      <div class="group-title">position（设备外框）</div>
      <select
        class="select"
        :value="store.virtualEnv.position"
        @change="patch({ position: ($event.target as HTMLSelectElement).value as VirtualEnvPosition })"
      >
        <option v-for="p in positions" :key="p.value" :value="p.value">{{ p.label }}</option>
      </select>
    </div>

    <div class="group">
      <div class="group-title">业务页占位（预览，叠在满屏画布上）</div>
      <label class="check">
        <input
          type="checkbox"
          :checked="store.virtualEnv.presetTitleBar"
          @change="patch({ presetTitleBar: ($event.target as HTMLInputElement).checked })"
        />
        预设 TitleBar / 状态栏
      </label>
      <label class="field-label">TitleBar position</label>
      <select
        class="select select-tight"
        :value="store.virtualEnv.presetTitleBarPosition"
        @change="
          patch({ presetTitleBarPosition: ($event.target as HTMLSelectElement).value as VirtualEnvPosition })
        "
      >
        <option v-for="p in positions" :key="'tb-' + p.value" :value="p.value">{{ p.label }}</option>
      </select>
      <label class="field-label">TitleBar 高度（px）</label>
      <NumericInput
        class="chrome-dim-input"
        :model-value="store.virtualEnv.presetTitleBarHeight ?? 36"
        :min="8"
        :max="400"
        @update:model-value="patch({ presetTitleBarHeight: $event })"
      />
      <label class="check">
        <input
          type="checkbox"
          :checked="store.virtualEnv.presetFooter"
          @change="patch({ presetFooter: ($event.target as HTMLInputElement).checked })"
        />
        预设 Footer / 底栏
      </label>
      <label class="field-label">Footer position</label>
      <select
        class="select select-tight"
        :value="store.virtualEnv.presetFooterPosition"
        @change="
          patch({ presetFooterPosition: ($event.target as HTMLSelectElement).value as VirtualEnvPosition })
        "
      >
        <option v-for="p in positions" :key="'fb-' + p.value" :value="p.value">{{ p.label }}</option>
      </select>
      <label class="field-label">Footer 高度（px）</label>
      <NumericInput
        class="chrome-dim-input"
        :model-value="store.virtualEnv.presetFooterHeight ?? 44"
        :min="8"
        :max="400"
        @update:model-value="patch({ presetFooterHeight: $event })"
      />
    </div>
  </section>
</template>

<style scoped>
.ve-panel {
  padding: 10px 12px;
  height: 100%;
  overflow: auto;
  box-sizing: border-box;
}

.title {
  margin: 0 0 8px;
  font-size: 14px;
  color: #c8d0df;
}

.intro {
  margin: 0 0 14px;
  font-size: 11px;
  line-height: 1.5;
  color: #8b96ac;
}

.group {
  margin-bottom: 16px;
  padding-bottom: 14px;
  border-bottom: 1px solid #2a2f3a;
}

.group:last-child {
  border-bottom: none;
  margin-bottom: 0;
  padding-bottom: 0;
}

.group-title {
  font-size: 12px;
  font-weight: 600;
  color: #c8d0df;
  margin-bottom: 10px;
  padding-left: 4px;
  border-left: 3px solid #6b7cff;
}

.row {
  display: flex;
  gap: 10px;
}

.half {
  flex: 1;
  min-width: 0;
  display: block;
  font-size: 12px;
  color: #a5b2ca;
}

.half input {
  margin-top: 4px;
  width: 100%;
  padding: 6px 8px;
  border: 1px solid #2f3748;
  border-radius: 6px;
  background: #0f141c;
  color: #d7deec;
  font-size: 12px;
  box-sizing: border-box;
}

.color-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.color-picker {
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid #2f3748;
  border-radius: 6px;
  background: none;
  cursor: pointer;
  flex-shrink: 0;
}

.color-text {
  flex: 1;
  min-width: 0;
  padding: 6px 8px;
  border: 1px solid #2f3748;
  border-radius: 6px;
  background: #0f141c;
  color: #d7deec;
  font-size: 12px;
}

.select {
  width: 100%;
  margin-top: 2px;
  padding: 6px 8px;
  border: 1px solid #2f3748;
  border-radius: 6px;
  background: #0f141c;
  color: #d7deec;
  font-size: 12px;
}

.check {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #a5b2ca;
  margin-bottom: 8px;
  cursor: pointer;
}

.check:last-child {
  margin-bottom: 0;
}

.field-label {
  display: block;
  font-size: 11px;
  color: #8b96ac;
  margin: 8px 0 4px;
}

.select-tight {
  margin-bottom: 8px;
}

.chrome-dim-input {
  width: 100%;
  margin-bottom: 10px;
}

.check input {
  width: auto;
  margin: 0;
}
</style>
