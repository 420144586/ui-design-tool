import type { CanvasConfig, DesignElement, LayoutMode } from '@renderer/types/design'
import {
  generateAnimationStyleBlockForElement,
  shouldEmitAnimShowScript,
  wrapTemplateLinesWithTransition
} from '@renderer/utils/animationCodegen'
import { cssBackgroundFill } from '@renderer/utils/elementBackground'
import { boxBorderCssLines } from '@renderer/utils/elementBorder'
import {
  gridPlacementForElement,
  layoutCenterCssForAbsolute,
  layoutCenterCssForGrid
} from '@renderer/utils/layoutCenter'
import { cssWidthHeightStrings, resolveElementLayoutPxBox } from '@renderer/utils/elementLayoutSize'
import { marginCssDecl, paddingCssDecl } from '@renderer/utils/elementSpacing'
import { flexContainerCssLines, sortSiblingsForRenderOrder } from '@renderer/utils/elementFlex'
import { elementDomClass } from '@renderer/utils/elementClassStrategy'

const sortByLayer = (elements: DesignElement[]): DesignElement[] =>
  [...elements].sort((a, b) => a.y - b.y || a.x - b.x)

/** 表格 tr/td :nth-child(odd|even) 条纹背景（导出与属性面板 CSS） */
export const tableStripingCss = (element: DesignElement): string => {
  if (element.kind !== 'table') return ''
  const cls = elementDomClass(element)
  const parts: string[] = []
  if (element.tableTrOddBgEnabled) {
    const bg = element.tableTrOddBg?.trim() || '#e8eef5'
    parts.push(`.${cls} tr:nth-child(odd) {\n  background: ${bg};\n}`)
  }
  if (element.tableTrEvenBgEnabled) {
    const bg = element.tableTrEvenBg?.trim() || '#ffffff'
    parts.push(`.${cls} tr:nth-child(even) {\n  background: ${bg};\n}`)
  }
  if (element.tableTdOddBgEnabled) {
    const bg = element.tableTdOddBg?.trim() || '#e8eef5'
    parts.push(`.${cls} td:nth-child(odd) {\n  background: ${bg};\n}`)
  }
  if (element.tableTdEvenBgEnabled) {
    const bg = element.tableTdEvenBg?.trim() || '#ffffff'
    parts.push(`.${cls} td:nth-child(even) {\n  background: ${bg};\n}`)
  }
  return parts.length ? `${parts.join('\n')}\n` : ''
}

const indent = (level: number): string => '  '.repeat(level)

const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const elementHasChildren = (elements: DesignElement[], id: string): boolean =>
  elements.some((item) => item.parentId === id)

function shouldUseGridPlacementCss(
  layoutMode: LayoutMode,
  element: DesignElement,
  parent: DesignElement | undefined
): boolean {
  if (layoutMode === 'flex' && !element.parentId) return false
  if (layoutMode === 'grid') return true
  if (parent?.gridLayoutForChildren) return true
  return false
}

function isRootFlexCanvas(layoutMode: LayoutMode, element: DesignElement): boolean {
  return layoutMode === 'flex' && element.parentId == null
}

/** 顶层在 Flex 画布上为 flex 子项，否则为 absolute 堆叠 */
function rootStackingCss(
  layoutMode: LayoutMode,
  element: DesignElement,
  relativeX: number,
  relativeY: number
): string[] {
  if (isRootFlexCanvas(layoutMode, element)) {
    return [
      '  position: relative;',
      '  flex: 0 0 auto;',
      `  z-index: ${element.serial};`,
      ...layoutCenterCssForAbsolute(element, relativeX, relativeY)
    ]
  }
  return [
    '  position: absolute;',
    `  z-index: ${element.serial};`,
    ...layoutCenterCssForAbsolute(element, relativeX, relativeY)
  ]
}

