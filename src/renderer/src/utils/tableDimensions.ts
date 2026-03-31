/**
 * 表格行列：元素库预设、缺字段的设计稿解析、导出与 store 几何计算共用。
 */
export const TABLE_PRESET_DEFAULT_ROWS = 3
export const TABLE_PRESET_DEFAULT_COLS = 3

/** 行数：至少为 1；`undefined` / 非有限数字时用默认 3 */
export function resolveTableRows(value: unknown): number {
  const raw = Number(value)
  if (!Number.isFinite(raw)) return TABLE_PRESET_DEFAULT_ROWS
  return Math.max(1, Math.floor(raw))
}

/** 列数：同上 */
export function resolveTableCols(value: unknown): number {
  const raw = Number(value)
  if (!Number.isFinite(raw)) return TABLE_PRESET_DEFAULT_COLS
  return Math.max(1, Math.floor(raw))
}
