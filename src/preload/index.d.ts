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
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: CustomAPI
  }
}