/** 与 text-align 一致：flex 叶子容器上调整主轴，避免 justify-content:center 抵消对齐 */
const flexJustifyFromTextAlign = (ta: DesignElement['textAlign'] | undefined): string => {
  const v = ta ?? 'center'
  if (v === 'left' || v === 'justify') return 'flex-start'
  if (v === 'right') return 'flex-end'
  return 'center'
}

const buildTemplateTree = (
  elements: DesignElement[],
  parentId: string | null,
  level: number
): string[] => {
  const c = (e: DesignElement): string => elementDomClass(e)
  const nodes = sortSiblingsForRenderOrder(elements, parentId)
  const lines: string[] = []
  nodes.forEach((node) => {
    if (node.kind === 'image' && node.type === 'img') {
      const src = escapeHtml((node.imageSrc ?? '').trim())
      const block = [`${indent(level)}<img class="${c(node)}" src="${src}" alt="" />`]
      lines.push(...wrapTemplateLinesWithTransition(block, node, level))
      return
    }
    if (node.kind === 'image' && node.type === 'div') {
      const ch = sortSiblingsForRenderOrder(elements, node.id)
      const imgEl = ch.find((item) => item.type === 'img')
      const labelEl = ch.find(
        (item) => item.type === 'div' && item.name.endsWith('-label')
      )
      const block: string[] = []
      block.push(`${indent(level)}<div class="${c(node)}">`)
      if (imgEl) {
        const src = escapeHtml((imgEl.imageSrc ?? node.imageSrc ?? '').trim())
        block.push(`${indent(level + 1)}<img class="${c(imgEl)}" src="${src}" alt="" />`)
      }
      if (node.hasLabel && labelEl) {
        const t = labelEl.text.trim()
        block.push(
          `${indent(level + 1)}<div class="${c(labelEl)}">${t ? escapeHtml(t) : ''}</div>`
        )
      }
      block.push(`${indent(level)}</div>`)
      lines.push(...wrapTemplateLinesWithTransition(block, node, level))
      return
    }
    if (node.kind === 'table') {
      const rows = Math.max(1, Math.floor(Number(node.tableRows) || 5))
      const cols = Math.max(1, Math.floor(Number(node.tableCols) || 5))
      const block: string[] = []
      block.push(`${indent(level)}<table class="${c(node)}">`)
      for (let r = 0; r < rows; r += 1) {
        block.push(`${indent(level + 1)}<tr>`)
        for (let c = 0; c < cols; c += 1) {
          const cell = elements.find(
            (el) =>
              el.parentId === node.id &&
              el.isTableCell &&
              el.tableCellRow === r &&
              el.tableCellCol === c
          )
          block.push(`${indent(level + 2)}<td>`)
          if (cell) {
            block.push(...buildTemplateTree(elements, cell.id, level + 3))
          }
          block.push(`${indent(level + 2)}</td>`)
        }
        block.push(`${indent(level + 1)}</tr>`)
      }
      block.push(`${indent(level)}</table>`)
      lines.push(...wrapTemplateLinesWithTransition(block, node, level))
      return
    }

    if (node.kind === 'dcomponent') {
      const key = (node.componentKey ?? '').trim()
      if (key === 'DButton') {
        const extra = (node.componentClass ?? '')
          .trim()
          .replace(/[^\w\s-]/g, '')
          .trim()
        const base = c(node)
        const cls = extra ? `${base} ${extra}` : base
        const block = [`${indent(level)}<DButton class="${cls}" />`]
        lines.push(...wrapTemplateLinesWithTransition(block, node, level))
      } else if (key === 'DInput') {
        const extra = (node.componentClass ?? '')
          .trim()
          .replace(/[^\w\s-]/g, '')
          .trim()
        const base = c(node)
        const cls = extra ? `${base} ${extra}` : base
        const block = [`${indent(level)}<DInput class="${cls}" />`]
        lines.push(...wrapTemplateLinesWithTransition(block, node, level))
      }
      return
    }

    const children = buildTemplateTree(elements, node.id, level + 1)
    const label = node.text.trim()
    if (children.length === 0) {
      const inner = label
        ? `<span class="${c(node)}-text">${escapeHtml(label)}</span>`
        : ''
      const block = [`${indent(level)}<div class="${c(node)}">${inner}</div>`]
      lines.push(...wrapTemplateLinesWithTransition(block, node, level))
      return
    }
    const block: string[] = []
    block.push(`${indent(level)}<div class="${c(node)}">`)
    if (label) {
      block.push(
        `${indent(level + 1)}<span class="${c(node)}-label"><span class="${c(node)}-label-inner">${escapeHtml(label)}</span></span>`
      )
    }
    block.push(...children)
    block.push(`${indent(level)}</div>`)
    lines.push(...wrapTemplateLinesWithTransition(block, node, level))
  })
  return lines
}

