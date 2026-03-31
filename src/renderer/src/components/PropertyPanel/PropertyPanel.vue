<script setup lang="ts">
import { computed, ref } from 'vue'
import { useDesignStore } from '@renderer/store/design'
import type { DesignElement } from '@renderer/types/design'
import {
  ANIMATION_PRESET_OPTIONS,
  ANIMATION_TIMING_OPTIONS,
  cubicBezierString,
  generateAnimationStyleBlockForElement
} from '@renderer/utils/animationCodegen'
import NumericInput from '@renderer/components/NumericInput/NumericInput.vue'
import { generateStyleBlockForElement } from '@renderer/utils/codegen'
import { flexContainerCssLines } from '@renderer/utils/elementFlex'
import { generateElementDomClass } from '@renderer/utils/elementClassStrategy'
import type {
  AlignContent,
  AlignItems,
  AnimationPreset,
  AnimationTimingMode,
  FlexDirection,
  FlexWrap,
  JustifyContent
} from '@renderer/types/design'

const store = useDesignStore()

const panelTab = ref<'property' | 'css' | 'animation'>('property')
/** 表格条纹设置：tr / td */
const tableStripeSubPanel = ref<'tr' | 'td'>('tr')

const selected = computed(() => store.selectedElement)

const domClassStrategyHint = computed(() => {
  const s = selected.value
  if (!s) return ''
  return generateElementDomClass({ element: s })
})

const canvasForStyleCodegen = computed(() => ({
  ...store.canvas,
  width: store.designSurfaceWidth,
  height: store.designSurfaceHeight
}))

const selectedCssCode = computed(() => {
  const el = selected.value
  if (!el) return ''
  const base = generateStyleBlockForElement(
    el,
    store.elements,
    store.canvas.layoutMode,
    canvasForStyleCodegen.value
  )
  const anim = generateAnimationStyleBlockForElement(el)
  return [base, anim].filter(Boolean).join('\n\n')
})

/** 与导出 generateStyleBlock 中 flex 段一致，供属性区直观对照 */
const flexLayoutCssPreview = computed(() => {
  const el = selected.value
  if (!el?.flexLayoutEnabled) return ''
  return [...flexContainerCssLines(el), '  overflow: hidden;'].join('\n')
})

const animationEnabled = computed({
  get: () => !!selected.value?.animationEnabled,
  set: (v: boolean) => {
    const s = selected.value
    if (!s) return
    if (v) {
      store.updateElement(s.id, {
        animationEnabled: true,
        animationTimingMode: 'visible',
        animationPreset: 'fade',
        animationDurationMs: 400,
        animationBezierX1: 0.4,
        animationBezierY1: 0,
        animationBezierX2: 0.2,
        animationBezierY2: 1
      })
    } else {
      store.updateElement(s.id, { animationEnabled: false })
    }
  }
})

const bezierPreview = computed(() => {
  const el = selected.value
  if (!el) return ''
  return cubicBezierString(el)
})

const timingModeHint = computed(() => {
  const m = selected.value?.animationTimingMode ?? 'visible'
  return ANIMATION_TIMING_OPTIONS.find((o) => o.value === m)?.hint ?? ''
})

