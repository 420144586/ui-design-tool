import type { CanvasConfig, DesignElement, LayoutMode } from '@renderer/types/design'

const sortByLayer = (elements: DesignElement[]): DesignElement[] =>
  [...elements].sort((a, b) => a.y - b.y || a.x - b.x)

const indent = (level: number): string => '  '.repeat(level)

const buildTemplateTree = (
  elements: DesignElement[],
  parentId: string | null,
  level: number
): string[] => {
  const nodes = sortByLayer(elements).filter((item) => item.parentId === parentId)
  const lines: string[] = []
  nodes.forEach((node) => {
    const children = buildTemplateTree(elements, node.id, level + 1)
    if (children.length === 0) {
      lines.push(`${indent(level)}<div class="${node.id}">${node.serial}</div>`)
      return
    }
    lines.push(`${indent(level)}<div class="${node.id}">`)
    lines.push(...children)
    lines.push(`${indent(level)}</div>`)
  })
  return lines
}

export const generateTemplateCode = (elements: DesignElement[], layoutMode: LayoutMode): string => {
  const lines = buildTemplateTree(elements, null, 2)

  return [
    '<template>',
    '  <section class="canvas-root">',
    ...lines,
    '  </section>',
    '</template>'
  ].join('\n')
}

export const generateScriptCode = (): string => {
  return [
    '<script setup lang="ts">',
    "import { ref } from 'vue'",
    '',
    "const message = ref('由设计器生成的 Vue 组件')",
    '</script>'
  ].join('\n')
}

const toGridPlacement = (element: DesignElement, gridSize: number): { col: number; row: number; colSpan: number; rowSpan: number } => {
  const col = Math.floor(element.x / gridSize) + 1
  const row = Math.floor(element.y / gridSize) + 1
  const colSpan = Math.max(1, Math.ceil(element.width / gridSize))
  const rowSpan = Math.max(1, Math.ceil(element.height / gridSize))
  return { col, row, colSpan, rowSpan }
}

export const generateStyleCode = (
  elements: DesignElement[],
  layoutMode: LayoutMode,
  canvas: Pick<CanvasConfig, 'width' | 'height' | 'gridSize'>
): string => {
  const rootStyle =
    layoutMode === 'grid'
      ? [
          '.canvas-root {',
          '  position: relative;',
          '  display: grid;',
          `  grid-template-columns: repeat(${Math.max(1, Math.floor(canvas.width / canvas.gridSize))}, ${canvas.gridSize}px);`,
          `  grid-template-rows: repeat(${Math.max(1, Math.floor(canvas.height / canvas.gridSize))}, ${canvas.gridSize}px);`,
          `  width: ${canvas.width}px;`,
          `  height: ${canvas.height}px;`,
          '}'
        ]
      : ['.canvas-root {', '  position: relative;', '  width: 100%;', '  min-height: 300px;', '}']

  const elementStyles = sortByLayer(elements).map((element) => {
    const parent = element.parentId ? elements.find((item) => item.id === element.parentId) : undefined
    const relativeX = parent ? element.x - parent.x : element.x
    const relativeY = parent ? element.y - parent.y : element.y

    if (layoutMode === 'grid') {
      const grid = toGridPlacement({ ...element, x: relativeX, y: relativeY }, canvas.gridSize)
      return [
        `.${element.id} {`,
        `  grid-column: ${grid.col} / span ${grid.colSpan};`,
        `  grid-row: ${grid.row} / span ${grid.rowSpan};`,
        `  width: ${element.width}px;`,
        `  height: ${element.height}px;`,
        `  background: ${element.background};`,
        `  opacity: ${element.opacity};`,
        '  display: grid;',
        `  grid-template-columns: repeat(${Math.max(1, Math.floor(element.width / canvas.gridSize))}, ${canvas.gridSize}px);`,
        `  grid-template-rows: repeat(${Math.max(1, Math.floor(element.height / canvas.gridSize))}, ${canvas.gridSize}px);`,
        '}'
      ].join('\n')
    }

    return [
      `.${element.id} {`,
      '  position: absolute;',
      `  z-index: ${element.serial};`,
      `  left: ${element.x}px;`,
      `  top: ${element.y}px;`,
      `  width: ${element.width}px;`,
      `  height: ${element.height}px;`,
      `  background: ${element.background};`,
      `  opacity: ${element.opacity};`,
      '}'
    ].join('\n')
  })

  return [...rootStyle, '', ...elementStyles].join('\n')
}

export const generateVueSfcCode = (
  elements: DesignElement[],
  layoutMode: LayoutMode,
  canvas: Pick<CanvasConfig, 'width' | 'height' | 'gridSize'>
): string => {
  return [
    generateTemplateCode(elements, layoutMode),
    '',
    generateScriptCode(),
    '',
    '<style scoped>',
    generateStyleCode(elements, layoutMode, canvas),
    '</style>'
  ].join('\n')
}
