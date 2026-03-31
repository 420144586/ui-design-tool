import type { DesignElement } from '@renderer/types/design'

/** 是否允许作为设计子树的挂载宿主（表格根、纯 img 叶子不可） */
export function canAddChildElements(host: DesignElement): boolean {
  if (host.kind === 'table') return false
  if (host.kind === 'image' && host.type === 'img') return false
  return true
}
