import type { DesignElement } from '@renderer/types/design'

const side = (v: number | undefined): number => (Number.isFinite(v) && v !== undefined ? v : 0)

const useSide = (el: DesignElement, key: keyof DesignElement, def = true): boolean => {
  const v = el[key]
  return v === undefined ? def : !!v
}

function effPadding(el: DesignElement, k: 'paddingTop' | 'paddingRight' | 'paddingBottom' | 'paddingLeft', uk: keyof DesignElement): number {
  if (!useSide(el, uk)) return 0
  return side(el[k])
}

function effMargin(el: DesignElement, k: 'marginTop' | 'marginRight' | 'marginBottom' | 'marginLeft', uk: keyof DesignElement): number {
  if (!useSide(el, uk)) return 0
  return side(el[k])
}

export function paddingCssDecl(el: DesignElement): string[] {
  const t = effPadding(el, 'paddingTop', 'paddingUseTop')
  const r = effPadding(el, 'paddingRight', 'paddingUseRight')
  const b = effPadding(el, 'paddingBottom', 'paddingUseBottom')
  const l = effPadding(el, 'paddingLeft', 'paddingUseLeft')
  if (t === 0 && r === 0 && b === 0 && l === 0) return []
  if (t === r && r === b && b === l) return [`  padding: ${t}px;`]
  return [
    `  padding-top: ${t}px;`,
    `  padding-right: ${r}px;`,
    `  padding-bottom: ${b}px;`,
    `  padding-left: ${l}px;`
  ]
}

export function marginCssDecl(el: DesignElement): string[] {
  const t = effMargin(el, 'marginTop', 'marginUseTop')
  const r = effMargin(el, 'marginRight', 'marginUseRight')
  const b = effMargin(el, 'marginBottom', 'marginUseBottom')
  const l = effMargin(el, 'marginLeft', 'marginUseLeft')
  if (t === 0 && r === 0 && b === 0 && l === 0) return []
  if (t === r && r === b && b === l) return [`  margin: ${t}px;`]
  return [
    `  margin-top: ${t}px;`,
    `  margin-right: ${r}px;`,
    `  margin-bottom: ${b}px;`,
    `  margin-left: ${l}px;`
  ]
}

/** 用于子层绝对定位时避开父级 padding（与 paddingUse* / 数值一致） */
export function effectivePaddingInsets(el: DesignElement): {
  top: number
  right: number
  bottom: number
  left: number
} {
  return {
    top: effPadding(el, 'paddingTop', 'paddingUseTop'),
    right: effPadding(el, 'paddingRight', 'paddingUseRight'),
    bottom: effPadding(el, 'paddingBottom', 'paddingUseBottom'),
    left: effPadding(el, 'paddingLeft', 'paddingUseLeft')
  }
}

export function applyPaddingMarginToStyle(style: Record<string, string>, el: DesignElement): void {
  const t = effPadding(el, 'paddingTop', 'paddingUseTop')
  const r = effPadding(el, 'paddingRight', 'paddingUseRight')
  const b = effPadding(el, 'paddingBottom', 'paddingUseBottom')
  const l = effPadding(el, 'paddingLeft', 'paddingUseLeft')
  if (t !== 0 || r !== 0 || b !== 0 || l !== 0) {
    if (t === r && r === b && b === l) style.padding = `${t}px`
    else {
      style.paddingTop = `${t}px`
      style.paddingRight = `${r}px`
      style.paddingBottom = `${b}px`
      style.paddingLeft = `${l}px`
    }
  }
  const mt = effMargin(el, 'marginTop', 'marginUseTop')
  const mr = effMargin(el, 'marginRight', 'marginUseRight')
  const mb = effMargin(el, 'marginBottom', 'marginUseBottom')
  const ml = effMargin(el, 'marginLeft', 'marginUseLeft')
  if (mt !== 0 || mr !== 0 || mb !== 0 || ml !== 0) {
    if (mt === mr && mr === mb && mb === ml) style.margin = `${mt}px`
    else {
      style.marginTop = `${mt}px`
      style.marginRight = `${mr}px`
      style.marginBottom = `${mb}px`
      style.marginLeft = `${ml}px`
    }
  }
}