const update = <K extends keyof DesignElement>(
  key: K,
  value: DesignElement[K],
  ownerElementId?: string
): void => {
  const id = ownerElementId ?? selected.value?.id
  if (!id) return
  store.updateElement(id, { [key]: value } as Partial<DesignElement>)
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

/** 表格根、图片叶子、封装组件不提供 Flex 容器选项 */
const showFlexLayoutSection = computed(() => {
  const s = selected.value
  if (!s) return false
  if (s.kind === 'dcomponent' || s.type === 'img') return false
  if (s.kind === 'table') return false
  return true
})

const onFlexLayoutToggle = (e: Event): void => {
  const on = (e.target as HTMLInputElement).checked
  const s = selected.value
  if (!s) return
  if (on) {
    store.updateElement(s.id, {
      flexLayoutEnabled: true,
      flexDirection: s.flexDirection ?? 'row',
      flexWrap: s.flexWrap ?? 'nowrap',
      justifyContent: s.justifyContent ?? 'flex-start',
      alignItems: s.alignItems ?? 'stretch',
      alignContent: s.alignContent ?? 'stretch',
      flexGap: s.flexGap ?? 0,
      layoutCenterHorizontal: false,
      layoutCenterVertical: false
    })
  } else {
    store.updateElement(s.id, { flexLayoutEnabled: false })
  }
}

/** 全局 Flex 画布下：主开关改为「子级 Grid」，与 Flex 子级排版互斥 */
const onGridLayoutForChildrenToggle = (e: Event): void => {
  const on = (e.target as HTMLInputElement).checked
  const s = selected.value
  if (!s) return
  if (on) {
    store.updateElement(s.id, { gridLayoutForChildren: true })
  } else {
    store.updateElement(s.id, {
      flexLayoutEnabled: true,
      gridLayoutForChildren: false,
      flexDirection: s.flexDirection ?? 'row',
      flexWrap: s.flexWrap ?? 'nowrap',
      justifyContent: s.justifyContent ?? 'flex-start',
      alignItems: s.alignItems ?? 'stretch',
      alignContent: s.alignContent ?? 'stretch',
      flexGap: s.flexGap ?? 0,
      layoutCenterHorizontal: false,
      layoutCenterVertical: false
    })
  }
}

const flexPropsVisible = computed(() => {
  const s = selected.value
  if (!s) return false
  if (store.canvas.layoutMode === 'flex') {
    return !s.gridLayoutForChildren
  }
  return !!s.flexLayoutEnabled
})
/** 字体颜色预设（下拉快速选择，可与下方自定义色并用） */
const TEXT_COLOR_PRESETS: ReadonlyArray<{ value: string; label: string }> = [
  { value: '#f1f4fb', label: '浅灰白' },
  { value: '#ffffff', label: '白色' },
  { value: '#d7deec', label: '浅蓝灰' },
  { value: '#818f9b', label: '灰蓝' },
  { value: '#39434e', label: '炭灰' },
  { value: '#1a1f2b', label: '深色' },
  { value: '#000000', label: '黑色' },
  { value: '#4f7cff', label: '品牌蓝' },
  { value: '#39b56a', label: '绿色' },
  { value: '#e05555', label: '红色' },
  { value: '#ff8f3e', label: '橙色' },
  { value: '#7b5cff', label: '紫色' }
]

const textColorPresetSelectValue = computed(() => {
  const raw = (selected.value?.color ?? '#f1f4fb').trim().toLowerCase()
  const hit = TEXT_COLOR_PRESETS.find((p) => p.value.toLowerCase() === raw)
  return hit ? hit.value : '__custom__'
})

const onTextColorPresetChange = (e: Event): void => {
  const v = (e.target as HTMLSelectElement).value
  if (v === '__custom__') return
  update('color', v)
}

const dComponentClassHint = computed(() => {
  const key = selected.value?.componentKey
  if (key === 'DInput') {
    return '每个实例根节点会带唯一 class（与元素 id 相同，如 el-xxx），可写 .el-xxx { … } 覆盖当前输入框。默认样式类名为 d-input。'
  }
  return '每个实例根节点会带唯一 class（与元素 id 相同，如 el-xxx），可写 .el-xxx { … } 只影响当前按钮。修饰示例：d-button--ghost d-button--danger（空格分隔）'
})

const setColumnChildCount = (raw: number, ownerId?: string): void => {
  const id = ownerId ?? selected.value?.id
  if (!id || !Number.isFinite(raw)) return
  const el = store.elements.find((e) => e.id === id)
  if (!el || el.kind !== 'column') return
  store.updateColumnChildCount(id, raw)
}

const setImageGap = (raw: number, ownerId?: string): void => {
  const id = ownerId ?? selected.value?.id
  if (!id || !Number.isFinite(raw)) return
  const el = store.elements.find((e) => e.id === id)
  if (!el || el.kind !== 'image' || el.type !== 'div') return
  store.updateElement(id, { gap: Math.max(0, Math.floor(raw)) })
}

const setImageHasLabel = (checked: boolean): void => {
  const s = selected.value
  if (!s || s.kind !== 'image') return
  store.setImageHasLabelForSelectedStyle(s.id, checked)
}

const generateGradientString = (type: string, colors: string[], angle: number = 90): string => {
  if (type === 'linear') {
    return `linear-gradient(${angle}deg, ${colors.join(', ')})`
  } else {
    return `radial-gradient(circle, ${colors.join(', ')})`
  }
}

const isGradient = computed({
  get: () => !!selected.value?.isGradient,
  set: (val: boolean) => {
    if (!selected.value) return
    if (val) {
      const type = selected.value.gradientType || 'linear'
      const angle = selected.value.gradientAngle ?? 90
      const colors = selected.value.gradientColors?.length ? selected.value.gradientColors : ['#ff0000', '#0000ff']
      store.updateElement(selected.value.id, {
        isGradient: true,
        backgroundTransparent: false,
        gradientType: type,
        gradientAngle: angle,
        gradientColors: colors,
        background: generateGradientString(type, colors, angle)
      })
    } else {
      store.updateElement(selected.value.id, {
        isGradient: false,
        backgroundTransparent: false,
        background: selected.value.gradientColors?.[0] || '#ffffff'
      })
    }
  }
})

const isBackgroundTransparent = computed({
  get: () => !!selected.value?.backgroundTransparent,
  set: (val: boolean) => {
    if (!selected.value) return
    store.updateElement(selected.value.id, { backgroundTransparent: val })
  }
})

const gradientType = computed({
  get: () => selected.value?.gradientType || 'linear',
  set: (val: 'linear' | 'radial') => {
    if (!selected.value) return
    const colors = selected.value.gradientColors || ['#ff0000', '#0000ff']
    const angle = selected.value.gradientAngle ?? 90
    store.updateElement(selected.value.id, {
      backgroundTransparent: false,
      gradientType: val,
      background: generateGradientString(val, colors, angle)
    })
  }
})

const gradientAngle = computed(() => selected.value?.gradientAngle ?? 90)

const applyGradientAngle = (val: number, ownerId?: string): void => {
  const id = ownerId ?? selected.value?.id
  if (!id) return
  const el = store.elements.find((e) => e.id === id)
  if (!el) return
  const colors = el.gradientColors || ['#ff0000', '#0000ff']
  const type = el.gradientType || 'linear'
  store.updateElement(id, {
    backgroundTransparent: false,
    gradientAngle: val,
    background: generateGradientString(type, colors, val)
  })
}

const gradientColors = computed(() => selected.value?.gradientColors || ['#ff0000', '#0000ff'])

const updateGradientColor = (index: number, color: string): void => {
  if (!selected.value) return
  const colors = [...gradientColors.value]
  colors[index] = color
  const angle = selected.value.gradientAngle ?? 90
  store.updateElement(selected.value.id, {
    backgroundTransparent: false,
    gradientColors: colors,
    background: generateGradientString(gradientType.value, colors, angle)
  })
}

const addGradientColor = (): void => {
  if (!selected.value) return
  const colors = [...gradientColors.value, '#ffffff']
  const angle = selected.value.gradientAngle ?? 90
  store.updateElement(selected.value.id, {
    backgroundTransparent: false,
    gradientColors: colors,
    background: generateGradientString(gradientType.value, colors, angle)
  })
}

const removeGradientColor = (index: number): void => {
  if (!selected.value) return
  const colors = [...gradientColors.value]
  if (colors.length <= 2) return
  colors.splice(index, 1)
  const angle = selected.value.gradientAngle ?? 90
  store.updateElement(selected.value.id, {
    backgroundTransparent: false,
    gradientColors: colors,
    background: generateGradientString(gradientType.value, colors, angle)
  })
}

const setSolidBackground = (value: string): void => {
  if (!selected.value) return
  store.updateElement(selected.value.id, {
    backgroundTransparent: false,
    background: value
  })
}

type BorderSideKey = 'borderTop' | 'borderRight' | 'borderBottom' | 'borderLeft'

const borderSideChecked = (key: BorderSideKey): boolean => {
  const el = selected.value
  if (!el) return true
  return el[key] !== false
}

const setBorderSide = (key: BorderSideKey, checked: boolean): void => {
  if (!selected.value) return
  store.updateElement(selected.value.id, { [key]: checked } as Partial<DesignElement>)
}

type PadUseKey = 'paddingUseTop' | 'paddingUseRight' | 'paddingUseBottom' | 'paddingUseLeft'
type MarUseKey = 'marginUseTop' | 'marginUseRight' | 'marginUseBottom' | 'marginUseLeft'

const paddingUseOn = (key: PadUseKey): boolean => selected.value?.[key] !== false
const marginUseOn = (key: MarUseKey): boolean => selected.value?.[key] !== false

const setPaddingUse = (key: PadUseKey, checked: boolean): void => {
  if (!selected.value) return
  store.updateElement(selected.value.id, { [key]: checked } as Partial<DesignElement>)
}
const setMarginUse = (key: MarUseKey, checked: boolean): void => {
  if (!selected.value) return
  store.updateElement(selected.value.id, { [key]: checked } as Partial<DesignElement>)
}
</script>

<template>
  <section class="panel">
    <h3>属性面板</h3>
    <template v-if="store.selectedElementIds.length === 0">
      <p class="empty">请选择一个元素后编辑属性（按住 Ctrl 或 ⌘ 可多选）</p>
    </template>
    <template v-else>
      <div class="panel-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          :aria-selected="panelTab === 'property'"
          class="tab-btn"
          :class="{ active: panelTab === 'property' }"
          @click="panelTab = 'property'"
        >
          属性
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="panelTab === 'css'"
          class="tab-btn"
          :class="{ active: panelTab === 'css' }"
          @click="panelTab = 'css'"
        >
          CSS 代码
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="panelTab === 'animation'"
          class="tab-btn"
          :class="{ active: panelTab === 'animation' }"
          @click="panelTab = 'animation'"
        >
          动画
        </button>
      </div>

      <div v-if="panelTab === 'property'">
        <div v-if="store.selectedElementIds.length > 1" class="multi-hint">
          <p>已选中 <strong>{{ store.selectedElementIds.length }}</strong> 个元素。</p>
          <p class="hint-sub">
            可一齐拖动；拖入另一元素时可批量设为子元素。属性编辑请先单选一项（Ctrl/⌘ 再点已选项可取消选择）。
          </p>
        </div>
        <template v-else-if="selected">
      <div class="style-group">
        <div class="group-title">标识与导出类名</div>
        <label>
          元素名称（树与策略参考）
          <input
            :value="selected.name"
            @input="update('name', ($event.target as HTMLInputElement).value)"
          />
        </label>
        <label>
          CSS 类名（导出 / 预览主选择器）
          <input
            :value="selected.domClass ?? ''"
            type="text"
            autocomplete="off"
            spellcheck="false"
            :placeholder="domClassStrategyHint"
            title="留空或未填时：旧稿用内部 id；新元素默认由类名策略生成。可清空输入框以按当前策略重算。"
            @input="update('domClass', ($event.target as HTMLInputElement).value)"
          />
        </label>
        <p class="flex-hint">
          建议使用合法 CSS 类名片段。自定义命名规则请见工具模块 elementClassStrategy（setElementClassStrategy）。
        </p>
      </div>
      <div class="style-group">
        <div class="group-title">排版与尺寸</div>
        <div class="row-inputs">
          <label class="half">
            X
            <NumericInput
              :model-value="selected.x"
              :owner-element-id="selected.id"
              @update:model-value="(v, oid) => update('x', v, oid)"
            />
          </label>
          <label class="half">
            Y
            <NumericInput
              :model-value="selected.y"
              :owner-element-id="selected.id"
              @update:model-value="(v, oid) => update('y', v, oid)"
            />
          </label>
        </div>
        <div class="row-inputs row-dimensions">
          <label class="half dim-field">
            <span class="dim-label">宽度</span>
            <div class="dim-input-with-pct">
              <NumericInput
                :model-value="selected.width"
                :owner-element-id="selected.id"
                :min="0"
                :max="selected.widthIsPercent ? 10000 : 16000"
                @update:model-value="(v, oid) => update('width', v, oid)"
              />
              <label class="pct-toggle" title="勾选后以百分比为单位（相对父内容宽度；根级相对设计表面宽度）">
                <input
                  type="checkbox"
                  :checked="!!selected.widthIsPercent"
                  @change="update('widthIsPercent', ($event.target as HTMLInputElement).checked)"
                />
                <span>%</span>
              </label>
            </div>
          </label>
          <label class="half dim-field">
            <span class="dim-label">高度</span>
            <div class="dim-input-with-pct">
              <NumericInput
                :model-value="selected.height"
                :owner-element-id="selected.id"
                :min="0"
                :max="selected.heightIsPercent ? 10000 : 16000"
                @update:model-value="(v, oid) => update('height', v, oid)"
              />
              <label class="pct-toggle" title="勾选后以百分比为单位（相对父内容高度；根级相对设计表面高度）">
                <input
                  type="checkbox"
                  :checked="!!selected.heightIsPercent"
                  @change="update('heightIsPercent', ($event.target as HTMLInputElement).checked)"
                />
                <span>%</span>
              </label>
            </div>
          </label>
        </div>
      </div>

      <div class="style-group" v-if="showFlexLayoutSection">
        <div class="group-title">Flex 布局</div>
        <template v-if="store.canvas.layoutMode === 'flex'">
          <label class="check flex-master-check">
            <input
              type="checkbox"
              :checked="!!selected.gridLayoutForChildren"
              @change="onGridLayoutForChildrenToggle"
            />
            使用 Grid 排列子元素
          </label>
          <p v-if="selected.gridLayoutForChildren" class="flex-hint">
            勾选后子元素按网格占位与对齐（与全局 Grid 布局下的子层行为一致）；与 Flex 子级排版互斥。
          </p>
        </template>
        <template v-else>
          <label class="check flex-master-check">
            <input
              type="checkbox"
              :checked="!!selected.flexLayoutEnabled"
              @change="onFlexLayoutToggle"
            />
            使用 Flex 排列子元素
          </label>
          <p v-if="!selected.flexLayoutEnabled" class="flex-hint">
            勾选后内部子元素按主轴排列（可先添加子元素再调整）；适用于多列容器、普通块、图片容器、表格单元格等。
          </p>
        </template>
        <template v-if="flexPropsVisible">
          <div class="flex-props">
            <label>
              flex-direction
              <select
                class="common-select"
                :value="selected.flexDirection ?? 'row'"
                @change="
                  update('flexDirection', ($event.target as HTMLSelectElement).value as FlexDirection)
                "
              >
                <option value="row">row</option>
                <option value="row-reverse">row-reverse</option>
                <option value="column">column</option>
                <option value="column-reverse">column-reverse</option>
              </select>
            </label>
            <label>
              flex-wrap
              <select
                class="common-select"
                :value="selected.flexWrap ?? 'nowrap'"
                @change="
                  update('flexWrap', ($event.target as HTMLSelectElement).value as FlexWrap)
                "
              >
                <option value="nowrap">nowrap</option>
                <option value="wrap">wrap</option>
                <option value="wrap-reverse">wrap-reverse</option>
              </select>
            </label>
            <label>
              justify-content
              <select
                class="common-select"
                :value="selected.justifyContent ?? 'flex-start'"
                @change="
                  update(
                    'justifyContent',
                    ($event.target as HTMLSelectElement).value as JustifyContent
                  )
                "
              >
                <option value="flex-start">flex-start</option>
                <option value="flex-end">flex-end</option>
                <option value="center">center</option>
                <option value="space-between">space-between</option>
                <option value="space-around">space-around</option>
                <option value="space-evenly">space-evenly</option>
              </select>
            </label>
            <label>
              align-items
              <select
                class="common-select"
                :value="selected.alignItems ?? 'stretch'"
                @change="
                  update('alignItems', ($event.target as HTMLSelectElement).value as AlignItems)
                "
              >
                <option value="stretch">stretch</option>
                <option value="flex-start">flex-start</option>
                <option value="flex-end">flex-end</option>
                <option value="center">center</option>
                <option value="baseline">baseline</option>
              </select>
            </label>
            <label v-if="(selected.flexWrap ?? 'nowrap') !== 'nowrap'">
              align-content（多行时）
              <select
                class="common-select"
                :value="selected.alignContent ?? 'stretch'"
                @change="
                  update('alignContent', ($event.target as HTMLSelectElement).value as AlignContent)
                "
              >
                <option value="stretch">stretch</option>
                <option value="flex-start">flex-start</option>
                <option value="flex-end">flex-end</option>
                <option value="center">center</option>
                <option value="space-between">space-between</option>
                <option value="space-around">space-around</option>
                <option value="space-evenly">space-evenly</option>
              </select>
            </label>
            <label>
              gap（px）
              <NumericInput
                :model-value="selected.flexGap ?? 0"
                :owner-element-id="selected.id"
                :min="0"
                :max="400"
                @update:model-value="(v, oid) => update('flexGap', v, oid)"
              />
            </label>
          </div>
          <div class="flex-css-preview-block">
            <p class="flex-css-preview-title">该元素将写入的 flex 相关 CSS（默认与上方选项一致）</p>
            <pre class="flex-css-preview">{{ flexLayoutCssPreview }}</pre>
          </div>
        </template>
      </div>

      <div class="style-group" v-if="!isImageStandalone">
        <div class="group-title">文本与排版</div>
        <label v-if="!isDComponent">
          文本内容
          <input
            :value="selected.text"
            @input="update('text', ($event.target as HTMLInputElement).value)"
          />
        </label>
        <label>
          文字对齐
          <select
            :value="selected.textAlign ?? 'center'"
            @change="
              update(
                'textAlign',
                ($event.target as HTMLSelectElement).value as DesignElement['textAlign']
              )
            "
            class="common-select"
          >
            <option value="left">左对齐</option>
            <option value="center">居中</option>
            <option value="right">右对齐</option>
            <option value="justify">两端对齐</option>
          </select>
        </label>
        <label>
          字体颜色（预设）
          <select
            class="common-select"
            :value="textColorPresetSelectValue"
            @change="onTextColorPresetChange"
          >
            <option
              v-for="p in TEXT_COLOR_PRESETS"
              :key="p.value"
              :value="p.value"
            >
              {{ p.label }}（{{ p.value }}）
            </option>
            <option value="__custom__">自定义（使用下方色值）</option>
          </select>
        </label>
        <label>
          字体颜色（自定义）
          <div class="color-row">
            <input
              type="color"
              :value="selected.color ?? '#f1f4fb'"
              @input="update('color', ($event.target as HTMLInputElement).value)"
              class="color-picker"
            />
            <input
              type="text"
              :value="selected.color ?? '#f1f4fb'"
              @input="update('color', ($event.target as HTMLInputElement).value)"
              class="color-input"
            />
          </div>
        </label>
        <div class="row-inputs">
          <label class="half">
            字体大小
            <NumericInput
              :model-value="selected.fontSize ?? 12"
              :owner-element-id="selected.id"
              :min="1"
              @update:model-value="(v, oid) => update('fontSize', v, oid)"
            />
          </label>
          <label class="half">
            字体粗细
            <select
              :value="selected.fontWeight ?? 'normal'"
              @change="update('fontWeight', ($event.target as HTMLSelectElement).value)"
              class="common-select"
            >
              <option value="normal">Normal</option>
              <option value="bold">Bold</option>
              <option value="100">100</option>
              <option value="200">200</option>
              <option value="300">300</option>
              <option value="400">400</option>
              <option value="500">500</option>
              <option value="600">600</option>
              <option value="700">700</option>
              <option value="800">800</option>
              <option value="900">900</option>
            </select>
          </label>
        </div>
      </div>

      <div class="style-group">
        <div class="group-title">外观</div>
        <label>
          透明度 (0-1)
          <NumericInput
            :model-value="selected.opacity ?? 1"
            :owner-element-id="selected.id"
            :min="0"
            :max="1"
            @update:model-value="(v, oid) => update('opacity', v, oid)"
          />
        </label>
        <label>
          圆角 (px)
          <NumericInput
            :model-value="selected.borderRadius ?? 0"
            :owner-element-id="selected.id"
            :min="0"
            @update:model-value="(v, oid) => update('borderRadius', v, oid)"
          />
        </label>
        <label>
          盒模型 (box-sizing)
          <select
            :value="selected.boxSizing ?? 'border-box'"
            class="common-select"
            @change="
              update(
                'boxSizing',
                ($event.target as HTMLSelectElement).value as 'content-box' | 'border-box'
              )
            "
          >
            <option value="border-box">border-box（边框计入宽高，不易超出父容器）</option>
            <option value="content-box">content-box（边框额外占空间）</option>
          </select>
        </label>
        <label>
          边框样式
          <select
            :value="selected.borderStyle ?? 'none'"
            @change="update('borderStyle', ($event.target as HTMLSelectElement).value as any)"
            class="common-select"
          >
            <option value="none">无边框</option>
            <option value="solid">实线 (solid)</option>
            <option value="dashed">虚线 (dashed)</option>
            <option value="dotted">点线 (dotted)</option>
          </select>
        </label>
        <div class="row-inputs" v-if="selected.borderStyle && selected.borderStyle !== 'none'">
          <label class="half">
            边框宽度
            <NumericInput
              :model-value="selected.borderWidth ?? 1"
              :owner-element-id="selected.id"
              :min="0"
              @update:model-value="(v, oid) => update('borderWidth', v, oid)"
            />
          </label>
          <label class="half">
            边框颜色
            <div class="color-row">
              <input
                type="color"
                :value="selected.borderColor ?? '#000000'"
                @input="update('borderColor', ($event.target as HTMLInputElement).value)"
                class="color-picker"
              />
              <input
                type="text"
                :value="selected.borderColor ?? '#000000'"
                @input="update('borderColor', ($event.target as HTMLInputElement).value)"
                class="color-input"
              />
            </div>
          </label>
        </div>
        <div class="border-sides" v-if="selected.borderStyle && selected.borderStyle !== 'none'">
          <span class="border-sides-title">显示边</span>
          <label class="check inline-check">
            <input
              type="checkbox"
              :checked="borderSideChecked('borderTop')"
              @change="setBorderSide('borderTop', ($event.target as HTMLInputElement).checked)"
            />
            上
          </label>
          <label class="check inline-check">
            <input
              type="checkbox"
              :checked="borderSideChecked('borderRight')"
              @change="setBorderSide('borderRight', ($event.target as HTMLInputElement).checked)"
            />
            右
          </label>
          <label class="check inline-check">
            <input
              type="checkbox"
              :checked="borderSideChecked('borderBottom')"
              @change="setBorderSide('borderBottom', ($event.target as HTMLInputElement).checked)"
            />
            下
          </label>
          <label class="check inline-check">
            <input
              type="checkbox"
              :checked="borderSideChecked('borderLeft')"
              @change="setBorderSide('borderLeft', ($event.target as HTMLInputElement).checked)"
            />
            左
          </label>
        </div>
        <div class="spacing-box-model">
          <div class="spacing-subtitle">内边距 padding (px)</div>
          <div class="spacing-grid">
            <div class="spacing-cell">
              <label class="check side-check">
                <input
                  type="checkbox"
                  :checked="paddingUseOn('paddingUseTop')"
                  @change="setPaddingUse('paddingUseTop', ($event.target as HTMLInputElement).checked)"
                />
                上
              </label>
              <NumericInput
                :model-value="selected.paddingTop ?? 0"
                :owner-element-id="selected.id"
                :min="0"
                :max="800"
                @update:model-value="(v, oid) => update('paddingTop', v, oid)"
              />
            </div>
            <div class="spacing-cell">
              <label class="check side-check">
                <input
                  type="checkbox"
                  :checked="paddingUseOn('paddingUseRight')"
                  @change="setPaddingUse('paddingUseRight', ($event.target as HTMLInputElement).checked)"
                />
                右
              </label>
              <NumericInput
                :model-value="selected.paddingRight ?? 0"
                :owner-element-id="selected.id"
                :min="0"
                :max="800"
                @update:model-value="(v, oid) => update('paddingRight', v, oid)"
              />
            </div>
            <div class="spacing-cell">
              <label class="check side-check">
                <input
                  type="checkbox"
                  :checked="paddingUseOn('paddingUseBottom')"
                  @change="setPaddingUse('paddingUseBottom', ($event.target as HTMLInputElement).checked)"
                />
                下
              </label>
              <NumericInput
                :model-value="selected.paddingBottom ?? 0"
                :owner-element-id="selected.id"
                :min="0"
                :max="800"
                @update:model-value="(v, oid) => update('paddingBottom', v, oid)"
              />
            </div>
            <div class="spacing-cell">
              <label class="check side-check">
                <input
                  type="checkbox"
                  :checked="paddingUseOn('paddingUseLeft')"
                  @change="setPaddingUse('paddingUseLeft', ($event.target as HTMLInputElement).checked)"
                />
                左
              </label>
              <NumericInput
                :model-value="selected.paddingLeft ?? 0"
                :owner-element-id="selected.id"
                :min="0"
                :max="800"
                @update:model-value="(v, oid) => update('paddingLeft', v, oid)"
              />
            </div>
          </div>
          <div class="spacing-subtitle">外边距 margin (px)</div>
          <div class="spacing-grid">
            <div class="spacing-cell">
              <label class="check side-check">
                <input
                  type="checkbox"
                  :checked="marginUseOn('marginUseTop')"
                  @change="setMarginUse('marginUseTop', ($event.target as HTMLInputElement).checked)"
                />
                上
              </label>
              <NumericInput
                :model-value="selected.marginTop ?? 0"
                :owner-element-id="selected.id"
                :min="-400"
                :max="800"
                @update:model-value="(v, oid) => update('marginTop', v, oid)"
              />
            </div>
            <div class="spacing-cell">
              <label class="check side-check">
                <input
                  type="checkbox"
                  :checked="marginUseOn('marginUseRight')"
                  @change="setMarginUse('marginUseRight', ($event.target as HTMLInputElement).checked)"
                />
                右
              </label>
              <NumericInput
                :model-value="selected.marginRight ?? 0"
                :owner-element-id="selected.id"
                :min="-400"
                :max="800"
                @update:model-value="(v, oid) => update('marginRight', v, oid)"
              />
            </div>
            <div class="spacing-cell">
              <label class="check side-check">
                <input
                  type="checkbox"
                  :checked="marginUseOn('marginUseBottom')"
                  @change="setMarginUse('marginUseBottom', ($event.target as HTMLInputElement).checked)"
                />
                下
              </label>
              <NumericInput
                :model-value="selected.marginBottom ?? 0"
                :owner-element-id="selected.id"
                :min="-400"
                :max="800"
                @update:model-value="(v, oid) => update('marginBottom', v, oid)"
              />
            </div>
            <div class="spacing-cell">
              <label class="check side-check">
                <input
                  type="checkbox"
                  :checked="marginUseOn('marginUseLeft')"
                  @change="setMarginUse('marginUseLeft', ($event.target as HTMLInputElement).checked)"
                />
                左
              </label>
              <NumericInput
                :model-value="selected.marginLeft ?? 0"
                :owner-element-id="selected.id"
                :min="-400"
                :max="800"
                @update:model-value="(v, oid) => update('marginLeft', v, oid)"
              />
            </div>
          </div>
        </div>
      </div>

      <div class="style-group">
        <div class="group-title">背景</div>
        <label>
          背景色
        </label>
        <div class="bg-color-header">
          <label class="check inline-check">
            <input type="checkbox" v-model="isGradient" />
            渐变
          </label>
          <label class="check inline-check">
            <input type="checkbox" v-model="isBackgroundTransparent" />
            透明
          </label>
        </div>
        <template v-if="isGradient">
          <select v-model="gradientType" class="gradient-type-select">
            <option value="linear">线性渐变</option>
            <option value="radial">径向渐变</option>
          </select>
          <label v-if="gradientType === 'linear'" class="angle-label">
            角度 (deg)
            <NumericInput
              :model-value="gradientAngle"
              input-class="angle-input"
              :owner-element-id="selected.id"
              @update:model-value="applyGradientAngle"
            />
          </label>
          <div class="gradient-colors">
            <div v-for="(color, index) in gradientColors" :key="index" class="gradient-color-item">
              <input
                type="color"
                :value="color"
                @input="updateGradientColor(index, ($event.target as HTMLInputElement).value)"
                class="color-picker"
              />
              <input
                type="text"
                :value="color"
                @input="updateGradientColor(index, ($event.target as HTMLInputElement).value)"
                class="color-input"
              />
              <button
                v-if="gradientColors.length > 2"
                type="button"
                class="icon-btn"
                @click="removeGradientColor(index)"
                title="移除颜色"
              >
                -
              </button>
            </div>
            <button type="button" class="add-color-btn" @click="addGradientColor">
              + 添加颜色
            </button>
          </div>
        </template>
        <template v-else>
          <input
            :value="selected.background"
            @input="setSolidBackground(($event.target as HTMLInputElement).value)"
          />
        </template>
      </div>

      <div class="style-group" v-if="isColumnContainer || isImageStandalone || isTable || isDComponent || isImageContainer">
        <div class="group-title">组件特有属性</div>
        <label v-if="isColumnContainer">
        子元素数量
        <NumericInput
          :model-value="selected.childCount ?? 1"
          :owner-element-id="selected.id"
          :min="1"
          @update:model-value="(v, oid) => setColumnChildCount(v, oid)"
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
          <NumericInput
            :model-value="selected.tableRows ?? 5"
            :owner-element-id="selected.id"
            :min="1"
            @update:model-value="(v, oid) => update('tableRows', Math.max(1, Math.floor(v)), oid)"
          />
        </label>
        <label>
          列数
          <NumericInput
            :model-value="selected.tableCols ?? 5"
            :owner-element-id="selected.id"
            :min="1"
            @update:model-value="(v, oid) => update('tableCols', Math.max(1, Math.floor(v)), oid)"
          />
        </label>
        <label>
          边框颜色
          <input
            :value="selected.borderColor ?? '#d0d0d0'"
            @input="update('borderColor', ($event.target as HTMLInputElement).value)"
          />
        </label>
        <label class="check">
          <input
            type="checkbox"
            :checked="!!selected.tableResizeEnabled"
            @change="
              update('tableResizeEnabled', ($event.target as HTMLInputElement).checked)
            "
          />
          调整
        </label>
        <div class="table-stripe-panel">
          <div class="table-stripe-subtabs" role="tablist">
            <button
              type="button"
              role="tab"
              class="table-stripe-tab"
              :aria-selected="tableStripeSubPanel === 'tr'"
              :class="{ active: tableStripeSubPanel === 'tr' }"
              @click="tableStripeSubPanel = 'tr'"
            >
              tr
            </button>
            <button
              type="button"
              role="tab"
              class="table-stripe-tab"
              :aria-selected="tableStripeSubPanel === 'td'"
              :class="{ active: tableStripeSubPanel === 'td' }"
              @click="tableStripeSubPanel = 'td'"
            >
              td
            </button>
          </div>
          <div
            v-show="tableStripeSubPanel === 'tr'"
            class="table-stripe-section"
            role="tabpanel"
          >
            <div class="group-title">行（tr:nth-child）</div>
            <label class="check">
              <input
                type="checkbox"
                :checked="!!selected.tableTrOddBgEnabled"
                @change="
                  update(
                    'tableTrOddBgEnabled',
                    ($event.target as HTMLInputElement).checked
                  )
                "
              />
              odd
            </label>
            <label v-if="selected.tableTrOddBgEnabled">
              odd 背景色
              <input
                :value="selected.tableTrOddBg ?? '#e8eef5'"
                @input="
                  update('tableTrOddBg', ($event.target as HTMLInputElement).value)
                "
              />
            </label>
            <label class="check">
              <input
                type="checkbox"
                :checked="!!selected.tableTrEvenBgEnabled"
                @change="
                  update(
                    'tableTrEvenBgEnabled',
                    ($event.target as HTMLInputElement).checked
                  )
                "
              />
              even
            </label>
            <label v-if="selected.tableTrEvenBgEnabled">
              even 背景色
              <input
                :value="selected.tableTrEvenBg ?? '#ffffff'"
                @input="
                  update('tableTrEvenBg', ($event.target as HTMLInputElement).value)
                "
              />
            </label>
          </div>
          <div
            v-show="tableStripeSubPanel === 'td'"
            class="table-stripe-section"
            role="tabpanel"
          >
            <div class="group-title">列（td:nth-child，每行内）</div>
            <label class="check">
              <input
                type="checkbox"
                :checked="!!selected.tableTdOddBgEnabled"
                @change="
                  update(
                    'tableTdOddBgEnabled',
                    ($event.target as HTMLInputElement).checked
                  )
                "
              />
              odd
            </label>
            <label v-if="selected.tableTdOddBgEnabled">
              odd 背景色
              <input
                :value="selected.tableTdOddBg ?? '#e8eef5'"
                @input="
                  update('tableTdOddBg', ($event.target as HTMLInputElement).value)
                "
              />
            </label>
            <label class="check">
              <input
                type="checkbox"
                :checked="!!selected.tableTdEvenBgEnabled"
                @change="
                  update(
                    'tableTdEvenBgEnabled',
                    ($event.target as HTMLInputElement).checked
                  )
                "
              />
              even
            </label>
            <label v-if="selected.tableTdEvenBgEnabled">
              even 背景色
              <input
                :value="selected.tableTdEvenBg ?? '#ffffff'"
                @input="
                  update('tableTdEvenBg', ($event.target as HTMLInputElement).value)
                "
              />
            </label>
          </div>
        </div>
      </template>
      <template v-else-if="isDComponent">
        <label>
          组件样式 class
          <input
            :value="selected.componentClass ?? ''"
            :placeholder="selected.componentKey === 'DInput' ? '追加 class（空格分隔）' : '例：d-button--ghost'"
            :title="dComponentClassHint"
            @input="
              update(
                'componentClass',
                ($event.target as HTMLInputElement).value.replace(/[^\w\s-]/g, '')
              )
            "
          />
        </label>
        <p class="field-hint">{{ dComponentClassHint }}</p>
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
          <NumericInput
            :model-value="selected.gap ?? 10"
            :owner-element-id="selected.id"
            :min="0"
            @update:model-value="(v, oid) => setImageGap(v, oid)"
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
      </div>
        </template>
      </div>

      <div v-else-if="panelTab === 'css'" class="css-tab">
        <div v-if="store.selectedElementIds.length > 1" class="multi-hint">
          <p>已选中 <strong>{{ store.selectedElementIds.length }}</strong> 个元素。</p>
          <p class="hint-sub">请单选一项后再查看该元素的 CSS 代码。</p>
        </div>
        <template v-else-if="selected">
          <p v-if="selected.isTableCell" class="css-cell-hint">
            表格单元格在导出样式中无独立规则，由父级 <code>table</code> 与 <code>td</code> 选择器统一生成。
          </p>
          <pre v-else class="css-code-block">{{ selectedCssCode || '（无）' }}</pre>
        </template>
      </div>

      <div v-else-if="panelTab === 'animation'" class="animation-tab">
        <div v-if="store.selectedElementIds.length > 1" class="multi-hint">
          <p>已选中 <strong>{{ store.selectedElementIds.length }}</strong> 个元素。</p>
          <p class="hint-sub">请单选一项后再配置动画。</p>
        </div>
        <template v-else-if="selected">
          <p v-if="selected.isTableCell" class="css-cell-hint">
            表格单元格不单独包 Transition，请对父级表格或其它容器启用动画。
          </p>
          <template v-else>
            <label class="check anim-enable">
              <input type="checkbox" v-model="animationEnabled" />
              启用动画
            </label>
            <div v-if="animationEnabled" class="style-group">
              <div class="group-title">时机与类型</div>
              <label>
                渲染时机
                <select
                  class="common-select"
                  :value="selected.animationTimingMode ?? 'visible'"
                  @change="
                    update(
                      'animationTimingMode',
                      ($event.target as HTMLSelectElement).value as AnimationTimingMode
                    )
                  "
                >
                  <option
                    v-for="o in ANIMATION_TIMING_OPTIONS"
                    :key="o.value"
                    :value="o.value"
                  >
                    {{ o.label }}
                  </option>
                </select>
              </label>
              <p v-if="timingModeHint" class="field-hint">{{ timingModeHint }}</p>
              <label>
                动画类型
                <select
                  class="common-select"
                  :value="selected.animationPreset ?? 'fade'"
                  @change="
                    update(
                      'animationPreset',
                      ($event.target as HTMLSelectElement).value as AnimationPreset
                    )
                  "
                >
                  <option
                    v-for="o in ANIMATION_PRESET_OPTIONS"
                    :key="o.value"
                    :value="o.value"
                  >
                    {{ o.label }}
                  </option>
                </select>
              </label>
              <label>
                时长 (ms)
                <NumericInput
                  :model-value="selected.animationDurationMs ?? 400"
                  :owner-element-id="selected.id"
                  :min="50"
                  @update:model-value="(v, oid) => update('animationDurationMs', Math.max(50, Math.floor(v)), oid)"
                />
              </label>
            </div>
            <div v-if="animationEnabled" class="style-group">
              <div class="group-title">贝塞尔曲线 (cubic-bezier)</div>
              <p class="field-hint">用于 transition / animation 的缓动，数值范围约 0～1（控制点可略超出）。当前：{{ bezierPreview }}</p>
              <div class="row-inputs">
                <label class="half">
                  x1
                  <NumericInput
                    :model-value="selected.animationBezierX1 ?? 0.4"
                    :owner-element-id="selected.id"
                    @update:model-value="(v, oid) => update('animationBezierX1', v, oid)"
                  />
                </label>
                <label class="half">
                  y1
                  <NumericInput
                    :model-value="selected.animationBezierY1 ?? 0"
                    :owner-element-id="selected.id"
                    @update:model-value="(v, oid) => update('animationBezierY1', v, oid)"
                  />
                </label>
              </div>
              <div class="row-inputs">
                <label class="half">
                  x2
                  <NumericInput
                    :model-value="selected.animationBezierX2 ?? 0.2"
                    :owner-element-id="selected.id"
                    @update:model-value="(v, oid) => update('animationBezierX2', v, oid)"
                  />
                </label>
                <label class="half">
                  y2
                  <NumericInput
                    :model-value="selected.animationBezierY2 ?? 1"
                    :owner-element-id="selected.id"
                    @update:model-value="(v, oid) => update('animationBezierY2', v, oid)"
                  />
                </label>
              </div>
            </div>
          </template>
        </template>
      </div>
    </template>
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

.multi-hint {
  padding: 10px 12px;
  margin-bottom: 12px;
  font-size: 12px;
  line-height: 1.5;
  color: #c8d0df;
  background: #1e2430;
  border-radius: 8px;
  border: 1px solid #2f3d52;
}

.multi-hint .hint-sub {
  margin: 8px 0 0;
  color: #8b96ac;
  font-size: 11px;
}

.style-group {
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid #2a2f3a;
}

.style-group:last-child {
  border-bottom: none;
  margin-bottom: 0;
  padding-bottom: 0;
}

.group-title {
  font-size: 12px;
  font-weight: 600;
  color: #c8d0df;
  margin-bottom: 12px;
  padding-left: 4px;
  border-left: 3px solid #4f7cff;
}

.table-stripe-panel {
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid #2a2f3a;
}

.table-stripe-subtabs {
  display: flex;
  gap: 6px;
  margin-bottom: 12px;
}

.table-stripe-tab {
  flex: 1;
  padding: 6px 10px;
  font-size: 12px;
  cursor: pointer;
  border-radius: 6px;
  border: 1px solid #3a4556;
  background: #1e2430;
  color: #9aa8bc;
}

.table-stripe-tab.active {
  border-color: #4f7cff;
  color: #e8eef5;
  background: #252d3d;
}

.table-stripe-section .group-title {
  margin-top: 0;
  margin-bottom: 10px;
  font-size: 11px;
  opacity: 0.95;
}

.table-stripe-section label:not(.check) {
  margin-top: 6px;
}

.row-inputs {
  display: flex;
  gap: 12px;
  margin-bottom: 10px;
}

.half {
  flex: 1;
  min-width: 0;
  margin-bottom: 0;
}

.dim-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.dim-label {
  font-size: 11px;
  color: #8b96ac;
}

.dim-input-with-pct {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dim-input-with-pct :deep(.numeric-input) {
  flex: 1;
  min-width: 0;
  margin-top: 0;
}

.pct-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  flex-shrink: 0;
  min-height: 30px;
  padding: 0 10px;
  box-sizing: border-box;
  font-size: 11px;
  color: #c8d0df;
  background: #0f141c;
  border: 1px solid #2f3748;
  border-radius: 6px;
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
}

.pct-toggle input[type='checkbox'] {
  width: 14px;
  height: 14px;
  margin: 0;
  cursor: pointer;
  accent-color: #4f7cff;
  flex-shrink: 0;
}

.spacing-box-model {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px dashed #2f3748;
}

.spacing-subtitle {
  font-size: 11px;
  font-weight: 600;
  color: #8b96ac;
  margin-bottom: 8px;
}

.spacing-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 12px;
  margin-bottom: 12px;
}

