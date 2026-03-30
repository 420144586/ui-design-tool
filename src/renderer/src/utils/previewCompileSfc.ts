import { compile } from '@vue/compiler-dom'
import { compileStyle, parse } from '@vue/compiler-sfc'
import { defineComponent, h, onMounted, onUnmounted, reactive, ref } from 'vue'
import * as Vue from 'vue'
import type { Component } from 'vue'
import DButton from '@renderer/D-components/DButton.vue'
import DInput from '@renderer/D-components/DInput.vue'

function shortScopeHash(source: string): string {
  let x = 0
  for (let i = 0; i < source.length; i += 1) {
    x = (Math.imul(31, x) + source.charCodeAt(i)) | 0
  }
  return Math.abs(x).toString(36).slice(0, 8)
}

/**
 * 将 .vue SFC 源码在运行时编译为可挂载的 Vue 组件。
 *
 * - 模板通过 @vue/compiler-dom 的 mode:'function' 编译，再用 new Function 求值
 * - scoped 样式通过 @vue/compiler-sfc 编译后注入 <head>
 * - 自动注册 DButton、DInput 等已知自定义组件
 * - 从模板中检测 animShow 引用，创建默认 reactive 状态（全部为 true）
 * - 从 script 中解析简单 ref() 声明并提供默认值
 */
export function createPreviewComponentFromSfc(source: string): Component {
  const filename = 'GeneratedFromDesigner.vue'
  const { descriptor } = parse(source, { filename })
  const shortId = shortScopeHash(source)

  if (!descriptor.template) {
    return defineComponent({
      name: 'EmptyPreview',
      setup() {
        return () => h('div', { class: 'preview-empty' }, '预览文件无 template')
      }
    })
  }

  let renderFn: (ctx: unknown, cache: unknown[]) => unknown
  try {
    const { code } = compile(descriptor.template.content, {
      mode: 'function',
      hoistStatic: true
    })
    // eslint-disable-next-line no-new-func
    renderFn = new Function('Vue', code)(Vue)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return defineComponent({
      name: 'CompileError',
      setup() {
        return () =>
          h(
            'div',
            {
              style:
                'color:#f87171;padding:16px;font-size:13px;white-space:pre-wrap;background:#1a1a2e;border-radius:8px'
            },
            `模板编译失败：\n${msg}`
          )
      }
    })
  }

  const templateContent = descriptor.template.content

  const animShowKeys: string[] = []
  const animShowRe = /animShow\['([^']+)'\]/g
  let am: RegExpExecArray | null
  while ((am = animShowRe.exec(templateContent)) !== null) {
    animShowKeys.push(am[1])
  }

  const scriptContent = descriptor.scriptSetup?.content ?? descriptor.script?.content ?? ''
  const refDecls = new Map<string, unknown>()
  const refRe =
    /const\s+(\w+)\s*=\s*ref\s*(?:<[^>]*>)?\s*\(\s*(true|false|'[^']*'|"[^"]*"|\d+(?:\.\d+)?)\s*\)/g
  let rm: RegExpExecArray | null
  while ((rm = refRe.exec(scriptContent)) !== null) {
    const name = rm[1]
    if (name === 'animShow') continue
    const raw = rm[2]
    let val: unknown = true
    if (raw === 'true') val = true
    else if (raw === 'false') val = false
    else if (raw.startsWith("'") || raw.startsWith('"')) val = raw.slice(1, -1)
    else val = Number(raw)
    refDecls.set(name, val)
  }

  return defineComponent({
    name: 'GeneratedPreview',
    components: { DButton, DInput },
    setup() {
      const styleEls: HTMLStyleElement[] = []
      onMounted(() => {
        for (const style of descriptor.styles) {
          const res = compileStyle({
            source: style.content,
            filename,
            id: shortId,
            scoped: false
          })
          if (res.errors?.length) continue
          const el = document.createElement('style')
          el.textContent = res.code
          el.setAttribute('data-deesign-preview', '')
          document.head.appendChild(el)
          styleEls.push(el)
        }
      })
      onUnmounted(() => {
        styleEls.forEach((e) => e.remove())
      })

      const animShowInit: Record<string, boolean> = {}
      for (const key of animShowKeys) {
        animShowInit[key] = true
      }
      const animShow = reactive(animShowInit)

      const data: Record<string, unknown> = { animShow }
      for (const [name, val] of refDecls) {
        data[name] = ref(val)
      }

      return data
    },
    render: renderFn as () => unknown
  })
}
