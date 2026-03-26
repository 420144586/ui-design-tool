import { ElectronAPI } from '@electron-toolkit/preload'

interface CustomAPI {
  exportVueFile: (content: string, defaultFileName?: string) => Promise<{
    ok: boolean
    canceled: boolean
    filePath?: string
  }>
  exportGeneratedVueFile: (content: string) => Promise<{
    ok: boolean
    filePath: string
  }>
  importVueFile: () => Promise<{
    ok: boolean
    canceled: boolean
    filePath?: string
    content?: string
  }>
  saveDesignProject: (content: string, filePath?: string) => Promise<{
    canceled: boolean
    filePath?: string
  }>
  loadDesignProject: () => Promise<{
    canceled: boolean
    filePath?: string
    content?: string
  }>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: CustomAPI
  }
}