.spacing-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.spacing-cell :deep(.numeric-input) {
  margin-top: 0;
}

.side-check {
  font-size: 11px;
  color: #aeb9cc;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.side-check input[type='checkbox'] {
  accent-color: #4f7cff;
  width: 14px;
  height: 14px;
}

.flex-master-check {
  margin-bottom: 8px;
  color: #c8d0df;
}

.flex-hint {
  margin: 0 0 8px;
  font-size: 11px;
  color: #6d7a90;
  line-height: 1.45;
}

.flex-props {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px 10px 2px;
  background: #121722;
  border: 1px solid #2a3140;
  border-radius: 8px;
}

.flex-props label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
  color: #8b96ac;
}

.flex-css-preview-block {
  margin-top: 12px;
}

.flex-css-preview-title {
  margin: 0 0 6px;
  font-size: 11px;
  color: #6d7a90;
  line-height: 1.4;
}

.flex-css-preview {
  margin: 0;
  padding: 10px 12px;
  font-size: 11px;
  line-height: 1.55;
  font-family: ui-monospace, 'Cascadia Code', monospace;
  color: #b8c7e0;
  background: #0d1118;
  border: 1px solid #2a3140;
  border-radius: 8px;
  overflow-x: auto;
  white-space: pre;
}

.common-select {
  margin-top: 4px;
  width: 100%;
  background: #0f141c;
  color: #d7deec;
  border: 1px solid #2f3748;
  border-radius: 6px;
  padding: 6px 8px;
  font-size: 12px;
}

