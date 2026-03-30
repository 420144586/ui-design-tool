<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: number
    min?: number
    max?: number
    /** 附加到 input 的 class，如 angle-input */
    inputClass?: string
    /**
     * 属性面板当前编辑的设计元素 id；失焦提交时一并传出，避免先切换选中后 blur 把值写到错元素上
     */
    ownerElementId?: string | null
  }>(),
  {
    min: undefined,
    max: undefined,
    inputClass: '',
    ownerElementId: null
  }
)

const emit = defineEmits<{
  'update:modelValue': [value: number, ownerElementId?: string]
}>()

const focused = ref(false)
/** 聚焦时记录的设计元素 id，blur 时提交用（切换选中后 props.ownerElementId 已变） */
const ownerWhileFocused = ref<string | null>(null)
/** 聚焦或输入过程中的字符串，避免受控 number 在空串/小数点时被旧值顶回 */
const draft = ref('')

const displayValue = computed(() => {
  if (focused.value) return draft.value
  const v = props.modelValue
  return Number.isFinite(v) ? String(v) : ''
})

watch(
  () => props.modelValue,
  (v) => {
    if (!focused.value) {
      draft.value = Number.isFinite(v) ? String(v) : ''
    }
  },
  { immediate: true }
)

function clamp(n: number): number {
  let x = n
  if (props.min !== undefined) x = Math.max(props.min, x)
  if (props.max !== undefined) x = Math.min(props.max, x)
  return x
}

function ownerForCommit(): string | undefined {
  return ownerWhileFocused.value ?? props.ownerElementId ?? undefined
}

function emitValue(n: number): void {
  emit('update:modelValue', n, ownerForCommit())
}

function onFocus(): void {
  focused.value = true
  ownerWhileFocused.value = props.ownerElementId ? String(props.ownerElementId) : null
  draft.value = Number.isFinite(props.modelValue) ? String(props.modelValue) : ''
}

function onInput(e: Event): void {
  const el = e.target as HTMLInputElement
  const raw = el.value
  draft.value = raw
  if (raw === '' || raw === '-' || raw === '.' || raw === '-.') return
  const n = Number(raw)
  if (!Number.isFinite(n)) return
  emitValue(clamp(n))
}

function onBlur(): void {
  const commitOwner = ownerWhileFocused.value ?? props.ownerElementId ?? undefined
  ownerWhileFocused.value = null
  focused.value = false
  const n = Number(draft.value)
  if (draft.value === '' || !Number.isFinite(n)) {
    draft.value = Number.isFinite(props.modelValue) ? String(props.modelValue) : ''
    return
  }
  emit('update:modelValue', clamp(n), commitOwner)
  draft.value = Number.isFinite(props.modelValue) ? String(props.modelValue) : ''
}
</script>

<template>
  <input
    type="text"
    :class="['numeric-input', inputClass || undefined]"
    inputmode="decimal"
    autocomplete="off"
    :value="displayValue"
    @focus="onFocus"
    @input="onInput"
    @blur="onBlur"
  />
</template>

<style scoped>
.numeric-input {
  margin-top: 4px;
  width: 100%;
  background: #0f141c;
  color: #d7deec;
  border: 1px solid #2f3748;
  border-radius: 6px;
  padding: 6px 8px;
  font-size: 12px;
  box-sizing: border-box;
}
</style>