export const generateTemplateCode = (elements: DesignElement[], layoutMode: LayoutMode): string => {
  void layoutMode
  const lines = buildTemplateTree(elements, null, 2)

  return ['<template>', ...lines, '</template>'].join('\n')
}

const collectDComponentImports = (elements: DesignElement[]): string[] => {
  const lines: string[] = []
  const keys = new Set(
    elements
      .filter((e) => e.kind === 'dcomponent')
      .map((e) => (e.componentKey ?? '').trim())
      .filter(Boolean)
  )
  if (keys.has('DButton')) {
    lines.push(`import DButton from '@renderer/D-components/DButton.vue'`)
  }
  if (keys.has('DInput')) {
    lines.push(`import DInput from '@renderer/D-components/DInput.vue'`)
  }
  return lines
}

export const generateScriptCode = (elements: DesignElement[]): string => {
  const dImports = collectDComponentImports(elements)
  const animNeed = elements.filter(shouldEmitAnimShowScript)
  const parts: string[] = ['<script setup lang="ts">']
  if (animNeed.length > 0) {
    parts.push(`import { reactive } from 'vue'`)
  }
  if (dImports.length > 0) {
    parts.push('')
    parts.push(...dImports)
  }
  if (animNeed.length > 0) {
    const obj = animNeed.map((e) => `  '${e.id}': true`).join(',\n')
    parts.push('', 'const animShow = reactive<Record<string, boolean>>({', obj, '})')
    parts.push('', 'defineExpose({ animShow })')
  }
  if (parts.length === 1) {
    parts.push('')
  }
  parts.push('</script>')
  return parts.join('\n')
}