.color-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
}

h3 {
  margin: 0 0 12px;
  font-size: 14px;
  color: #c8d0df;
}

.panel-tabs {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 4px;
  margin-bottom: 12px;
  padding: 3px;
  background: #0f141c;
  border-radius: 8px;
  border: 1px solid #2a3140;
}

.tab-btn {
  padding: 6px 6px;
  font-size: 11px;
  color: #8b96ac;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition:
    color 0.15s,
    background 0.15s;
}

.tab-btn:hover {
  color: #c8d0df;
  background: #1a2230;
}

.tab-btn.active {
  color: #e8efff;
  background: #2a3548;
  box-shadow: 0 0 0 1px #4f7cff55;
}

.css-tab,
.animation-tab {
  min-height: 120px;
}

.anim-enable {
  margin-bottom: 4px;
}

.css-code-block {
  margin: 0;
  padding: 10px 12px;
  font-family: ui-monospace, 'Cascadia Code', 'SF Mono', Consolas, monospace;
  font-size: 11px;
  line-height: 1.5;
  color: #c8d0df;
  background: #0f141c;
  border: 1px solid #2f3748;
  border-radius: 8px;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: min(60vh, 480px);
  overflow: auto;
}

.css-cell-hint {
  margin: 0;
  font-size: 12px;
  line-height: 1.55;
  color: #a5b2ca;
}

