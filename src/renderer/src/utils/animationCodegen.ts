import type {
  AnimationPreset,
  AnimationTimingMode,
  DesignElement
} from '@renderer/types/design'

export const ANIMATION_TIMING_OPTIONS: { value: AnimationTimingMode; label: string; hint: string }[] =
  [
    { value: 'visible', label: 'visible（入场）', hint: '仅首次出现（appear），无需 v-if/v-show' },
    { value: 'hidden', label: 'hidden（离场）', hint: '将 animShow[id] 设为 false 时播放离场' },
    { value: 'v-if', label: 'v-if', hint: '导出为 v-if="animShow[id]"' },
    { value: 'v-show', label: 'v-show', hint: '导出为 v-show="animShow[id]"' }
  ]

export const ANIMATION_PRESET_OPTIONS: { value: AnimationPreset; label: string }[] = [
  { value: 'fade', label: 'fade（淡入淡出）' },
  { value: 'slide', label: 'slide（自下而上）' },
  { value: 'slide-left', label: 'slide-left（自左）' },
  { value: 'zoom', label: 'zoom（缩放）' },
  { value: 'bounce', label: 'bounce（弹跳）' },
  { value: 'elastic', label: 'elastic（弹性）' },
  { value: 'flip', label: 'flip（翻转）' }
]

export function transitionNameForElement(id: string): string {
  return `anim-${id}`
}

export function durationMs(el: DesignElement): number {
  const d = el.animationDurationMs
  return Number.isFinite(d) && (d as number) > 0 ? Math.floor(d as number) : 400
}

export function cubicBezierString(el: DesignElement): string {
  const x1 = el.animationBezierX1 ?? 0.4
  const y1 = el.animationBezierY1 ?? 0
  const x2 = el.animationBezierX2 ?? 0.2
  const y2 = el.animationBezierY2 ?? 1
  return `cubic-bezier(${x1}, ${y1}, ${x2}, ${y2})`
}

export function shouldEmitAnimShowScript(el: DesignElement): boolean {
  if (!el.animationEnabled || el.isTableCell) return false
  return (el.animationTimingMode ?? 'visible') !== 'visible'
}

export function injectAnimationDirectiveOnOpeningLine(line: string, node: DesignElement): string {
  const mode = node.animationTimingMode ?? 'visible'
  if (mode === 'visible') return line
  const dir =
    mode === 'v-show'
      ? `v-show="animShow['${node.id}']"`
      : `v-if="animShow['${node.id}']"`
  return line.replace(/^(\s*<\w+)/, `$1 ${dir}`)
}

/** 导出 <style> 中与 Transition name 配套的规则（与 generateStyleCode 合并） */
export function generateAnimationStyleBlockForElement(el: DesignElement): string {
  if (!el.animationEnabled || el.isTableCell) return ''
  const name = transitionNameForElement(el.id)
  const ms = durationMs(el)
  const ease = cubicBezierString(el)
  const preset: AnimationPreset = el.animationPreset ?? 'fade'

  const baseActive = [
    `.${name}-enter-active,`,
    `.${name}-leave-active {`,
    `  transition: all ${ms}ms ${ease};`,
    '}'
  ]

  switch (preset) {
    case 'fade':
      return [
        ...baseActive,
        `.${name}-enter-from,`,
        `.${name}-leave-to {`,
        '  opacity: 0;',
        '}'
      ].join('\n')
    case 'slide':
      return [
        ...baseActive,
        `.${name}-enter-from {`,
        '  opacity: 0;',
        '  transform: translateY(20px);',
        '}',
        `.${name}-leave-to {`,
        '  opacity: 0;',
        '  transform: translateY(-12px);',
        '}'
      ].join('\n')
    case 'slide-left':
      return [
        ...baseActive,
        `.${name}-enter-from {`,
        '  opacity: 0;',
        '  transform: translateX(-28px);',
        '}',
        `.${name}-leave-to {`,
        '  opacity: 0;',
        '  transform: translateX(20px);',
        '}'
      ].join('\n')
    case 'zoom':
      return [
        ...baseActive,
        `.${name}-enter-from {`,
        '  opacity: 0;',
        '  transform: scale(0.92);',
        '}',
        `.${name}-leave-to {`,
        '  opacity: 0;',
        '  transform: scale(0.96);',
        '}'
      ].join('\n')
    case 'flip':
      return [
        ...baseActive,
        `.${name}-enter-from {`,
        '  opacity: 0;',
        '  transform: perspective(480px) rotateY(-72deg);',
        '}',
        `.${name}-leave-to {`,
        '  opacity: 0;',
        '  transform: perspective(480px) rotateY(48deg);',
        '}'
      ].join('\n')
    case 'bounce': {
      const keyframes = [
        `@keyframes ${name}-bounce-in {`,
        '  0% { opacity: 0; transform: translateY(24px); }',
        '  55% { opacity: 1; transform: translateY(-10px); }',
        '  75% { transform: translateY(4px); }',
        '  100% { opacity: 1; transform: translateY(0); }',
        '}'
      ].join('\n')
      return [
        `.${name}-enter-active {`,
        `  animation: ${name}-bounce-in ${Math.max(ms, 320)}ms ${ease} both;`,
        '}',
        `.${name}-leave-active {`,
        `  transition: opacity ${ms}ms ${ease};`,
        '}',
        `.${name}-leave-to {`,
        '  opacity: 0;',
        '}',
        keyframes
      ].join('\n')
    }
    case 'elastic': {
      const keyframes = [
        `@keyframes ${name}-elastic-in {`,
        '  0% { opacity: 0; transform: translateX(-40px) scale(0.85); }',
        '  60% { opacity: 1; transform: translateX(6px) scale(1.02); }',
        '  80% { transform: translateX(-3px) scale(0.99); }',
        '  100% { opacity: 1; transform: translateX(0) scale(1); }',
        '}'
      ].join('\n')
      return [
        `.${name}-enter-active {`,
        `  animation: ${name}-elastic-in ${Math.max(ms, 400)}ms ${ease} both;`,
        '}',
        `.${name}-leave-active {`,
        `  transition: all ${ms}ms ${ease};`,
        '}',
        `.${name}-leave-to {`,
        '  opacity: 0;',
        '  transform: scale(0.94);',
        '}',
        keyframes
      ].join('\n')
    }
    default:
      return [
        ...baseActive,
        `.${name}-enter-from,`,
        `.${name}-leave-to {`,
        '  opacity: 0;',
        '}'
      ].join('\n')
  }
}

const indentStr = (level: number): string => '  '.repeat(level)

/** 将若干行根节点模板包在 Vue Transition 内（与 generateTemplateCode 缩进一致） */
export function wrapTemplateLinesWithTransition(
  lines: string[],
  node: DesignElement,
  level: number
): string[] {
  if (!node.animationEnabled || node.isTableCell) return lines
  const name = transitionNameForElement(node.id)
  const mode: AnimationTimingMode = node.animationTimingMode ?? 'visible'
  const appear = mode === 'visible' ? ' appear' : ''
  const inner = lines.map((line) => `  ${line}`)
  const patched =
    mode === 'visible'
      ? inner
      : inner.map((line, i) => (i === 0 ? injectAnimationDirectiveOnOpeningLine(line, node) : line))
  return [
    `${indentStr(level)}<Transition${appear} name="${name}">`,
    ...patched,
    `${indentStr(level)}</Transition>`
  ]
}