/** 与导出 <style> 中该元素的规则一致，供属性面板「CSS 代码」预览 */
export function generateStyleBlockForElement(
  element: DesignElement,
  elements: DesignElement[],
  layoutMode: LayoutMode,
  canvas: Pick<CanvasConfig, 'width' | 'height' | 'gridSize'>
): string {
  if (element.isTableCell) {
    return ''
  }
  const parent = element.parentId ? elements.find((item) => item.id === element.parentId) : undefined
  const relativeX = parent ? element.x - parent.x : element.x
  const relativeY = parent ? element.y - parent.y : element.y
  const ec = elementDomClass(element)
  const hasChildren = elementHasChildren(elements, element.id)
  const leafTextInnerRule =
    !hasChildren &&
    element.text.trim() &&
    element.kind !== 'image' &&
    element.kind !== 'table' &&
    element.kind !== 'dcomponent'
      ? `\n.${ec}-text {\n  display: block;\n  width: 100%;\n  min-width: 0;\n}`
      : ''
  const boxPx = resolveElementLayoutPxBox(element, elements, canvas)
  const wh = cssWidthHeightStrings(element)
  const gridPlacementModel = { ...element, width: boxPx.width, height: boxPx.height }

  const parentFlex = parent?.flexLayoutEnabled === true

  /** Flex 父级内部用 flex 排版时，不再对「自身这一条 grid 子项规则」叠加 place-self（与内部 flex 易冲突） */
  const gridItemSelfCss = (): string[] => {
    if (element.flexLayoutEnabled && hasChildren) return []
    return layoutCenterCssForGrid(element)
  }

  const commonStyles: string[] = []
  if (element.color) commonStyles.push(`  color: ${element.color};`)
  if (element.fontSize) commonStyles.push(`  font-size: ${element.fontSize}px;`)
  if (element.fontWeight) commonStyles.push(`  font-weight: ${element.fontWeight};`)
  commonStyles.push(`  text-align: ${element.textAlign ?? 'center'};`)
  if (element.borderRadius) commonStyles.push(`  border-radius: ${element.borderRadius}px;`)
  commonStyles.push(...boxBorderCssLines(element))
  commonStyles.push(
    `  box-sizing: ${element.boxSizing === 'content-box' ? 'content-box' : 'border-box'};`
  )
  commonStyles.push(...paddingCssDecl(element))
  commonStyles.push(...marginCssDecl(element))

  if (element.kind === 'image' && element.type === 'img') {
    if (shouldUseGridPlacementCss(layoutMode, element, parent)) {
      const gp = gridPlacementForElement(gridPlacementModel, relativeX, relativeY, canvas.gridSize)
      return [
        `.${ec} {`,
        `  grid-column: ${gp.gridColumn};`,
        `  grid-row: ${gp.gridRow};`,
        ...gridItemSelfCss(),
        `  width: ${wh.width};`,
        `  height: ${wh.height};`,
        `  opacity: ${element.opacity};`,
        '  object-fit: cover;',
        '  display: block;',
        ...commonStyles,
        '}'
      ].join('\n')
    }
    return [
      `.${ec} {`,
      ...rootStackingCss(layoutMode, element, relativeX, relativeY),
      `  width: ${wh.width};`,
      `  height: ${wh.height};`,
      `  opacity: ${element.opacity};`,
      '  object-fit: cover;',
      '  display: block;',
      ...commonStyles,
      '}'
    ].join('\n')
  }

  if (element.kind === 'image' && element.type === 'div') {
    const gap = element.gap ?? 10
    const imageFlexInner = element.flexLayoutEnabled
      ? [...flexContainerCssLines(element), '  overflow: hidden;']
      : [
          '  display: flex;',
          '  flex-direction: row;',
          '  align-items: center;',
          `  gap: ${gap}px;`
        ]
    if (shouldUseGridPlacementCss(layoutMode, element, parent)) {
      const gp = gridPlacementForElement(gridPlacementModel, relativeX, relativeY, canvas.gridSize)
      if (element.flexLayoutEnabled && hasChildren) {
        return [
          `.${ec} {`,
          ...rootStackingCss(layoutMode, element, relativeX, relativeY),
          `  width: ${wh.width};`,
          `  height: ${wh.height};`,
          `  background: ${cssBackgroundFill(element)};`,
          `  opacity: ${element.opacity};`,
          ...imageFlexInner,
          ...commonStyles,
          '}'
        ].join('\n')
      }
      return [
        `.${ec} {`,
        `  grid-column: ${gp.gridColumn};`,
        `  grid-row: ${gp.gridRow};`,
        ...gridItemSelfCss(),
        `  width: ${wh.width};`,
        `  height: ${wh.height};`,
        `  background: ${cssBackgroundFill(element)};`,
        `  opacity: ${element.opacity};`,
        '  position: relative;',
        ...imageFlexInner,
        ...commonStyles,
        '}'
      ].join('\n')
    }
    return [
      `.${ec} {`,
      ...rootStackingCss(layoutMode, element, relativeX, relativeY),
      `  width: ${wh.width};`,
      `  height: ${wh.height};`,
      `  background: ${cssBackgroundFill(element)};`,
      `  opacity: ${element.opacity};`,
      ...imageFlexInner,
      ...commonStyles,
      '}'
    ].join('\n')
  }

  if (element.kind === 'table') {
    const bc = element.borderColor ?? '#d0d0d0'
    const rows = Math.max(1, Math.floor(Number(element.tableRows) || 5))
    const cols = Math.max(1, Math.floor(Number(element.tableCols) || 5))
    const tw = Math.max(1, element.width)
    const th = Math.max(1, element.height)
    const cellRuleBlocks: string[] = []
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const cell = elements.find(
          (el) =>
            el.parentId === element.id &&
            el.isTableCell &&
            el.tableCellRow === r &&
            el.tableCellCol === c
        )
        if (!cell) continue
        const wPct = (cell.width / tw) * 100
        const hPct = (cell.height / th) * 100
        const inner: string[] = [
          `  width: ${wPct.toFixed(4)}%;`,
          `  height: ${hPct.toFixed(4)}%;`,
          '  box-sizing: border-box;',
          ...paddingCssDecl(cell),
          ...marginCssDecl(cell),
          ...(cell.flexLayoutEnabled
            ? [...flexContainerCssLines(cell), '  overflow: hidden;']
            : [])
        ]
        cellRuleBlocks.push(
          `.${ec} tr:nth-child(${r + 1}) td:nth-child(${c + 1}) {\n${inner.join('\n')}\n}`
        )
      }
    }
    const cellRules = cellRuleBlocks.length ? `\n${cellRuleBlocks.join('\n')}` : ''
    if (shouldUseGridPlacementCss(layoutMode, element, parent)) {
      const gp = gridPlacementForElement(gridPlacementModel, relativeX, relativeY, canvas.gridSize)
      return [
        `.${ec} {`,
        `  grid-column: ${gp.gridColumn};`,
        `  grid-row: ${gp.gridRow};`,
        ...gridItemSelfCss(),
        `  width: ${wh.width};`,
        `  height: ${wh.height};`,
        `  background: ${cssBackgroundFill(element)};`,
        `  opacity: ${element.opacity};`,
        '  position: relative;',
        '  border-collapse: collapse;',
        '  table-layout: fixed;',
        ...commonStyles,
        '}',
        `.${ec} td {`,
        `  border: 1px solid ${bc};`,
        '  position: relative;',
        '  vertical-align: top;',
        '}',
        cellRules,
        tableStripingCss(element)
      ]
        .filter(Boolean)
        .join('\n')
    }
    return [
      `.${ec} {`,
      ...rootStackingCss(layoutMode, element, relativeX, relativeY),
      `  width: ${wh.width};`,
      `  height: ${wh.height};`,
      `  background: ${cssBackgroundFill(element)};`,
      `  opacity: ${element.opacity};`,
      '  border-collapse: collapse;',
      '  table-layout: fixed;',
      ...commonStyles,
      '}',
      `.${ec} td {`,
      `  border: 1px solid ${bc};`,
      '  position: relative;',
      '  vertical-align: top;',
      '}',
      cellRules,
      tableStripingCss(element)
    ]
      .filter(Boolean)
      .join('\n')
  }

  if (parent?.kind === 'image' && element.type === 'img') {
    return [
      `.${ec} {`,
      '  flex: 0 0 auto;',
      '  width: 30px;',
      '  height: 30px;',
      '  object-fit: cover;',
      '  display: block;',
      `  opacity: ${element.opacity};`,
      ...commonStyles,
      '}'
    ].join('\n')
  }

  if (
    parent?.kind === 'image' &&
    parent.hasLabel &&
    element.type === 'div' &&
    element.name.endsWith('-label')
  ) {
    return [
      `.${ec} {`,
      '  flex: 1 1 auto;',
      '  min-width: 100px;',
      '  max-width: none;',
      '  height: 100%;',
      `  background: ${cssBackgroundFill(element)};`,
      `  opacity: ${element.opacity};`,
      '  display: flex;',
      '  align-items: center;',
      `  justify-content: ${flexJustifyFromTextAlign(element.textAlign)};`,
      ...commonStyles,
      '}'
    ].join('\n')
  }

  if (
    parentFlex &&
    !(element.kind === 'image' && element.type === 'img') &&
    !(
      parent &&
      parent.kind === 'image' &&
      parent.hasLabel &&
      element.type === 'div' &&
      element.name.endsWith('-label')
    )
  ) {
    const bg =
      element.kind === 'dcomponent' ? 'transparent' : cssBackgroundFill(element)
    const selfFlex = element.flexLayoutEnabled
      ? [...flexContainerCssLines(element), '  overflow: hidden;']
      : []
    return (
      [
        `.${ec} {`,
        '  position: relative;',
        '  flex-shrink: 0;',
        `  width: ${wh.width};`,
        `  height: ${wh.height};`,
        `  background: ${bg};`,
        `  opacity: ${element.opacity};`,
        ...selfFlex,
        ...commonStyles,
        '}'
      ].join('\n') + leafTextInnerRule
    )
  }

  if (
    parent?.kind === 'column' &&
    (element.kind === 'div' || element.kind === 'column') &&
    !parentFlex
  ) {
    const colSlotFlex = element.flexLayoutEnabled
      ? [...flexContainerCssLines(element), '  overflow: hidden;']
      : [
            '  display: flex;',
            '  align-items: center;',
            `  justify-content: ${flexJustifyFromTextAlign(element.textAlign)};`
          ]
    return [
      `.${ec} {`,
      '  position: relative;',
      '  flex: 1 1 0;',
      '  min-height: 0;',
      '  width: 100%;',
      `  background: ${cssBackgroundFill(element)};`,
      `  opacity: ${element.opacity};`,
      ...colSlotFlex,
      ...commonStyles,
      '}'
    ].join('\n') + leafTextInnerRule
  }

  if (shouldUseGridPlacementCss(layoutMode, element, parent)) {
    const gp = gridPlacementForElement(gridPlacementModel, relativeX, relativeY, canvas.gridSize)
    if (!hasChildren) {
      const noChildLayout = element.flexLayoutEnabled
        ? [...flexContainerCssLines(element), '  overflow: hidden;']
        : [
            '  display: flex;',
            '  align-items: center;',
            `  justify-content: ${flexJustifyFromTextAlign(element.textAlign)};`
          ]
      return [
        `.${ec} {`,
        `  grid-column: ${gp.gridColumn};`,
        `  grid-row: ${gp.gridRow};`,
        ...gridItemSelfCss(),
        `  width: ${wh.width};`,
        `  height: ${wh.height};`,
        `  background: ${cssBackgroundFill(element)};`,
        `  opacity: ${element.opacity};`,
        '  position: relative;',
        ...noChildLayout,
        ...commonStyles,
        '}'
      ].join('\n') + leafTextInnerRule
    }
    if (element.kind === 'column' && hasChildren) {
      const colInner = element.flexLayoutEnabled
        ? [...flexContainerCssLines(element), '  overflow: hidden;']
        : [
            '  display: flex;',
            '  flex-direction: column;',
            '  align-items: stretch;',
            '  justify-content: flex-start;',
            '  overflow: hidden;'
          ]
      if (element.flexLayoutEnabled) {
        return [
          `.${ec} {`,
          ...rootStackingCss(layoutMode, element, relativeX, relativeY),
          `  width: ${wh.width};`,
          `  height: ${wh.height};`,
          `  background: ${cssBackgroundFill(element)};`,
          `  opacity: ${element.opacity};`,
          ...colInner,
          ...commonStyles,
          '}'
        ].join('\n')
      }
      return [
        `.${ec} {`,
        `  grid-column: ${gp.gridColumn};`,
        `  grid-row: ${gp.gridRow};`,
        ...gridItemSelfCss(),
        `  width: ${wh.width};`,
        `  height: ${wh.height};`,
        `  background: ${cssBackgroundFill(element)};`,
        `  opacity: ${element.opacity};`,
        '  position: relative;',
        ...colInner,
        ...commonStyles,
        '}'
      ].join('\n')
    }
    if (hasChildren && element.flexLayoutEnabled) {
      return [
        `.${ec} {`,
        ...rootStackingCss(layoutMode, element, relativeX, relativeY),
        `  width: ${wh.width};`,
        `  height: ${wh.height};`,
        `  background: ${cssBackgroundFill(element)};`,
        `  opacity: ${element.opacity};`,
        ...flexContainerCssLines(element),
        '  overflow: hidden;',
        ...commonStyles,
        '}'
      ].join('\n')
    }
    return [
      `.${ec} {`,
      `  grid-column: ${gp.gridColumn};`,
      `  grid-row: ${gp.gridRow};`,
      ...gridItemSelfCss(),
      `  width: ${wh.width};`,
      `  height: ${wh.height};`,
      `  background: ${cssBackgroundFill(element)};`,
      `  opacity: ${element.opacity};`,
      '  position: relative;',
      '  display: grid;',
      '  place-items: center;',
      `  grid-template-columns: repeat(${Math.max(1, Math.floor(boxPx.width / canvas.gridSize))}, ${canvas.gridSize}px);`,
      `  grid-template-rows: repeat(${Math.max(1, Math.floor(boxPx.height / canvas.gridSize))}, ${canvas.gridSize}px);`,
      ...commonStyles,
      '}'
    ].join('\n')
  }

  if (element.kind === 'column' && hasChildren) {
    const colInner = element.flexLayoutEnabled
      ? [...flexContainerCssLines(element), '  overflow: hidden;']
      : [
          '  display: flex;',
          '  flex-direction: column;',
          '  align-items: stretch;',
          '  justify-content: flex-start;',
          '  overflow: hidden;'
        ]
    return [
      `.${ec} {`,
      ...rootStackingCss(layoutMode, element, relativeX, relativeY),
      `  width: ${wh.width};`,
      `  height: ${wh.height};`,
      `  background: ${cssBackgroundFill(element)};`,
      `  opacity: ${element.opacity};`,
      ...colInner,
      ...commonStyles,
      '}'
    ].join('\n')
  }

  const flexParentAbs = element.flexLayoutEnabled
    ? [...flexContainerCssLines(element), '  overflow: hidden;']
    : []
  const leafOnlyCenter: string[] =
    !hasChildren && !element.flexLayoutEnabled
      ? [
          '  display: flex;',
          '  align-items: center;',
          `  justify-content: ${flexJustifyFromTextAlign(element.textAlign)};`
        ]
      : []

  return (
    [
      `.${ec} {`,
      ...rootStackingCss(layoutMode, element, relativeX, relativeY),
      `  width: ${wh.width};`,
      `  height: ${wh.height};`,
      `  background: ${cssBackgroundFill(element)};`,
      `  opacity: ${element.opacity};`,
      ...flexParentAbs,
      ...leafOnlyCenter,
      ...commonStyles,
      '}'
    ]
      .filter((line) => line !== '')
      .join('\n') + leafTextInnerRule
  )
}

