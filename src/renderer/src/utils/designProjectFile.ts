import type { CanvasConfig, DesignElement, VirtualEnvConfig, WorkspaceMode } from '@renderer/types/design'

export const DESIGN_PROJECT_FORMAT = 'design-tool-project' as const
export const DESIGN_PROJECT_VERSION = 1 as const

export interface DesignProjectFileV1 {
  format: typeof DESIGN_PROJECT_FORMAT
  version: typeof DESIGN_PROJECT_VERSION
  savedAt: string
  /** 设计项目实例 id，用于会话内绑定保存路径与静默保存 */
  projectId?: string
  /** 最近一次保存的绝对路径（备份绑定；读取时若系统未返回路径可兜底） */
  savedFilePath?: string
  canvas: CanvasConfig
  elements: DesignElement[]
  nextSerial: number
  workspaceMode?: WorkspaceMode
  virtualEnv?: VirtualEnvConfig
}

export const stringifyDesignProjectFile = (
  canvas: CanvasConfig,
  elements: DesignElement[],
  nextSerial: number,
  options?: {
    workspaceMode?: WorkspaceMode
    virtualEnv?: VirtualEnvConfig
    projectId?: string
    savedFilePath?: string
  }
): string =>
  JSON.stringify(
    {
      format: DESIGN_PROJECT_FORMAT,
      version: DESIGN_PROJECT_VERSION,
      savedAt: new Date().toISOString(),
      ...(options?.projectId != null && String(options.projectId).trim() !== ''
        ? { projectId: String(options.projectId).trim() }
        : {}),
      ...(options?.savedFilePath != null && String(options.savedFilePath).trim() !== ''
        ? { savedFilePath: String(options.savedFilePath).trim() }
        : {}),
      canvas: { ...canvas },
      elements: JSON.parse(JSON.stringify(elements)) as DesignElement[],
      nextSerial,
      ...(options?.workspaceMode != null ? { workspaceMode: options.workspaceMode } : {}),
      ...(options?.virtualEnv != null
        ? { virtualEnv: JSON.parse(JSON.stringify(options.virtualEnv)) as VirtualEnvConfig }
        : {})
    },
    null,
    2
  )

export const parseDesignProjectFile = (raw: string): DesignProjectFileV1 | null => {
  let data: unknown
  try {
    data = JSON.parse(raw) as unknown
  } catch {
    return null
  }
  if (!data || typeof data !== 'object') return null
  const o = data as Record<string, unknown>
  if (o.format !== DESIGN_PROJECT_FORMAT) return null
  if (o.version !== 1) return null
  if (!o.canvas || typeof o.canvas !== 'object') return null
  if (!Array.isArray(o.elements)) return null
  const nextSerial = Number(o.nextSerial)
  if (!Number.isFinite(nextSerial)) return null
  const workspaceMode =
    o.workspaceMode === 'virtual-env' || o.workspaceMode === 'standard'
      ? o.workspaceMode
      : undefined
  const virtualEnv =
    o.virtualEnv && typeof o.virtualEnv === 'object' ? (o.virtualEnv as VirtualEnvConfig) : undefined
  const projectId =
    typeof o.projectId === 'string' && o.projectId.trim() !== '' ? o.projectId.trim() : undefined
  const savedFilePath =
    typeof o.savedFilePath === 'string' && o.savedFilePath.trim() !== ''
      ? o.savedFilePath.trim()
      : undefined

  return {
    format: DESIGN_PROJECT_FORMAT,
    version: 1,
    savedAt: typeof o.savedAt === 'string' ? o.savedAt : '',
    ...(projectId != null ? { projectId } : {}),
    ...(savedFilePath != null ? { savedFilePath } : {}),
    canvas: o.canvas as CanvasConfig,
    elements: o.elements as DesignElement[],
    nextSerial: Math.floor(nextSerial),
    ...(workspaceMode != null ? { workspaceMode } : {}),
    ...(virtualEnv != null ? { virtualEnv } : {})
  }
}
