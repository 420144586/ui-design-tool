import type { CanvasConfig, DesignElement, VirtualEnvConfig, WorkspaceMode } from '@renderer/types/design'

export const DESIGN_PROJECT_FORMAT = 'design-tool-project' as const
export const DESIGN_PROJECT_VERSION = 1 as const

export interface DesignProjectFileV1 {
  format: typeof DESIGN_PROJECT_FORMAT
  version: typeof DESIGN_PROJECT_VERSION
  savedAt: string
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
  options?: { workspaceMode?: WorkspaceMode; virtualEnv?: VirtualEnvConfig }
): string =>
  JSON.stringify(
    {
      format: DESIGN_PROJECT_FORMAT,
      version: DESIGN_PROJECT_VERSION,
      savedAt: new Date().toISOString(),
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

  return {
    format: DESIGN_PROJECT_FORMAT,
    version: 1,
    savedAt: typeof o.savedAt === 'string' ? o.savedAt : '',
    canvas: o.canvas as CanvasConfig,
    elements: o.elements as DesignElement[],
    nextSerial: Math.floor(nextSerial),
    ...(workspaceMode != null ? { workspaceMode } : {}),
    ...(virtualEnv != null ? { virtualEnv } : {})
  }
}