export const generateStyleCode = (
  elements: DesignElement[],
  layoutMode: LayoutMode,
  canvas: Pick<CanvasConfig, 'width' | 'height' | 'gridSize'>
): string => {
  const flexCanvasRootCss =
    layoutMode === 'flex'
      ? [
          'body {',
          '  display: flex;',
          '  flex-flow: row wrap;',
          '  align-items: flex-start;',
          '  align-content: flex-start;',
          '  gap: 12px;',
          '  padding: 8px;',
          '  box-sizing: border-box;',
          '  margin: 0;',
          `  width: ${canvas.width}px;`,
          `  min-height: ${canvas.height}px;`,
          '  background: #1a1f2b;',
          '}'
        ].join('\n')
      : ''

  const elementStyles = sortByLayer(elements)
    .map((el) => generateStyleBlockForElement(el, elements, layoutMode, canvas))
    .filter((block) => block !== '')

  const overlayLabelStyles = sortByLayer(elements)
    .filter((el) => el.text.trim() && elementHasChildren(elements, el.id))
    .flatMap((el) => {
      const lc = elementDomClass(el)
      return [
      [
        `.${lc}-label {`,
        '  position: absolute;',
        '  inset: 0;',
        '  display: flex;',
        '  align-items: center;',
        `  justify-content: ${flexJustifyFromTextAlign(el.textAlign)};`,
        `  text-align: ${el.textAlign ?? 'center'};`,
        '  pointer-events: none;',
        '  z-index: 1;',
        '}'
      ].join('\n'),
      [
        `.${lc}-label-inner {`,
        '  display: block;',
        '  width: 100%;',
        '  min-width: 0;',
        '  box-sizing: border-box;',
        '}'
      ].join('\n')
    ]
    })

  const animationStyles = elements
    .map((el) => generateAnimationStyleBlockForElement(el))
    .filter((block) => block !== '')

  return [flexCanvasRootCss, ...elementStyles, '', ...overlayLabelStyles, '', ...animationStyles]
    .filter((block) => block !== '')
    .join('\n')
}

