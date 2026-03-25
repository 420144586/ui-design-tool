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

const isColumnContainer = computed(
  () => selected.value?.kind === 'column'
)

const isImageStandalone = computed(
  () => selected.value?.kind === 'image' && selected.value?.type === 'img'
)
const isImageContainer = computed(
  () => selected.value?.kind === 'image' && selected.value?.type === 'div'
)
const isTable = computed(() => selected.value?.kind === 'table')

const isDComponent = computed(() => selected.value?.kind === 'dcomponent')
const dButtonHint =
  '每个实例根节点会带唯一 class（与元素 id 相同，如 el-xxx），可写 .el-xxx { … } 只影响当前按钮。修饰示例：d-button--ghost d-button--danger（空格分隔）'

const setColumnChildCount = (raw: number): void => {
  if (!selected.value || selected.value.kind !== 'column') return
  if (!Number.isFinite(raw)) return
  store.updateColumnChildCount(selected.value.id, raw)
}

const setImageGap = (raw: number): void => {
  if (!selected.value || selected.value.kind !== 'image' || selected.value.type !== 'div') return
  if (!Number.isFinite(raw)) return
  store.updateElement(selected.value.id, { gap: Math.max(0, Math.floor(raw)) })
}

const setImageHasLabel = (checked: boolean): void => {
  const s = selected.value
  if (!s || s.kind !== 'image') return
  store.setImageHasLabelForSelectedStyle(s.id, checked)
}
</script>

<template>
  <section class="panel">
    <h3>属性面板</h3>
    <template v-if="selected">
      <label v-if="!isDComponent">
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
      <label v-if="isColumnContainer">
        子元素数量
        <input
          type="number"
          min="1"
          :value="selected.childCount ?? 1"
          @change="setColumnChildCount(Number(($event.target as HTMLInputElement).value))"
        />
      </label>
      <template v-if="isImageStandalone">
        <label>
          图片地址
          <input
            :value="selected.imageSrc ?? ''"
            @input="update('imageSrc', ($event.target as HTMLInputElement).value)"
          />
        </label>
        <label class="check">
          <input
            type="checkbox"
            :checked="false"
            @change="setImageHasLabel(($event.target as HTMLInputElement).checked)"
          />
          带 Label（转为 div 容器）
        </label>
      </template>
      <template v-else-if="isTable">
        <label>
          行数
          <input
            type="number"
            min="1"
            :value="selected.tableRows ?? 5"
            @input="
              update('tableRows', Number(($event.target as HTMLInputElement).value))
            "
          />
        </label>
        <label>
          列数
          <input
            type="number"
            min="1"
            :value="selected.tableCols ?? 5"
            @input="
              update('tableCols', Number(($event.target as HTMLInputElement).value))
            "
          />
        </label>
        <label>
          边框颜色
          <input
            :value="selected.borderColor ?? '#d0d0d0'"
            @input="update('borderColor', ($event.target as HTMLInputElement).value)"
          />
        </label>
      </template>
      <template v-else-if="isDComponent">
        <label>
          组件样式 class
          <input
            :value="selected.componentClass ?? ''"
            placeholder="例：d-button--ghost"
            :title="dButtonHint"
            @input="
              update(
                'componentClass',
                ($event.target as HTMLInputElement).value.replace(/[^\w\s-]/g, '')
              )
            "
          />
        </label>
        <p class="field-hint">{{ dButtonHint }}</p>
      </template>
      <template v-else-if="isImageContainer">
        <label class="check">
          <input
            type="checkbox"
            :checked="!!selected.hasLabel"
            @change="setImageHasLabel(($event.target as HTMLInputElement).checked)"
          />
          Label（右侧文案区）
        </label>
        <label>
          元素间距 gap（px）
          <input
            type="number"
            min="0"
            :value="selected.gap ?? 10"
            @change="setImageGap(Number(($event.target as HTMLInputElement).value))"
          />
        </label>
        <label>
          图片地址
          <input
            :value="selected.imageSrc ?? ''"
            @input="update('imageSrc', ($event.target as HTMLInputElement).value)"
          />
        </label>
      </template>
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

.field-hint {
  margin: -4px 0 10px;
  font-size: 11px;
  color: #6b7589;
  line-height: 1.4;
}
</style>