.css-cell-hint code {
  font-size: 11px;
  padding: 1px 4px;
  background: #1a2230;
  border-radius: 4px;
  color: #d7deec;
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

.bg-color-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
  margin-top: 4px;
  margin-bottom: 8px;
}

.inline-check {
  display: inline-flex;
  font-size: 12px;
  color: #a5b2ca;
}

.border-sides {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 14px;
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid #2a2f3a;
}

.border-sides-title {
  width: 100%;
  font-size: 11px;
  color: #8b96ac;
  margin-bottom: -4px;
}

.gradient-type-select {
  width: 100%;
  background: #0f141c;
  color: #d7deec;
  border: 1px solid #2f3748;
  border-radius: 6px;
  padding: 6px 8px;
  margin-bottom: 8px;
  font-size: 12px;
}

.angle-label {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 11px;
  color: #a5b2ca;
}

.angle-input {
  flex: 1;
  margin-top: 0 !important;
}

.gradient-colors {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.gradient-color-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.color-picker {
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid #2f3748;
  border-radius: 4px;
  background: none;
  cursor: pointer;
  flex-shrink: 0;
}

.color-picker::-webkit-color-swatch-wrapper {
  padding: 0;
}

.color-picker::-webkit-color-swatch {
  border: none;
  border-radius: 3px;
}

.color-input {
  flex: 1;
  margin-top: 0 !important;
}

.icon-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #1a2230;
  border: 1px solid #30384a;
  border-radius: 4px;
  color: #d2dbee;
  cursor: pointer;
  flex-shrink: 0;
}

.icon-btn:hover {
  background: #2a3548;
  border-color: #4a5570;
}

.add-color-btn {
  margin-top: 4px;
  background: #1a2230;
  border: 1px dashed #30384a;
  border-radius: 6px;
  color: #a5b2ca;
  padding: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.add-color-btn:hover {
  background: #2a3548;
  border-color: #4f7cff;
  color: #d7deec;
}
</style>