export const generateVueSfcCode = (
  elements: DesignElement[],
  layoutMode: LayoutMode,
  canvas: Pick<CanvasConfig, 'width' | 'height' | 'gridSize'>
): string => {
  return [
    generateTemplateCode(elements, layoutMode),
    '',
    generateScriptCode(elements),
    '',
    '<style scoped>',
    generateStyleCode(elements, layoutMode, canvas),
    '</style>'
  ].join('\n')
}

const DBUTTON_CSS = `:where(.d-button) {
  width: 160px; height: 50px; box-sizing: border-box;
  border-radius: 1px; border: 1px solid #93ADC9;
  background: linear-gradient(180deg, #fff 0%, #ffffff86 100%);
  color: #575A6E; cursor: pointer; font-size: 18px;
}
.d-button.d-button--ghost { background: transparent; color: #8fb2ff; border-color: #5a7ddb; }
.d-button.d-button--danger { border-color: #c44; background: linear-gradient(180deg, #e05555 0%, #c62828 100%); color: #fff; }
.d-button.d-button--success { border-color: #2e7d32; background: linear-gradient(180deg, #4caf50 0%, #2e7d32 100%); color: #fff; }
.d-button.d-button--pill { border-radius: 999px; }
.d-button.d-button--compact { padding: 4px 10px; font-size: 12px; }`

