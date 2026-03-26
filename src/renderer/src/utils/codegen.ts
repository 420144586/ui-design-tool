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

const sortByLayer = (elements: DesignElement[]): DesignElement[] =>
  [...elements].sort((a, b) => a.y - b.y || a.x - b.x)

const indent = (level: number): string => '  '.repeat(level)

const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const elementHasChildren = (elements: DesignElement[], id: string): boolean =>
  elements.some((item) => item.parentId === id)

const buildTemplateTree = (
  elements: DesignElement[],
  parentId: string | null,
  level: number
): string[] => {
  const nodes = sortByLayer(elements).filter((item) => item.parentId === parentId)
  const lines: string[] = []
  nodes.forEach((node) => {
    if (node.kind === 'image' && node.type === 'img') {
      const src = escapeHtml((node.imageSrc ?? '').trim())
      const block = [`${indent(level)}<img class="${node.id}" src="${src}" alt="" />`]
      lines.push(...wrapTemplateLinesWithTransition(block, node, level))
      return
    }
    if (node.kind === 'image' && node.type === 'div') {
      const ch = sortByLayer(elements).filter((item) => item.parentId === node.id)
      const imgEl = ch.find((item) => item.type === 'img')
      const labelEl = ch.find(
        (item) => item.type === 'div' && item.name.endsWith('-label')
      )
      const block: string[] = []
      block.push(`${indent(level)}<div class="${node.id}">`)
      if (imgEl) {
        const src = escapeHtml((imgEl.imageSrc ?? node.imageSrc ?? '').trim())
        block.push(`${indent(level + 1)}<img class="${imgEl.id}" src="${src}" alt="" />`)
      }
      if (node.hasLabel && labelEl) {
        const t = labelEl.text.trim()
        block.push(
          `${indent(level + 1)}<div class="${labelEl.id}">${t ? escapeHtml(t) : ''}</div>`
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
      block.push(`${indent(level)}<table class="${node.id}">`)
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
        const cls = extra ? `${node.id} ${extra}` : node.id
        const block = [`${indent(level)}<DButton class="${cls}" />`]
        lines.push(...wrapTemplateLinesWithTransition(block, node, level))
      }
      return
    }

    const children = buildTemplateTree(elements, node.id, level + 1)
    const label = node.text.trim()
    if (children.length === 0) {
      const block = [
        `${indent(level)}<div class="${node.id}">${label ? escapeHtml(label) : ''}</div>`
      ]
      lines.push(...wrapTemplateLinesWithTransition(block, node, level))
      return
    }
    const block: string[] = []
    block.push(`${indent(level)}<div class="${node.id}">`)
    if (label) {
      block.push(`${indent(level + 1)}<span class="${node.id}-label">${escapeHtml(label)}</span>`)
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
  const hasChildren = elementHasChildren(elements, element.id)

  const commonStyles: string[] = []
  if (element.color) commonStyles.push(`  color: ${element.color};`)
  if (element.fontSize) commonStyles.push(`  font-size: ${element.fontSize}px;`)
  if (element.fontWeight) commonStyles.push(`  font-weight: ${element.fontWeight};`)
  if (element.textAlign) commonStyles.push(`  text-align: ${element.textAlign};`)
  if (element.borderRadius) commonStyles.push(`  border-radius: ${element.borderRadius}px;`)
  commonStyles.push(...boxBorderCssLines(element))
  commonStyles.push(
    `  box-sizing: ${element.boxSizing === 'content-box' ? 'content-box' : 'border-box'};`
  )

  if (element.kind === 'image' && element.type === 'img') {
    if (layoutMode === 'grid') {
      const gp = gridPlacementForElement(element, relativeX, relativeY, canvas.gridSize)
      return [
        `.${element.id} {`,
        `  grid-column: ${gp.gridColumn};`,
        `  grid-row: ${gp.gridRow};`,
        ...layoutCenterCssForGrid(element),
        `  width: ${element.width}px;`,
        `  height: ${element.height}px;`,
        `  opacity: ${element.opacity};`,
        '  object-fit: cover;',
        '  display: block;',
        ...commonStyles,
        '}'
      ].join('\n')
    }
    return [
      `.${element.id} {`,
      '  position: absolute;',
      `  z-index: ${element.serial};`,
      ...layoutCenterCssForAbsolute(element, relativeX, relativeY),
      `  width: ${element.width}px;`,
      `  height: ${element.height}px;`,
      `  opacity: ${element.opacity};`,
      '  object-fit: cover;',
      '  display: block;',
      ...commonStyles,
      '}'
    ].join('\n')
  }

  if (element.kind === 'image' && element.type === 'div') {
    const gap = element.gap ?? 10
    if (layoutMode === 'grid') {
      const gp = gridPlacementForElement(element, relativeX, relativeY, canvas.gridSize)
      return [
        `.${element.id} {`,
        `  grid-column: ${gp.gridColumn};`,
        `  grid-row: ${gp.gridRow};`,
        ...layoutCenterCssForGrid(element),
        `  width: ${element.width}px;`,
        `  height: ${element.height}px;`,
        `  background: ${cssBackgroundFill(element)};`,
        `  opacity: ${element.opacity};`,
        '  position: relative;',
        '  display: flex;',
        '  flex-direction: row;',
        '  align-items: center;',
        `  gap: ${gap}px;`,
        ...commonStyles,
        '}'
      ].join('\n')
    }
    return [
      `.${element.id} {`,
      '  position: absolute;',
      `  z-index: ${element.serial};`,
      ...layoutCenterCssForAbsolute(element, relativeX, relativeY),
      `  width: ${element.width}px;`,
      `  height: ${element.height}px;`,
      `  background: ${cssBackgroundFill(element)};`,
      `  opacity: ${element.opacity};`,
      '  display: flex;',
      '  flex-direction: row;',
      '  align-items: center;',
      `  gap: ${gap}px;`,
      ...commonStyles,
      '}'
    ].join('\n')
  }

  if (element.kind === 'table') {
    const bc = element.borderColor ?? '#d0d0d0'
    if (layoutMode === 'grid') {
      const gp = gridPlacementForElement(element, relativeX, relativeY, canvas.gridSize)
      return [
        `.${element.id} {`,
        `  grid-column: ${gp.gridColumn};`,
        `  grid-row: ${gp.gridRow};`,
        ...layoutCenterCssForGrid(element),
        `  width: ${element.width}px;`,
        `  height: ${element.height}px;`,
        `  background: ${cssBackgroundFill(element)};`,
        `  opacity: ${element.opacity};`,
        '  position: relative;',
        '  border-collapse: collapse;',
        '  table-layout: fixed;',
        ...commonStyles,
        '}',
        `.${element.id} td {`,
        `  border: 1px solid ${bc};`,
        '  position: relative;',
        '  vertical-align: top;',
        '}'
      ].join('\n')
    }
    return [
      `.${element.id} {`,
      '  position: absolute;',
      `  z-index: ${element.serial};`,
      ...layoutCenterCssForAbsolute(element, relativeX, relativeY),
      `  width: ${element.width}px;`,
      `  height: ${element.height}px;`,
      `  background: ${cssBackgroundFill(element)};`,
      `  opacity: ${element.opacity};`,
      '  border-collapse: collapse;',
      '  table-layout: fixed;',
      ...commonStyles,
      '}',
      `.${element.id} td {`,
      `  border: 1px solid ${bc};`,
      '  position: relative;',
      '  vertical-align: top;',
      '}'
    ].join('\n')
  }

  if (parent?.kind === 'image' && element.type === 'img') {
    return [
      `.${element.id} {`,
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
      `.${element.id} {`,
      '  flex: 1 1 auto;',
      '  min-width: 100px;',
      '  max-width: none;',
      '  height: 100%;',
      `  background: ${cssBackgroundFill(element)};`,
      `  opacity: ${element.opacity};`,
      '  display: flex;',
      '  align-items: center;',
      '  justify-content: center;',
      ...commonStyles,
      '}'
    ].join('\n')
  }

  if (parent?.kind === 'column' && (element.kind === 'div' || element.kind === 'column')) {
    return [
      `.${element.id} {`,
      '  position: relative;',
      '  flex: 1 1 0;',
      '  min-height: 0;',
      '  width: 100%;',
      `  background: ${cssBackgroundFill(element)};`,
      `  opacity: ${element.opacity};`,
      '  display: flex;',
      '  align-items: center;',
      '  justify-content: center;',
      ...commonStyles,
      '}'
    ].join('\n')
  }

  if (layoutMode === 'grid') {
    const gp = gridPlacementForElement(element, relativeX, relativeY, canvas.gridSize)
    if (!hasChildren) {
      return [
        `.${element.id} {`,
        `  grid-column: ${gp.gridColumn};`,
        `  grid-row: ${gp.gridRow};`,
        ...layoutCenterCssForGrid(element),
        `  width: ${element.width}px;`,
        `  height: ${element.height}px;`,
        `  background: ${cssBackgroundFill(element)};`,
        `  opacity: ${element.opacity};`,
        '  position: relative;',
        '  display: flex;',
        '  align-items: center;',
        '  justify-content: center;',
        ...commonStyles,
        '}'
      ].join('\n')
    }
    if (element.kind === 'column' && hasChildren) {
      return [
        `.${element.id} {`,
        `  grid-column: ${gp.gridColumn};`,
        `  grid-row: ${gp.gridRow};`,
        ...layoutCenterCssForGrid(element),
        `  width: ${element.width}px;`,
        `  height: ${element.height}px;`,
        `  background: ${cssBackgroundFill(element)};`,
        `  opacity: ${element.opacity};`,
        '  position: relative;',
        '  display: flex;',
        '  flex-direction: column;',
        '  align-items: stretch;',
        '  justify-content: flex-start;',
        '  overflow: hidden;',
        ...commonStyles,
        '}'
      ].join('\n')
    }
    return [
      `.${element.id} {`,
      `  grid-column: ${gp.gridColumn};`,
      `  grid-row: ${gp.gridRow};`,
      ...layoutCenterCssForGrid(element),
      `  width: ${element.width}px;`,
      `  height: ${element.height}px;`,
      `  background: ${cssBackgroundFill(element)};`,
      `  opacity: ${element.opacity};`,
      '  position: relative;',
      '  display: grid;',
      '  place-items: center;',
      `  grid-template-columns: repeat(${Math.max(1, Math.floor(element.width / canvas.gridSize))}, ${canvas.gridSize}px);`,
      `  grid-template-rows: repeat(${Math.max(1, Math.floor(element.height / canvas.gridSize))}, ${canvas.gridSize}px);`,
      ...commonStyles,
      '}'
    ].join('\n')
  }

  if (element.kind === 'column' && hasChildren) {
    return [
      `.${element.id} {`,
      '  position: absolute;',
      `  z-index: ${element.serial};`,
      ...layoutCenterCssForAbsolute(element, relativeX, relativeY),
      `  width: ${element.width}px;`,
      `  height: ${element.height}px;`,
      `  background: ${cssBackgroundFill(element)};`,
      `  opacity: ${element.opacity};`,
      '  display: flex;',
      '  flex-direction: column;',
      '  align-items: stretch;',
      '  justify-content: flex-start;',
      '  overflow: hidden;',
      ...commonStyles,
      '}'
    ].join('\n')
  }

  return [
    `.${element.id} {`,
    '  position: absolute;',
    `  z-index: ${element.serial};`,
    ...layoutCenterCssForAbsolute(element, relativeX, relativeY),
    `  width: ${element.width}px;`,
    `  height: ${element.height}px;`,
    `  background: ${cssBackgroundFill(element)};`,
    `  opacity: ${element.opacity};`,
    hasChildren ? '' : '  display: flex;',
    hasChildren ? '' : '  align-items: center;',
    hasChildren ? '' : '  justify-content: center;',
    ...commonStyles,
    '}'
  ]
    .filter((line) => line !== '')
    .join('\n')
}

export const generateStyleCode = (
  elements: DesignElement[],
  layoutMode: LayoutMode,
  canvas: Pick<CanvasConfig, 'width' | 'height' | 'gridSize'>
): string => {
  const elementStyles = sortByLayer(elements)
    .map((el) => generateStyleBlockForElement(el, elements, layoutMode, canvas))
    .filter((block) => block !== '')

  const overlayLabelStyles = sortByLayer(elements)
    .filter((el) => el.text.trim() && elementHasChildren(elements, el.id))
    .map((el) =>
      [
        `.${el.id}-label {`,
        '  position: absolute;',
        '  inset: 0;',
        '  display: flex;',
        '  align-items: center;',
        '  justify-content: center;',
        '  pointer-events: none;',
        '  z-index: 1;',
        '}'
      ].join('\n')
    )

  const animationStyles = elements
    .map((el) => generateAnimationStyleBlockForElement(el))
    .filter((block) => block !== '')

  return [...elementStyles, '', ...overlayLabelStyles, '', ...animationStyles].join('\n')
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
