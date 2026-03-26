import type { DesignElement, LayoutMode } from '@renderer/types/design'

const readBlock = (content: string, tag: 'template' | 'style'): string => {
  const match = content.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'))
  return match?.[1]?.trim() ?? ''
}

const parseStyleRules = (
  styleText: string
): Record<string, { [key: string]: string }> => {
  const rules: Record<string, { [key: string]: string }> = {}
  const classRule = /\.([a-zA-Z0-9_-]+)\s*\{([\s\S]*?)\}/g
  let match: RegExpExecArray | null = classRule.exec(styleText)
  while (match) {
    const className = match[1]
    const body = match[2]
    const props: Record<string, string> = {}
    body.split(';').forEach((line) => {
      const [key, value] = line.split(':').map((item) => item?.trim())
      if (!key || !value) return
      props[key] = value
    })
    rules[className] = props
    match = classRule.exec(styleText)
  }
  return rules
}

const parsePx = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback
  const n = Number(value.replace('px', '').trim())
  return Number.isFinite(n) ? n : fallback
}

const parseGridPlacement = (value: string | undefined): { start: number; span: number } => {
  if (!value) return { start: 1, span: 1 }
  const normalized = value.replace(/\s+/g, ' ').trim()
  const m = normalized.match(/^(\d+)\s*\/\s*span\s*(\d+)$/)
  if (!m) return { start: 1, span: 1 }
  return { start: Number(m[1]), span: Number(m[2]) }
}

export const importVueToDesignElements = (
  vueContent: string,
  gridSize: number
): { elements: DesignElement[]; layoutMode: LayoutMode } => {
  const template = readBlock(vueContent, 'template')
  const style = readBlock(vueContent, 'style')
  const cssRules = parseStyleRules(style)
  const rootRule = cssRules['canvas-root'] ?? {}
  const hasGridFromRoot = rootRule.display === 'grid'
  const hasGridFromElements = Object.values(cssRules).some(
    (r) => Boolean(r['grid-column'] || r['grid-row'])
  )
  const isGrid = hasGridFromRoot || hasGridFromElements
  const layoutMode: LayoutMode = isGrid ? 'grid' : 'absolute'

  const parser = new DOMParser()
  const doc = parser.parseFromString(`<wrapper>${template}</wrapper>`, 'text/html')
  /** 导出已去掉 canvas-root，仅 wrapper；旧文件可能仍含 .canvas-root */
  const rootSection = doc.querySelector('.canvas-root') ?? doc.querySelector('wrapper')
  const elements: DesignElement[] = []
  let serial = 1

  const walk = (node: Element, parentId: string | null): void => {
    if (!node.classList || node.classList.length === 0) {
      Array.from(node.children).forEach((child) => walk(child, parentId))
      return
    }
    const className = node.classList[0]
    if (className === 'canvas-root') {
      Array.from(node.children).forEach((child) => walk(child, null))
      return
    }

    const rule = cssRules[className] ?? {}
    const width = parsePx(rule.width, 100)
    const height = parsePx(rule.height, 100)

    let x = 0
    let y = 0
    if (layoutMode === 'grid') {
      const col = parseGridPlacement(rule['grid-column'])
      const row = parseGridPlacement(rule['grid-row'])
      x = (col.start - 1) * gridSize
      y = (row.start - 1) * gridSize
    } else {
      x = parsePx(rule.left, 0)
      y = parsePx(rule.top, 0)
    }

    const elementId = className.startsWith('el-') ? className : `el-import-${serial}`
    const background = rule.background ?? '#4f7cff'
    const opacity = Number(rule.opacity ?? '0.9')

    elements.push({
      id: elementId,
      serial,
      parentId,
      kind: 'div',
      type: 'div',
      name: `Imported-${serial}`,
      x,
      y,
      width,
      height,
      background,
      text: '',
      opacity: Number.isFinite(opacity) ? opacity : 0.9
    })
    const currentId = elementId
    serial += 1
    Array.from(node.children).forEach((child) => walk(child, currentId))
  }

  if (rootSection) {
    walk(rootSection as Element, null)
  }

  return { elements, layoutMode }
}