const DINPUT_CSS = `:where(.d-input) {
  display: block; width: 100%; height: 100%; box-sizing: border-box; margin: 0;
  padding: 0 14px; border-radius: 2px; border: 1.5px solid #becad6; background: #fff;
  color: #39434e; font-size: 22px; outline: none;
}
:where(.d-input)::placeholder { color: #818f9b; opacity: 1; }`

export const generatePreviewHtml = (
  elements: DesignElement[],
  layoutMode: LayoutMode,
  canvas: Pick<CanvasConfig, 'width' | 'height' | 'gridSize'>
): string => {
  const lines = buildTemplateTree(elements, null, 1)
  let html = lines.join('\n')

  html = html
    .replace(/<Transition[^>]*>\n?/g, '')
    .replace(/<\/Transition>\n?/g, '')
    .replace(/\s+v-if="[^"]*"/g, '')
    .replace(/\s+v-show="[^"]*"/g, '')
    .replace(/\s+appear(?=[\s>\/])/g, '')
    .replace(/<DButton\s+class="([^"]*)"[^/]*\/>/g, '<button type="button" class="d-button $1">按钮</button>')
    .replace(/<DButton[^/]*\/>/g, '<button type="button" class="d-button">按钮</button>')
    .replace(/<DInput\s+class="([^"]*)"[^/]*\/>/g, '<input type="text" class="d-input $1" placeholder="" />')
    .replace(/<DInput[^/]*\/>/g, '<input type="text" class="d-input" placeholder="" />')

  const css = generateStyleCode(elements, layoutMode, canvas)

  return [
    '<!DOCTYPE html>',
    '<html><head><meta charset="UTF-8">',
    '<style>',
    'html, body { margin: 0; padding: 0; }',
    css,
    DBUTTON_CSS,
    '\n',
    DINPUT_CSS,
    '</style>',
    '</head><body>',
    html,
    '</body></html>'
  ].join('\n')
}
